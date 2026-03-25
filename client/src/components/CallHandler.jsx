import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { socket } from '../lib/socket';
import Peer from 'simple-peer';
import { PhoneOff, Phone, Video } from 'lucide-react';

export default function CallHandler() {
  const { user, contacts } = useStore();
  const [callStatus, setCallStatus] = useState(null); // 'incoming', 'outgoing', 'connected'
  const [callData, setCallData] = useState(null);
  const [stream, setStream] = useState(null);
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    if (!user) return;

    socket.on('call_incoming', ({ from, signal }) => {
      setCallStatus('incoming');
      const caller = contacts.find(c => c.id === from);
      setCallData({ callerId: from, callerName: caller?.name || 'Unknown', signal });
    });

    socket.on('call_accepted', (signal) => {
      setCallStatus('connected');
      connectionRef.current.signal(signal);
    });

    // Custom event emitted from ChatView to start a call
    const handleStartCall = async (e) => {
      const { targetId, targetName } = e.detail;
      await setupStream();
      setCallStatus('outgoing');
      setCallData({ callerName: targetName, callerId: targetId });

      const peer = new Peer({ initiator: true, trickled: false, stream: myVideo.current?.srcObject || null });
      
      peer.on('signal', (signalData) => {
        socket.emit('call_user', { userToCall: targetId, signalData, from: user.id });
      });

      peer.on('stream', (currentStream) => {
        if (userVideo.current) userVideo.current.srcObject = currentStream;
      });

      connectionRef.current = peer;
    };

    window.addEventListener('start_call', handleStartCall);

    return () => {
      socket.off('call_incoming');
      socket.off('call_accepted');
      window.removeEventListener('start_call', handleStartCall);
    };
  }, [user, contacts]);

  const setupStream = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      setTimeout(() => {
        if (myVideo.current) myVideo.current.srcObject = currentStream;
      }, 500);
      return currentStream;
    } catch (err) {
      console.error('Failed to get local stream', err);
    }
  };

  const answerCall = async () => {
    const currentStream = await setupStream();
    setCallStatus('connected');

    const peer = new Peer({ initiator: false, trickled: false, stream: currentStream });

    peer.on('signal', (signal) => {
      socket.emit('answer_call', { signal, to: callData.callerId });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) userVideo.current.srcObject = currentStream;
    });

    peer.signal(callData.signal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    setCallStatus(null);
    setCallData(null);
    if (connectionRef.current) connectionRef.current.destroy();
  };

  if (!callStatus) return null;

  return (
    <div className="call-modal">
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
        {callStatus === 'incoming' && `${callData?.callerName} is calling...`}
        {callStatus === 'outgoing' && `Calling ${callData?.callerName}...`}
        {callStatus === 'connected' && `In call with ${callData?.callerName}`}
      </h2>

      {callStatus !== 'connected' && (
        <img 
           src={`https://i.pravatar.cc/150?u=${callData?.callerId}`} 
           className="call-avatar" alt="caller"
        />
      )}

      {callStatus === 'connected' && (
        <div className="video-container">
          <video playsInline ref={userVideo} autoPlay />
          <div className="local-video">
            <video playsInline ref={myVideo} autoPlay muted />
          </div>
        </div>
      )}

      <div className="call-actions">
        {callStatus === 'incoming' && (
          <button className="call-btn accept" onClick={answerCall}>
            <Phone size={24} />
          </button>
        )}
        <button className="call-btn reject" onClick={leaveCall} style={{ backgroundColor: 'red' }}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
