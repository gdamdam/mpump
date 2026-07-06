//! mbus — pub/sub signaling relay for tab-to-tab WebRTC audio.
//!
//! Protocol: see mbus/docs/protocol.md (v1). All message types are namespaced
//! `mbus/*` so they coexist with Link traffic on the same WebSocket. The
//! bridge is signaling only: it keeps a directory of announced audio sources
//! and relays opaque SDP/ICE payloads between clients. It never inspects
//! payloads and never touches audio.
//!
//! This module is deliberately free of sockets and async: `Registry::handle`
//! and `Registry::disconnect` are pure state transitions returning
//! `(connection, json)` pairs for the caller to deliver, so the whole
//! protocol is unit-testable without a live WebSocket (same approach as
//! `decide_transport` in main.rs).

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

/// Protocol version this bridge speaks.
pub const MBUS_VERSION: u32 = 1;

/// Inbound mbus messages (client → bridge), tagged by `type`.
/// Link messages (`set_tempo` / `set_playing`) are a separate enum in
/// main.rs; anything matching neither is ignored, as before.
#[derive(Deserialize, Debug, PartialEq)]
#[serde(tag = "type")]
pub enum MbusIn {
    /// Register this connection for mbus. `mbus` = highest version spoken.
    #[serde(rename = "mbus/hello")]
    Hello { mbus: u32 },
    /// Publish an audio output under a human-readable name.
    #[serde(rename = "mbus/announce")]
    Announce { name: String },
    /// Withdraw a previously announced source (owner only).
    #[serde(rename = "mbus/unannounce")]
    Unannounce {
        #[serde(rename = "sourceId")]
        source_id: String,
    },
    /// Ask to receive audio from a source; forwarded to its owner.
    #[serde(rename = "mbus/request")]
    Request {
        #[serde(rename = "sourceId")]
        source_id: String,
    },
    /// Relay an opaque payload (SDP/ICE) to another registered client.
    #[serde(rename = "mbus/signal")]
    Signal {
        to: String,
        payload: serde_json::Value,
    },
}

/// One directory entry in `mbus/welcome` and `mbus/sources`.
#[derive(Serialize, Clone, Debug, PartialEq)]
struct SourceEntry {
    #[serde(rename = "sourceId")]
    source_id: String,
    name: String,
    #[serde(rename = "clientId")]
    client_id: String,
}

/// A message to deliver: `(connection id, serialized JSON)`.
pub type Outgoing = (u64, String);

#[derive(Debug)]
struct Source {
    name: String,
    owner: u64,
}

#[derive(Debug)]
struct Client {
    /// Completed mbus/hello. Unregistered (Link-only) connections never
    /// receive any mbus traffic.
    registered: bool,
}

/// Protocol state: which connections are mbus-registered and which sources
/// they have announced. Connection ids are allocated here so the caller can
/// key its sender map by the same id. Ids are never reused within a run.
#[derive(Debug, Default)]
pub struct Registry {
    clients: HashMap<u64, Client>,
    /// BTreeMap for deterministic snapshot ordering (stable output, testable).
    sources: BTreeMap<u64, Source>,
    next_client: u64,
    next_source: u64,
}

impl Registry {
    /// Allocate an id for a new connection (called on WebSocket accept,
    /// before any hello — errors and welcome must be deliverable).
    pub fn connect(&mut self) -> u64 {
        self.next_client += 1;
        let id = self.next_client;
        self.clients.insert(id, Client { registered: false });
        id
    }

    /// Drop a connection and everything it announced. Returns directory
    /// snapshots for the remaining registered clients if the directory
    /// changed.
    pub fn disconnect(&mut self, conn: u64) -> Vec<Outgoing> {
        self.clients.remove(&conn);
        let before = self.sources.len();
        self.sources.retain(|_, s| s.owner != conn);
        if self.sources.len() != before {
            self.snapshot_to_registered()
        } else {
            Vec::new()
        }
    }

    /// Apply one inbound message from `conn`; returns the messages to send.
    pub fn handle(&mut self, conn: u64, msg: MbusIn) -> Vec<Outgoing> {
        // Hello is the registration step itself; everything else needs it.
        if let MbusIn::Hello { mbus } = msg {
            return self.hello(conn, mbus);
        }
        if !self.is_registered(conn) {
            let re = match msg {
                MbusIn::Announce { .. } => "mbus/announce",
                MbusIn::Unannounce { .. } => "mbus/unannounce",
                MbusIn::Request { .. } => "mbus/request",
                MbusIn::Signal { .. } => "mbus/signal",
                MbusIn::Hello { .. } => unreachable!(),
            };
            return vec![(conn, error("not-registered", "send mbus/hello first", re))];
        }
        match msg {
            MbusIn::Hello { .. } => unreachable!(),
            MbusIn::Announce { name } => self.announce(conn, name),
            MbusIn::Unannounce { source_id } => self.unannounce(conn, &source_id),
            MbusIn::Request { source_id } => self.request(conn, &source_id),
            MbusIn::Signal { to, payload } => self.signal(conn, &to, payload),
        }
    }

    fn is_registered(&self, conn: u64) -> bool {
        self.clients.get(&conn).map_or(false, |c| c.registered)
    }

    fn hello(&mut self, conn: u64, version: u32) -> Vec<Outgoing> {
        if version < 1 {
            return vec![(
                conn,
                error("unsupported-version", "mbus must be >= 1", "mbus/hello"),
            )];
        }
        if let Some(client) = self.clients.get_mut(&conn) {
            client.registered = true;
        }
        let negotiated = version.min(MBUS_VERSION);
        let welcome = serde_json::json!({
            "type": "mbus/welcome",
            "clientId": client_id(conn),
            "mbus": negotiated,
            "sources": self.snapshot(),
        });
        vec![(conn, welcome.to_string())]
    }

    fn announce(&mut self, conn: u64, name: String) -> Vec<Outgoing> {
        let name = name.trim().to_string();
        if name.is_empty() || name.chars().count() > 64 {
            return vec![(
                conn,
                error("bad-name", "name must be 1..=64 chars", "mbus/announce"),
            )];
        }
        self.next_source += 1;
        let id = self.next_source;
        self.sources.insert(
            id,
            Source {
                name: name.clone(),
                owner: conn,
            },
        );
        let announced = serde_json::json!({
            "type": "mbus/announced",
            "sourceId": source_id(id),
            "name": name,
        });
        let mut out = vec![(conn, announced.to_string())];
        out.extend(self.snapshot_to_registered());
        out
    }

    fn unannounce(&mut self, conn: u64, sid: &str) -> Vec<Outgoing> {
        let Some(id) = parse_source_id(sid).filter(|id| self.sources.contains_key(id)) else {
            return vec![(
                conn,
                error("no-such-source", "unknown sourceId", "mbus/unannounce"),
            )];
        };
        if self.sources[&id].owner != conn {
            return vec![(
                conn,
                error("not-owner", "only the announcer may unannounce", "mbus/unannounce"),
            )];
        }
        self.sources.remove(&id);
        self.snapshot_to_registered()
    }

    fn request(&mut self, conn: u64, sid: &str) -> Vec<Outgoing> {
        let Some(source) = parse_source_id(sid).and_then(|id| self.sources.get(&id)) else {
            return vec![(
                conn,
                error("no-such-source", "unknown sourceId", "mbus/request"),
            )];
        };
        let forward = serde_json::json!({
            "type": "mbus/request",
            "sourceId": sid,
            "from": client_id(conn),
        });
        vec![(source.owner, forward.to_string())]
    }

    fn signal(&mut self, conn: u64, to: &str, payload: serde_json::Value) -> Vec<Outgoing> {
        let target = parse_client_id(to).filter(|id| self.is_registered(*id));
        let Some(target) = target else {
            return vec![(
                conn,
                error("no-such-client", "unknown or unregistered client", "mbus/signal"),
            )];
        };
        let forward = serde_json::json!({
            "type": "mbus/signal",
            "from": client_id(conn),
            "payload": payload,
        });
        vec![(target, forward.to_string())]
    }

    fn snapshot(&self) -> Vec<SourceEntry> {
        self.sources
            .iter()
            .map(|(id, s)| SourceEntry {
                source_id: source_id(*id),
                name: s.name.clone(),
                client_id: client_id(s.owner),
            })
            .collect()
    }

    /// Directory snapshot fanned out to every registered client.
    fn snapshot_to_registered(&self) -> Vec<Outgoing> {
        let msg = serde_json::json!({
            "type": "mbus/sources",
            "sources": self.snapshot(),
        })
        .to_string();
        let mut ids: Vec<u64> = self
            .clients
            .iter()
            .filter(|(_, c)| c.registered)
            .map(|(id, _)| *id)
            .collect();
        ids.sort_unstable(); // deterministic delivery order
        ids.into_iter().map(|id| (id, msg.clone())).collect()
    }
}

/// External (wire) forms of the internal numeric ids. Opaque to clients.
fn client_id(id: u64) -> String {
    format!("c{}", id)
}

fn source_id(id: u64) -> String {
    format!("s{}", id)
}

fn parse_client_id(s: &str) -> Option<u64> {
    s.strip_prefix('c')?.parse().ok()
}

fn parse_source_id(s: &str) -> Option<u64> {
    s.strip_prefix('s')?.parse().ok()
}

fn error(code: &str, message: &str, re: &str) -> String {
    serde_json::json!({
        "type": "mbus/error",
        "code": code,
        "message": message,
        "re": re,
    })
    .to_string()
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn json(s: &str) -> serde_json::Value {
        serde_json::from_str(s).unwrap()
    }

    /// Registry with two registered clients; returns (registry, a, b).
    fn two_registered() -> (Registry, u64, u64) {
        let mut reg = Registry::default();
        let a = reg.connect();
        let b = reg.connect();
        reg.handle(a, MbusIn::Hello { mbus: 1 });
        reg.handle(b, MbusIn::Hello { mbus: 1 });
        (reg, a, b)
    }

    #[test]
    fn parses_all_inbound_types() {
        let cases = [
            r#"{"type":"mbus/hello","mbus":1}"#,
            r#"{"type":"mbus/announce","name":"mchord"}"#,
            r#"{"type":"mbus/unannounce","sourceId":"s1"}"#,
            r#"{"type":"mbus/request","sourceId":"s1"}"#,
            r#"{"type":"mbus/signal","to":"c1","payload":{"kind":"offer"}}"#,
        ];
        for c in cases {
            assert!(
                serde_json::from_str::<MbusIn>(c).is_ok(),
                "failed to parse {}",
                c
            );
        }
    }

    #[test]
    fn rejects_link_and_unknown_types() {
        for c in [
            r#"{"type":"set_tempo","tempo":140.0}"#,
            r#"{"type":"link","tempo":120.0}"#,
            r#"{"type":"mbus/nonsense"}"#,
        ] {
            assert!(serde_json::from_str::<MbusIn>(c).is_err(), "parsed {}", c);
        }
    }

    #[test]
    fn hello_returns_welcome_with_id_version_and_directory() {
        let mut reg = Registry::default();
        let a = reg.connect();
        let out = reg.handle(a, MbusIn::Hello { mbus: 1 });
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].0, a);
        let msg = json(&out[0].1);
        assert_eq!(msg["type"], "mbus/welcome");
        assert_eq!(msg["clientId"], "c1");
        assert_eq!(msg["mbus"], 1);
        assert_eq!(msg["sources"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn hello_negotiates_down_to_bridge_version() {
        let mut reg = Registry::default();
        let a = reg.connect();
        let out = reg.handle(a, MbusIn::Hello { mbus: 99 });
        assert_eq!(json(&out[0].1)["mbus"], MBUS_VERSION);
    }

    #[test]
    fn hello_version_zero_is_rejected() {
        let mut reg = Registry::default();
        let a = reg.connect();
        let out = reg.handle(a, MbusIn::Hello { mbus: 0 });
        let msg = json(&out[0].1);
        assert_eq!(msg["type"], "mbus/error");
        assert_eq!(msg["code"], "unsupported-version");
        // and the connection is still not registered
        let out = reg.handle(
            a,
            MbusIn::Announce {
                name: "x".to_string(),
            },
        );
        assert_eq!(json(&out[0].1)["code"], "not-registered");
    }

    #[test]
    fn pre_hello_messages_get_not_registered() {
        let mut reg = Registry::default();
        let a = reg.connect();
        let out = reg.handle(
            a,
            MbusIn::Request {
                source_id: "s1".to_string(),
            },
        );
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].0, a);
        let msg = json(&out[0].1);
        assert_eq!(msg["code"], "not-registered");
        assert_eq!(msg["re"], "mbus/request");
    }

    #[test]
    fn announce_confirms_to_owner_and_snapshots_to_all_registered() {
        let (mut reg, a, b) = two_registered();
        let out = reg.handle(
            a,
            MbusIn::Announce {
                name: "mchord".to_string(),
            },
        );
        // announced → a, snapshot → a and b
        assert_eq!(out.len(), 3);
        let announced = json(&out[0].1);
        assert_eq!(out[0].0, a);
        assert_eq!(announced["type"], "mbus/announced");
        assert_eq!(announced["sourceId"], "s1");
        assert_eq!(announced["name"], "mchord");
        let targets: Vec<u64> = out[1..].iter().map(|(t, _)| *t).collect();
        assert_eq!(targets, vec![a, b]);
        let snap = json(&out[1].1);
        assert_eq!(snap["type"], "mbus/sources");
        assert_eq!(snap["sources"][0]["sourceId"], "s1");
        assert_eq!(snap["sources"][0]["name"], "mchord");
        assert_eq!(snap["sources"][0]["clientId"], "c1");
    }

    #[test]
    fn announce_trims_and_validates_name() {
        let (mut reg, a, _) = two_registered();
        let out = reg.handle(
            a,
            MbusIn::Announce {
                name: "   ".to_string(),
            },
        );
        assert_eq!(json(&out[0].1)["code"], "bad-name");
        let out = reg.handle(
            a,
            MbusIn::Announce {
                name: "x".repeat(65),
            },
        );
        assert_eq!(json(&out[0].1)["code"], "bad-name");
        let out = reg.handle(
            a,
            MbusIn::Announce {
                name: "  mchord  ".to_string(),
            },
        );
        assert_eq!(json(&out[0].1)["name"], "mchord");
    }

    #[test]
    fn unregistered_connections_never_receive_snapshots() {
        let mut reg = Registry::default();
        let a = reg.connect();
        let link_only = reg.connect();
        reg.handle(a, MbusIn::Hello { mbus: 1 });
        let out = reg.handle(
            a,
            MbusIn::Announce {
                name: "mchord".to_string(),
            },
        );
        assert!(
            out.iter().all(|(t, _)| *t != link_only),
            "Link-only connection must see no mbus traffic"
        );
    }

    #[test]
    fn unannounce_enforces_ownership_and_updates_directory() {
        let (mut reg, a, b) = two_registered();
        reg.handle(
            a,
            MbusIn::Announce {
                name: "mchord".to_string(),
            },
        );
        // b may not withdraw a's source
        let out = reg.handle(
            b,
            MbusIn::Unannounce {
                source_id: "s1".to_string(),
            },
        );
        assert_eq!(json(&out[0].1)["code"], "not-owner");
        // unknown id
        let out = reg.handle(
            a,
            MbusIn::Unannounce {
                source_id: "s99".to_string(),
            },
        );
        assert_eq!(json(&out[0].1)["code"], "no-such-source");
        // owner withdraws → empty snapshot to both
        let out = reg.handle(
            a,
            MbusIn::Unannounce {
                source_id: "s1".to_string(),
            },
        );
        assert_eq!(out.len(), 2);
        assert_eq!(json(&out[0].1)["sources"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn request_is_forwarded_to_owner_only() {
        let (mut reg, a, b) = two_registered();
        reg.handle(
            a,
            MbusIn::Announce {
                name: "mchord".to_string(),
            },
        );
        let out = reg.handle(
            b,
            MbusIn::Request {
                source_id: "s1".to_string(),
            },
        );
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].0, a);
        let msg = json(&out[0].1);
        assert_eq!(msg["type"], "mbus/request");
        assert_eq!(msg["sourceId"], "s1");
        assert_eq!(msg["from"], "c2");
    }

    #[test]
    fn request_unknown_source_errors() {
        let (mut reg, _, b) = two_registered();
        let out = reg.handle(
            b,
            MbusIn::Request {
                source_id: "s7".to_string(),
            },
        );
        assert_eq!(out[0].0, b);
        let msg = json(&out[0].1);
        assert_eq!(msg["code"], "no-such-source");
        assert_eq!(msg["re"], "mbus/request");
    }

    #[test]
    fn signal_relays_payload_opaquely_and_stamps_from() {
        let (mut reg, a, b) = two_registered();
        let payload = serde_json::json!({"kind": "offer", "sourceId": "s1", "sdp": "v=0..."});
        let out = reg.handle(
            a,
            MbusIn::Signal {
                to: "c2".to_string(),
                payload: payload.clone(),
            },
        );
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].0, b);
        let msg = json(&out[0].1);
        assert_eq!(msg["type"], "mbus/signal");
        assert_eq!(msg["from"], "c1");
        assert_eq!(msg["payload"], payload);
    }

    #[test]
    fn signal_to_unknown_or_unregistered_client_errors() {
        let mut reg = Registry::default();
        let a = reg.connect();
        let link_only = reg.connect();
        reg.handle(a, MbusIn::Hello { mbus: 1 });
        for to in ["c99", &client_id(link_only), "garbage"] {
            let out = reg.handle(
                a,
                MbusIn::Signal {
                    to: to.to_string(),
                    payload: serde_json::Value::Null,
                },
            );
            assert_eq!(out[0].0, a);
            assert_eq!(json(&out[0].1)["code"], "no-such-client", "to={}", to);
        }
    }

    #[test]
    fn disconnect_drops_sources_and_notifies_remaining() {
        let (mut reg, a, b) = two_registered();
        reg.handle(
            a,
            MbusIn::Announce {
                name: "mchord".to_string(),
            },
        );
        let out = reg.disconnect(a);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].0, b);
        let msg = json(&out[0].1);
        assert_eq!(msg["type"], "mbus/sources");
        assert_eq!(msg["sources"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn disconnect_without_sources_is_silent() {
        let (mut reg, a, _) = two_registered();
        assert!(reg.disconnect(a).is_empty());
    }

    #[test]
    fn ids_are_never_reused_within_a_run() {
        let mut reg = Registry::default();
        let a = reg.connect();
        reg.handle(a, MbusIn::Hello { mbus: 1 });
        reg.handle(
            a,
            MbusIn::Announce {
                name: "one".to_string(),
            },
        );
        reg.disconnect(a);
        let b = reg.connect();
        assert_ne!(a, b);
        reg.handle(b, MbusIn::Hello { mbus: 1 });
        let out = reg.handle(
            b,
            MbusIn::Announce {
                name: "two".to_string(),
            },
        );
        assert_eq!(json(&out[0].1)["sourceId"], "s2");
    }

    #[test]
    fn welcome_carries_current_directory() {
        let (mut reg, a, _) = two_registered();
        reg.handle(
            a,
            MbusIn::Announce {
                name: "mchord".to_string(),
            },
        );
        let c = reg.connect();
        let out = reg.handle(c, MbusIn::Hello { mbus: 1 });
        let msg = json(&out[0].1);
        assert_eq!(msg["sources"].as_array().unwrap().len(), 1);
        assert_eq!(msg["sources"][0]["name"], "mchord");
    }
}
