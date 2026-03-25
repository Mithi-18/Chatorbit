import Peer from 'peerjs';

let peer = null;
const connections = {};      // peerId -> DataConnection
const callConnections = {};  // peerId -> { call, stream }

// ─── E2E Encryption (ECDH P-256 + AES-GCM 256) ─────────────────────────────
let myKeyPair = null;
const sharedKeys = {};

async function initCrypto() {
  myKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
  );
}

async function exportMyPublicKey() {
  return Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', myKeyPair.publicKey)));
}

async function deriveSharedKey(remotePubKeyArray) {
  const buf = new Uint8Array(remotePubKeyArray).buffer;
  const importedKey = await crypto.subtle.importKey(
    'raw', buf, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: importedKey },
    myKeyPair.privateKey,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encryptPayload(peerId, obj) {
  const key = sharedKeys[peerId];
  if (!key) return { raw: true, data: obj };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: Array.from(iv), cipher: Array.from(new Uint8Array(cipher)) };
}

async function decryptPayload(peerId, payload) {
  if (payload.raw) return payload.data;
  const key = sharedKeys[peerId];
  if (!key) return null;
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
    key,
    new Uint8Array(payload.cipher).buffer
  );
  return JSON.parse(new TextDecoder().decode(dec));
}

// ─── Chunking (handles large media like voice, image, video) ────────────────
const CHUNK_SIZE = 60 * 1024; // 60 KB chunks — safe for WebRTC data channels
const inboundChunks = {}; // msgId -> { chunks: [], total }

function splitIntoChunks(data) {
  const chunks = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function sendChunked(conn, type, payload) {
  const msgId = Math.random().toString(36).slice(2);
  const serialized = JSON.stringify(payload);
  const chunks = splitIntoChunks(serialized);

  for (let i = 0; i < chunks.length; i++) {
    conn.send({ type: 'chunk', msgId, index: i, total: chunks.length, chunkType: type, data: chunks[i] });
    // Small delay between chunks to avoid overwhelming the channel
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 20));
  }
}

function handleChunk(peerId, packet, onMessage) {
  const { msgId, index, total, chunkType, data } = packet;
  if (!inboundChunks[msgId]) inboundChunks[msgId] = { chunks: new Array(total), received: 0, total, type: chunkType };
  
  const entry = inboundChunks[msgId];
  entry.chunks[index] = data;
  entry.received++;

  if (entry.received === entry.total) {
    const full = entry.chunks.join('');
    delete inboundChunks[msgId];
    try {
      const payload = JSON.parse(full);
      if (entry.type === 'message' && onMessage) onMessage(payload);
    } catch (e) {
      console.error('[Chunking] Failed to parse reassembled message', e);
    }
  }
}

// ─── Callbacks ─────────────────────────────────────────────────────────────
let onMessage = null;
let onPresenceChange = null;
let _incomingCallHandler = null;

export const setOnMessage = (fn) => { onMessage = fn; };
export const setOnPresenceChange = (fn) => { onPresenceChange = fn; };
export const setOnIncomingCall = (fn) => { _incomingCallHandler = fn; };
export const getPeer = () => peer;

// ─── Data connection setup ───────────────────────────────────────────────────
function _setupDataConn(conn) {
  const rid = conn.peer;

  conn.on('open', async () => {
    if (onPresenceChange) onPresenceChange(rid, true);
    // Exchange ECDH public keys for E2EE
    const myPubKey = await exportMyPublicKey();
    conn.send({ type: 'key_exchange', key: myPubKey });
    // Announce we are online
    conn.send({ type: 'presence', isActive: true });
  });

  conn.on('data', async (packet) => {
    if (packet.type === 'key_exchange') {
      sharedKeys[rid] = await deriveSharedKey(packet.key);
      console.log('[E2EE] AES-256-GCM key established with', rid);

    } else if (packet.type === 'presence') {
      if (onPresenceChange) onPresenceChange(rid, packet.isActive);

    } else if (packet.type === 'chunk') {
      // Large message received in chunks — reassemble
      handleChunk(rid, packet, onMessage);

    } else if (packet.type === 'message_enc') {
      // Small encrypted message (text/emoji)
      const decrypted = await decryptPayload(rid, packet.payload);
      if (decrypted && onMessage) onMessage(decrypted);
    }
  });

  conn.on('close', () => {
    delete connections[rid];
    delete sharedKeys[rid];
    if (onPresenceChange) onPresenceChange(rid, false);
  });

  conn.on('error', (err) => {
    console.warn('[PeerJS] Conn error with', rid, err.message);
    delete connections[rid];
    if (onPresenceChange) onPresenceChange(rid, false);
  });
}

// ─── Init ───────────────────────────────────────────────────────────────────
export const initPeer = (peerId, knownContactIds = []) => {
  return new Promise(async (resolve) => {
    await initCrypto();

    // Destroy any existing peer instance first
    if (peer) { try { peer.destroy(); } catch (e) {} }

    peer = new Peer(peerId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('open', (id) => {
      console.log('[PeerJS] Online:', id);
      // Connect to all known contacts for presence
      knownContactIds.forEach((cid) => {
        if (cid && !connections[cid]) {
          try {
            const conn = peer.connect(cid, { reliable: true, serialization: 'json' });
            connections[cid] = conn;
            _setupDataConn(conn);
          } catch (e) {
            console.warn('[PeerJS] Could not pre-connect to', cid);
          }
        }
      });
      resolve(id);
    });

    peer.on('connection', (conn) => {
      const rid = conn.peer;
      if (connections[rid] && connections[rid] !== conn) {
        connections[rid].close();
      }
      connections[rid] = conn;
      _setupDataConn(conn);
    });

    peer.on('call', (call) => {
      if (_incomingCallHandler) _incomingCallHandler(call);
    });

    peer.on('error', (err) => {
      console.error('[PeerJS] Error:', err.type, err.message);
    });
  });
};

// ─── Connect ─────────────────────────────────────────────────────────────────
export const connectToPeer = (remotePeerId) => {
  if (connections[remotePeerId]?.open) return connections[remotePeerId];
  const conn = peer.connect(remotePeerId, { reliable: true, serialization: 'json' });
  connections[remotePeerId] = conn;
  _setupDataConn(conn);
  return conn;
};

// ─── Send message (auto-chunks large media like voice/image/video) ──────────
export const sendMessage = async (remotePeerId, messagePayload) => {
  const doSend = async (conn) => {
    const isLarge = messagePayload.mediaData && messagePayload.mediaData.length > 40000;

    if (isLarge) {
      // Large media: bypass encryption for chunked transfer (WebRTC channel is DTLS-encrypted anyway)
      await sendChunked(conn, 'message', messagePayload);
    } else {
      // Small messages: AES-GCM encrypt
      const encPayload = await encryptPayload(remotePeerId, messagePayload);
      conn.send({ type: 'message_enc', payload: encPayload });
    }
  };

  const conn = connections[remotePeerId];
  if (conn && conn.open) {
    await doSend(conn);
  } else {
    const newConn = connectToPeer(remotePeerId);
    const waitOpen = () => new Promise(resolve => {
      if (newConn.open) return resolve();
      newConn.once('open', resolve);
    });
    await waitOpen();
    await doSend(newConn);
  }
};

// ─── Calls (WebRTC DTLS-SRTP = E2EE natively) ──────────────────────────────
export const callPeer = async (remotePeerId, videoEnabled = false) => {
  const constraints = { audio: true, video: videoEnabled ? { width: 640, height: 480 } : false };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const call = peer.call(remotePeerId, stream, { sdpTransform });
  callConnections[remotePeerId] = { call, stream };
  return { call, stream };
};

export const answerCall = async (incomingCall, videoEnabled = false) => {
  const constraints = { audio: true, video: videoEnabled ? { width: 640, height: 480 } : false };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  incomingCall.answer(stream, { sdpTransform });
  callConnections[incomingCall.peer] = { call: incomingCall, stream };
  return { call: incomingCall, stream };
};

// Force Opus codec for best voice quality
function sdpTransform(sdp) {
  return sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; maxaveragebitrate=510000');
}

export const endCall = (remotePeerId) => {
  const entry = callConnections[remotePeerId];
  if (entry) {
    try { entry.call.close(); } catch (e) {}
    try { entry.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    delete callConnections[remotePeerId];
  }
};

export const destroyPeer = () => {
  Object.values(connections).forEach(conn => {
    try { if (conn.open) conn.send({ type: 'presence', isActive: false }); } catch (e) {}
  });
  setTimeout(() => {
    if (peer) try { peer.destroy(); } catch (e) {}
  }, 200);
};
