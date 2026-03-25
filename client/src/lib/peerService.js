import Peer from 'peerjs';

let peer = null;
const connections = {};     // peerId -> DataConnection
const callConnections = {}; // peerId -> { call, stream }

// ─── E2E Encryption (AES-GCM) ──────────────────────────────────────────────
// Each user generates an ECDH key pair. When connecting, they exchange public keys.
// A shared AES-GCM key is derived per-contact with ECDH + HKDF.
let myKeyPair = null;       // { publicKey, privateKey } CryptoKeyPair
const sharedKeys = {};      // peerId -> CryptoKey (AES-256-GCM)
const peerPublicKeys = {};  // peerId -> serialized JWK

async function initCrypto() {
  myKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

async function exportMyPublicKey() {
  return crypto.subtle.exportKey('raw', myKeyPair.publicKey);
}

async function deriveSharedKey(remotePubKeyBuffer) {
  const importedKey = await crypto.subtle.importKey(
    'raw',
    remotePubKeyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: importedKey },
    myKeyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(peerId, plaintext) {
  const key = sharedKeys[peerId];
  if (!key) return { encrypted: null, plain: plaintext }; // fallback unencrypted
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plaintext));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    encrypted: true,
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipherBuf))
  };
}

export async function decryptMessage(peerId, data) {
  const key = sharedKeys[peerId];
  if (!key || !data.encrypted) return data.plain || data;
  const iv = new Uint8Array(data.iv);
  const cipher = new Uint8Array(data.cipher).buffer;
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// ─── Callbacks ─────────────────────────────────────────────────────────────
let onMessage = null;
let onPresenceChange = null;
let _incomingCallHandler = null; // module-level, always fresh

export const setOnMessage = (fn) => { onMessage = fn; };
export const setOnPresenceChange = (fn) => { onPresenceChange = fn; };
export const setOnIncomingCall = (fn) => { _incomingCallHandler = fn; };
export const getPeer = () => peer;

// ─── Data connection helpers ────────────────────────────────────────────────
function _setupDataConn(conn) {
  const rid = conn.peer;

  conn.on('open', async () => {
    // Mark them online
    if (onPresenceChange) onPresenceChange(rid, true);

    // Step 1: Send them our ECDH public key so they can derive a shared AES key
    const pubKeyBuffer = await exportMyPublicKey();
    conn.send({ type: 'key_exchange', key: Array.from(new Uint8Array(pubKeyBuffer)) });

    // Step 2: Send our presence ping
    conn.send({ type: 'presence', isActive: true });
  });

  conn.on('data', async (data) => {
    if (data.type === 'key_exchange') {
      // Derive shared key from their public key
      const theirPubBuf = new Uint8Array(data.key).buffer;
      peerPublicKeys[rid] = theirPubBuf;
      sharedKeys[rid] = await deriveSharedKey(theirPubBuf);
      console.log('[E2EE] Shared AES key established with', rid);
    } else if (data.type === 'presence') {
      if (onPresenceChange) onPresenceChange(rid, data.isActive);
    } else if (data.type === 'message' && onMessage) {
      const decrypted = await decryptMessage(rid, data.payload);
      onMessage(decrypted);
    }
  });

  conn.on('close', () => {
    delete connections[rid];
    delete sharedKeys[rid];
    if (onPresenceChange) onPresenceChange(rid, false);
  });

  conn.on('error', (err) => {
    console.error('[PeerJS] DataConn error with', rid, err);
    delete connections[rid];
    if (onPresenceChange) onPresenceChange(rid, false);
  });
}

// ─── Init ───────────────────────────────────────────────────────────────────
export const initPeer = (peerId, knownContactIds = []) => {
  return new Promise(async (resolve) => {
    await initCrypto();

    peer = new Peer(peerId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/'
    });

    peer.on('open', (id) => {
      console.log('[PeerJS] Online as:', id);

      // Proactively connect to all known contacts for presence detection
      knownContactIds.forEach((cid) => {
        if (!connections[cid]) {
          try {
            const conn = peer.connect(cid, { reliable: true });
            connections[cid] = conn;
            _setupDataConn(conn);
          } catch (e) {
            console.warn('[PeerJS] Could not pre-connect to', cid);
          }
        }
      });

      resolve(id);
    });

    // Handle inbound data connections
    peer.on('connection', (conn) => {
      const rid = conn.peer;
      // If we already have one, close old and use new
      if (connections[rid]) connections[rid].close();
      connections[rid] = conn;
      _setupDataConn(conn);
    });

    // Handle inbound calls — always use the latest handler
    peer.on('call', (call) => {
      if (_incomingCallHandler) _incomingCallHandler(call);
    });

    peer.on('error', (err) => console.error('[PeerJS] Error:', err));
  });
};

// ─── Connect / Send ─────────────────────────────────────────────────────────
export const connectToPeer = (remotePeerId) => {
  if (connections[remotePeerId]?.open) return connections[remotePeerId];
  const conn = peer.connect(remotePeerId, { reliable: true });
  connections[remotePeerId] = conn;
  _setupDataConn(conn);
  return conn;
};

export const sendMessage = async (remotePeerId, messagePayload) => {
  const encPayload = await encryptMessage(remotePeerId, messagePayload);

  const doSend = (conn) => conn.send({ type: 'message', payload: encPayload });

  const conn = connections[remotePeerId];
  if (conn && conn.open) {
    doSend(conn);
  } else {
    const newConn = connectToPeer(remotePeerId);
    newConn.on('open', () => doSend(newConn));
  }
};

// ─── Calling (WebRTC = DTLS-SRTP = E2EE for media) ─────────────────────────
export const callPeer = async (remotePeerId, videoEnabled = false) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: videoEnabled,
    audio: true
  });
  const call = peer.call(remotePeerId, stream);
  callConnections[remotePeerId] = { call, stream };
  return { call, stream };
};

export const answerCall = async (incomingCall, videoEnabled = false) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: videoEnabled,
    audio: true
  });
  incomingCall.answer(stream);
  callConnections[incomingCall.peer] = { call: incomingCall, stream };
  return { call: incomingCall, stream };
};

export const endCall = (remotePeerId) => {
  const entry = callConnections[remotePeerId];
  if (entry) {
    try { entry.call.close(); } catch (e) {}
    entry.stream.getTracks().forEach(t => t.stop());
    delete callConnections[remotePeerId];
  }
};

export const destroyPeer = () => {
  // Broadcast offline presence before leaving
  Object.values(connections).forEach(conn => {
    try { if (conn.open) conn.send({ type: 'presence', isActive: false }); } catch (e) {}
  });
  if (peer) peer.destroy();
};
