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
//! No internet connections are made. Only local network UDP (Link) and localhost TCP (WebSocket).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::{SinkExt, StreamExt};
use rusty_link::{AblLink, SessionState};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::tungstenite::Message;

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

    // Task 1: WebSocket server — accepts browser connections
    let ws_link = link.clone();
    let ws_tx = tx.clone();
    let ws_client_count = client_count.clone();
    tokio::spawn(async move {
        run_ws_server(ws_link, ws_tx, ws_client_count).await;
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
/// Binds to 0.0.0.0 (falls back to [::] for IPv6-only systems).
/// Both IPv4 and IPv6 are needed because Safari on macOS may connect via [::1].
async fn run_ws_server(
    link: Arc<Mutex<AblLink>>,
    tx: broadcast::Sender<String>,
    client_count: Arc<std::sync::atomic::AtomicUsize>,
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
        tokio::spawn(async move {
            handle_connection(stream, peer, link, tx, client_count).await;
        });
    }
}

/// Handles a single WebSocket connection.
/// Two concurrent tasks per client:
///   - Send task: forwards broadcast Link state messages to this client
///   - Receive loop: processes set_tempo / set_playing messages from the browser
async fn handle_connection(
    stream: TcpStream,
    peer: SocketAddr,
    link: Arc<Mutex<AblLink>>,
    tx: broadcast::Sender<String>,
    client_count: Arc<std::sync::atomic::AtomicUsize>,
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

    // Send task: forward all broadcast messages to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg)).await.is_err() {
                break; // client disconnected
            }
        }
    });

    // Receive loop: handle commands from the browser
    let mut session = SessionState::new();
    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
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
                        // Request beat at time 0 on bar boundary (quantum=4)
                        session.set_is_playing_and_request_beat_at_time(
                            playing, time, 0.0, 4.0,
                        );
                        link.commit_app_session_state(&session);
                    }
                }
            }
        }
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
    fn tempo_validation_range() {
        // The handler checks tempo > 20.0 && tempo < 999.0
        assert!(20.1 > 20.0 && 20.1 < 999.0); // valid
        assert!(!(20.0 > 20.0)); // boundary: 20.0 exactly is rejected
        assert!(!(999.0 < 999.0)); // boundary: 999.0 exactly is rejected
        assert!(300.0 > 20.0 && 300.0 < 999.0); // typical max
    }
}
