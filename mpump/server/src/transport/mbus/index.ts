/**
 * mbus-client — tab-to-tab WebRTC audio for the m-suite.
 * AGPL-3.0-or-later. See docs/protocol.md for the wire protocol.
 *
 * Vendored verbatim from the sibling mbus project (mbus/packages/mbus-client,
 * AGPL-3.0-or-later, github.com/gdamdam/mbus) — index.ts, client.ts and
 * protocol.ts. The suite has no shared package registry yet (this library is
 * the seed of a future `mcore`), so it is copied here and credited rather than
 * imported, this is the same convention the siblings use for mpump's own utils/linkBridge.ts. Kept
 * byte-for-byte with upstream so it stays trivially re-syncable; do not edit —
 * change it upstream and re-copy.
 */

export { createMbusClient } from './client.js'
export type {
  BridgeState,
  MbusClient,
  MbusClientOptions,
  PeerConnectionLike,
  Publication,
  PublicationState,
  Subscription,
  SubscriptionState,
  WebSocketLike,
} from './client.js'
export {
  DEFAULT_WS_URLS,
  MBUS_VERSION,
  outbound,
  parseServerMessage,
  parseSignalPayload,
} from './protocol.js'
export type { ServerMessage, SignalPayload, SourceInfo } from './protocol.js'
