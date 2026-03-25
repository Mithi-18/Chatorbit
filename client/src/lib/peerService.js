import Peer from 'peerjs';

let peer = null;
const connections = {}; // peerId -> DataConnection
const callConnections = {}; // peerId -> MediaConnection

// Callbacks set from outside
let onMessage = null;
let onPresenceChange = null;
let onIncomingCall = null;

export const initPeer = (peerId) => {
  return new Promise((resolve) => {
    peer = new Peer(peerId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/'
    });

    peer.on('open', (id) => {
      console.log('[PeerJS] Opened with ID:', id);
      resolve(id);
    });

    // On incoming data connection (someone messaging us)
    peer.on('connection', (conn) => {
      _setupDataConn(conn);
    });

    // On incoming call (video/voice)
    peer.on('call', (call) => {
      if (onIncomingCall) onIncomingCall(call);
    });

    peer.on('error', (err) => console.error('[PeerJS] Error:', err));
  });
};

const _setupDataConn = (conn) => {
  const remotePeerId = conn.peer;
  connections[remotePeerId] = conn;
  
  conn.on('open', () => {
    // Notify them we are online
    if (onPresenceChange) onPresenceChange(remotePeerId, true);
  });
  
  conn.on('data', (data) => {
    if (data.type === 'message' && onMessage) {
      onMessage(data.payload);
    } else if (data.type === 'presence') {
      if (onPresenceChange) onPresenceChange(remotePeerId, data.isActive);
    }
  });
  
  conn.on('close', () => {
    delete connections[remotePeerId];
    if (onPresenceChange) onPresenceChange(remotePeerId, false);
  });
};

export const connectToPeer = (remotePeerId) => {
  if (connections[remotePeerId]) return connections[remotePeerId];

  const conn = peer.connect(remotePeerId, { reliable: true });
  connections[remotePeerId] = conn;
  _setupDataConn(conn);
  return conn;
};

export const sendMessage = (remotePeerId, messagePayload) => {
  const conn = connections[remotePeerId];
  if (conn && conn.open) {
    conn.send({ type: 'message', payload: messagePayload });
    return true;
  } else {
    // Try to re-connect
    const newConn = connectToPeer(remotePeerId);
    const tryOnOpen = () => { 
      newConn.send({ type: 'message', payload: messagePayload }); 
    };
    newConn.on('open', tryOnOpen);
    return false;
  }
};

export const callPeer = async (remotePeerId, videoEnabled = false) => {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: videoEnabled, 
    audio: true 
  });
  const call = peer.call(remotePeerId, stream);
  callConnections[remotePeerId] = { call, stream };
  return { call, stream };
};

export const answerCall = async (call, videoEnabled = false) => {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: videoEnabled, 
    audio: true 
  });
  call.answer(stream);
  callConnections[call.peer] = { call, stream };
  return { call, stream };
};

export const endCall = (remotePeerId) => {
  const entry = callConnections[remotePeerId];
  if (entry) {
    entry.call.close();
    entry.stream.getTracks().forEach(t => t.stop());
    delete callConnections[remotePeerId];
  }
};

export const destroyPeer = () => {
  if (peer) peer.destroy();
};

export const setOnMessage = (fn) => { onMessage = fn; };
export const setOnPresenceChange = (fn) => { onPresenceChange = fn; };
export const setOnIncomingCall = (fn) => { onIncomingCall = fn; };
export const getPeer = () => peer;
