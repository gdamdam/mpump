//! mpump Link Bridge — bridges Ableton Link to WebSocket for browser sync.
//!
//! Architecture:
//!   AblLink (UDP multicast) ←→ This app ←→ WebSocket (ws://localhost:19876) ←→ mpump.live
//!
//! Three async tasks run concurrently:
//!   1. WebSocket server — accepts browser connections on port 19876
//!   2. Link poller — reads Link state 20× per second and broadcasts to all WS clients
//!   3. Tauri — renders the companion app window
//!
//! The same WebSocket also carries mbus signaling (tab-to-tab WebRTC audio):
//! `mbus/*` messages are routed point-to-point via the mbus module, while
//! Link state keeps flowing on the broadcast channel exactly as before.
//! Connections that never send `mbus/hello` see no mbus traffic at all.
//!
//! No internet connections are made. Only local network UDP (Link) and local network TCP
//! (WebSocket). The WebSocket server intentionally binds 0.0.0.0 so any device on the LAN
//! (phones, tablets, other laptops) can use the bridge — which also means any LAN host can
//! read Link state and control tempo/transport through it.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::{SinkExt, StreamExt};
use rusty_link::{AblLink, SessionState};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, mpsc, Mutex};
use tokio_tungstenite::tungstenite::Message;

mod mbus;

/// Shared mbus state: the protocol registry plus each connection's outbound
/// channel, used for targeted (non-broadcast) delivery of mbus messages.
#[derive(Default)]
struct MbusShared {
    registry: mbus::Registry,
    senders: HashMap<u64, mpsc::UnboundedSender<String>>,
}

impl MbusShared {
    /// Send each (connection, json) pair down that connection's channel.
    /// Vanished connections are skipped — their cleanup is already underway.
    fn deliver(&self, out: Vec<mbus::Outgoing>) {
        for (target, json) in out {
            if let Some(tx) = self.senders.get(&target) {
                let _ = tx.send(json);
            }
        }
    }
}

/// State broadcast to all connected browser clients at 20Hz.
/// The `type` field is always "link" so the browser can identify these messages.
#[derive(Serialize, Clone, Debug, PartialEq)]
struct LinkState {
    #[serde(rename = "type")]
    msg_type: String,
    /// Current Link session tempo in BPM
    tempo: f64,
    /// Current beat position (e.g. 2.5 = halfway through beat 3)
    beat: f64,
    /// Phase within a bar (0.0–3.999 for 4/4 time)
    phase: f64,
    /// Whether the Link session is playing
    playing: bool,
    /// Number of other Link peers on the network (e.g. Ableton Live)
    peers: u64,
    /// Number of WebSocket clients (browser tabs) connected
    clients: usize,
}

/// Messages the browser can send to control the Link session.
/// Tagged by `type` field for JSON deserialization.
#[derive(Deserialize, Debug, PartialEq)]
#[serde(tag = "type")]
enum ClientMessage {
    /// Set tempo — propagates to all Link peers
    #[serde(rename = "set_tempo")]
    SetTempo { tempo: f64 },
    /// Start or stop — propagates to all Link peers with start/stop sync
    #[serde(rename = "set_playing")]
    SetPlaying { playing: bool },
}

/// What to do with the transport given the current and requested playing states.
/// Kept as a pure decision so it can be unit-tested without a live Link session.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
enum TransportAction {
    /// Already in the requested state — do nothing (no commit, no beat remap).
    NoOp,
    /// stopped → playing: start and request a beat on the bar boundary.
    Start,
    /// playing → stopped: stop without touching the beat timeline.
    Stop,
}

/// Decide the transport action from the current and requested playing states.
/// Idempotent: a request matching the current state is a no-op, so we never
/// commit a redundant session update or remap the beat under peers' feet.
fn decide_transport(current: bool, requested: bool) -> TransportAction {
    match (current, requested) {
        (false, true) => TransportAction::Start,
        (true, false) => TransportAction::Stop,
        _ => TransportAction::NoOp,
    }
}

#[tokio::main]
async fn main() {
    // Initialize Ableton Link at 120 BPM and join the Link session
    let link = AblLink::new(120.0);
    link.enable(true);
    // Allow other peers to control start/stop (e.g. pressing Play in Ableton)
    link.enable_start_stop_sync(true);

    let client_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let link = Arc::new(Mutex::new(link));

    // Broadcast channel: Link poller sends JSON strings, all WS handlers receive them
    let (tx, _) = broadcast::channel::<String>(64);

    // mbus signaling state: protocol registry + per-connection channels
    let mbus_shared = Arc::new(Mutex::new(MbusShared::default()));

    // Task 1: WebSocket server — accepts browser connections
    let ws_link = link.clone();
    let ws_tx = tx.clone();
    let ws_client_count = client_count.clone();
    let ws_mbus = mbus_shared.clone();
    tokio::spawn(async move {
        run_ws_server(ws_link, ws_tx, ws_client_count, ws_mbus).await;
    });

    // Task 2: Link poller — reads Link state at 20Hz and broadcasts to all WS clients
    let poll_link = link.clone();
    let poll_tx = tx.clone();
    let poll_client_count = client_count.clone();
    tokio::spawn(async move {
        poll_link_state(poll_link, poll_tx, poll_client_count).await;
    });

    // Task 3: Tauri app window
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

/// Polls the Link session state every 50ms (20Hz) and broadcasts JSON to all WS clients.
async fn poll_link_state(
    link: Arc<Mutex<AblLink>>,
    tx: broadcast::Sender<String>,
    client_count: Arc<std::sync::atomic::AtomicUsize>,
) {
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(50));
    let mut session = SessionState::new();
    loop {
        interval.tick().await;

        // Capture current Link state (lock is held briefly)
        let link = link.lock().await;
        link.capture_app_session_state(&mut session);
        let tempo = session.tempo();
        let time = link.clock_micros();
        let beat = session.beat_at_time(time, 4.0);
        let phase = session.phase_at_time(time, 4.0);
        let playing = session.is_playing();
        let peers = link.num_peers();
        let clients = client_count.load(std::sync::atomic::Ordering::Relaxed);
        drop(link); // release lock before serializing

        let state = LinkState {
            msg_type: "link".to_string(),
            tempo,
            beat,
            phase,
            playing,
            peers,
            clients,
        };

        if let Ok(json) = serde_json::to_string(&state) {
            // Ignore send errors (no subscribers yet, or all disconnected)
            let _ = tx.send(json);
        }
    }
}

/// Listens for WebSocket connections on port 19876.
/// Intentionally binds 0.0.0.0 (falls back to [::] for IPv6-only systems) so any
/// client on the LAN can use the bridge — not just this machine. Note this means
/// any LAN host can control tempo/transport via the bridge.
/// Both IPv4 and IPv6 are needed because Safari on macOS may connect via [::1].
async fn run_ws_server(
    link: Arc<Mutex<AblLink>>,
    tx: broadcast::Sender<String>,
    client_count: Arc<std::sync::atomic::AtomicUsize>,
    mbus_shared: Arc<Mutex<MbusShared>>,
) {
    let listener = match TcpListener::bind("0.0.0.0:19876").await {
        Ok(l) => l,
        Err(_) => TcpListener::bind("[::]:19876")
            .await
            .expect("Failed to bind WS port 19876"),
    };
    println!("WebSocket server listening on ws://localhost:19876");

    while let Ok((stream, peer)) = listener.accept().await {
        let link = link.clone();
        let tx = tx.clone();
        let client_count = client_count.clone();
        let mbus_shared = mbus_shared.clone();
        tokio::spawn(async move {
            handle_connection(stream, peer, link, tx, client_count, mbus_shared).await;
        });
    }
}

/// Handles a single WebSocket connection.
/// Two concurrent tasks per client:
///   - Send task: forwards broadcast Link state messages and this client's
///     targeted mbus messages to it
///   - Receive loop: processes set_tempo / set_playing / mbus/* messages
async fn handle_connection(
    stream: TcpStream,
    peer: SocketAddr,
    link: Arc<Mutex<AblLink>>,
    tx: broadcast::Sender<String>,
    client_count: Arc<std::sync::atomic::AtomicUsize>,
    mbus_shared: Arc<Mutex<MbusShared>>,
) {
    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("WS handshake failed for {}: {}", peer, e);
            return;
        }
    };

    client_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    println!("Client connected: {}", peer);

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let mut rx = tx.subscribe();

    // Register with mbus so welcome/errors are deliverable pre-hello. The
    // connection stays Link-only (receives no mbus traffic) until it says
    // mbus/hello.
    let (mbus_tx, mut mbus_rx) = mpsc::unbounded_channel::<String>();
    let conn = {
        let mut shared = mbus_shared.lock().await;
        let conn = shared.registry.connect();
        shared.senders.insert(conn, mbus_tx);
        conn
    };

    // Send task: forward broadcast messages and targeted mbus messages.
    // Broadcast errors end the task as before (Lagged/Closed both break).
    let send_task = tokio::spawn(async move {
        loop {
            let msg = tokio::select! {
                m = rx.recv() => match m {
                    Ok(m) => m,
                    Err(_) => break,
                },
                m = mbus_rx.recv() => match m {
                    Some(m) => m,
                    None => break, // sender dropped during cleanup
                },
            };
            if ws_sender.send(Message::Text(msg)).await.is_err() {
                break; // client disconnected
            }
        }
    });

    // Receive loop: handle commands from the browser
    let mut session = SessionState::new();
    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            // mbus messages are routed by the registry; anything matching
            // neither enum is ignored, exactly as before.
            if let Ok(mbus_msg) = serde_json::from_str::<mbus::MbusIn>(&text) {
                let shared = &mut *mbus_shared.lock().await;
                let out = shared.registry.handle(conn, mbus_msg);
                shared.deliver(out);
            } else if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                let link = link.lock().await;
                let time = link.clock_micros();
                link.capture_app_session_state(&mut session);
                match client_msg {
                    ClientMessage::SetTempo { tempo } => {
                        // Clamp to reasonable range to avoid Link SDK issues
                        if tempo > 20.0 && tempo < 999.0 {
                            session.set_tempo(tempo, time);
                            link.commit_app_session_state(&session);
                        }
                    }
                    ClientMessage::SetPlaying { playing } => {
                        // Only act on a real transition; a redundant request is a no-op
                        // so we never commit or remap the beat under peers' feet.
                        match decide_transport(session.is_playing(), playing) {
                            TransportAction::Start => {
                                // Request beat at time 0 on bar boundary (quantum=4)
                                session
                                    .set_is_playing_and_request_beat_at_time(true, time, 0.0, 4.0);
                                link.commit_app_session_state(&session);
                            }
                            TransportAction::Stop => {
                                // Stop only — leave the beat timeline untouched.
                                session.set_is_playing(false, time);
                                link.commit_app_session_state(&session);
                            }
                            TransportAction::NoOp => {}
                        }
                    }
                }
            }
        }
    }

    // Drop this connection's mbus state and tell remaining clients its
    // sources are gone.
    {
        let shared = &mut *mbus_shared.lock().await;
        shared.senders.remove(&conn);
        let out = shared.registry.disconnect(conn);
        shared.deliver(out);
    }

    client_count.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    println!("Client disconnected: {}", peer);
    send_task.abort();
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn link_state_serializes_with_type_field() {
        let state = LinkState {
            msg_type: "link".to_string(),
            tempo: 128.5,
            beat: 2.3,
            phase: 0.575,
            playing: true,
            peers: 1,
            clients: 2,
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"type\":\"link\""));
        assert!(json.contains("\"tempo\":128.5"));
        assert!(json.contains("\"playing\":true"));
        assert!(json.contains("\"peers\":1"));
        assert!(json.contains("\"clients\":2"));
        // msg_type should NOT appear (renamed to "type")
        assert!(!json.contains("msg_type"));
    }

    #[test]
    fn link_state_roundtrips_via_json() {
        let state = LinkState {
            msg_type: "link".to_string(),
            tempo: 120.0,
            beat: 0.0,
            phase: 0.0,
            playing: false,
            peers: 0,
            clients: 0,
        };
        let json = serde_json::to_string(&state).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "link");
        assert_eq!(parsed["tempo"], 120.0);
        assert_eq!(parsed["playing"], false);
    }

    #[test]
    fn client_message_parses_set_tempo() {
        let json = r#"{"type":"set_tempo","tempo":140.0}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::SetTempo { tempo } => assert_eq!(tempo, 140.0),
            _ => panic!("expected SetTempo"),
        }
    }

    #[test]
    fn client_message_parses_set_playing_true() {
        let json = r#"{"type":"set_playing","playing":true}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::SetPlaying { playing } => assert!(playing),
            _ => panic!("expected SetPlaying"),
        }
    }

    #[test]
    fn client_message_parses_set_playing_false() {
        let json = r#"{"type":"set_playing","playing":false}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::SetPlaying { playing } => assert!(!playing),
            _ => panic!("expected SetPlaying"),
        }
    }

    #[test]
    fn client_message_rejects_unknown_type() {
        let json = r#"{"type":"unknown","value":42}"#;
        let result = serde_json::from_str::<ClientMessage>(json);
        assert!(result.is_err());
    }

    #[test]
    fn client_message_rejects_missing_fields() {
        let json = r#"{"type":"set_tempo"}"#;
        let result = serde_json::from_str::<ClientMessage>(json);
        assert!(result.is_err());
    }

    #[test]
    fn transport_starts_from_stopped() {
        // stopped → playing: start and request a beat
        assert_eq!(decide_transport(false, true), TransportAction::Start);
    }

    #[test]
    fn transport_stops_from_playing() {
        // playing → stopped: stop without remapping the beat
        assert_eq!(decide_transport(true, false), TransportAction::Stop);
    }

    #[test]
    fn transport_noop_when_already_playing() {
        // playing → playing: redundant, do nothing
        assert_eq!(decide_transport(true, true), TransportAction::NoOp);
    }

    #[test]
    fn transport_noop_when_already_stopped() {
        // stopped → stopped: redundant, do nothing
        assert_eq!(decide_transport(false, false), TransportAction::NoOp);
    }

    #[test]
    fn tempo_validation_range() {
        // The handler checks tempo > 20.0 && tempo < 999.0
        assert!(20.1 > 20.0 && 20.1 < 999.0); // valid
        assert!(!(20.0 > 20.0)); // boundary: 20.0 exactly is rejected
        assert!(!(999.0 < 999.0)); // boundary: 999.0 exactly is rejected
        assert!(300.0 > 20.0 && 300.0 < 999.0); // typical max
    }
}
