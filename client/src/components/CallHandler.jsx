import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { setOnIncomingCall, callPeer, answerCall, endCall } from '../lib/peerService';
import { Phone, PhoneOff, Video } from 'lucide-react';

export default function CallHandler() {
  const { contacts } = useStore();
  const [status, setStatus] = useState(null); // 'incoming' | 'outgoing' | 'connected'
  const [callInfo, setCallInfo] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    setOnIncomingCall((call) => {
      const contact = contacts.find(c => c.id === call.peer) || { name: call.peer };
      setCallInfo({ id: call.peer, name: contact.name, call });
      setStatus('incoming');
    });

    const handleStartCall = async (e) => {
      const { targetId, targetName, videoEnabled } = e.detail;
      setCallInfo({ id: targetId, name: targetName });
      setStatus('outgoing');
      const { call, stream } = await callPeer(targetId, videoEnabled);
      setLocalStream(stream);
      setCurrentCall(call);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        setStatus('connected');
      });
      call.on('close', handleEnd);
    };

    window.addEventListener('start_call', handleStartCall);
    return () => window.removeEventListener('start_call', handleStartCall);
  }, [contacts]);

  const handleAnswer = async () => {
    const { call, stream } = await answerCall(callInfo.call, true);
    setLocalStream(stream);
    setCurrentCall(call);
    if (myVideoRef.current) myVideoRef.current.srcObject = stream;
    call.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      setStatus('connected');
    });
    call.on('close', handleEnd);
  };

  const handleEnd = () => {
    if (callInfo?.id) endCall(callInfo.id);
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setStatus(null);
    setCallInfo(null);
    setCurrentCall(null);
    setLocalStream(null);
  };

  if (!status) return null;

  return (
    <div className="call-modal">
      {status !== 'connected' && (
        <>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: '1.5rem', animation: 'pulse 2s infinite' }}>
            {callInfo?.name?.[0] || '?'}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{callInfo?.name}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {status === 'incoming' ? 'Incoming call...' : 'Calling...'}
          </p>
        </>
      )}

      {status === 'connected' && (
        <div className="video-container">
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div className="local-video">
            <video ref={myVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      )}

      <div className="call-actions">
        {status === 'incoming' && (
          <button className="call-btn accept" onClick={handleAnswer}>
            <Phone size={24} />
          </button>
        )}
        <button className="call-btn reject" onClick={handleEnd}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
