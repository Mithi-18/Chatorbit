import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { setOnIncomingCall, callPeer, answerCall, endCall } from '../lib/peerService';
import { Phone, PhoneOff, Video, MicOff, VideoOff } from 'lucide-react';

export default function CallHandler() {
  const { contacts } = useStore();
  const [status, setStatus] = useState(null); // 'incoming' | 'outgoing' | 'connected'
  const [callInfo, setCallInfo] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localStreamRef = useRef(null);
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();

  // Always keep the incoming call handler up-to-date
  useEffect(() => {
    setOnIncomingCall((call) => {
      const match = contacts.find(c => c.id === call.peer);
      setCallInfo({ id: call.peer, name: match?.name || call.peer, call });
      setStatus('incoming');
    });
  }, [contacts]);

  // Listen for outgoing call trigger from ChatView
  useEffect(() => {
    const handleStartCall = async (e) => {
      const { targetId, targetName, videoEnabled } = e.detail;

      setCallInfo({ id: targetId, name: targetName });
      setStatus('outgoing');

      try {
        const { call, stream } = await callPeer(targetId, videoEnabled);
        localStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        call.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          setStatus('connected');
        });

        call.on('close', () => handleEnd(targetId));
        call.on('error', () => handleEnd(targetId));

        setCallInfo(prev => ({ ...prev, call }));
      } catch (err) {
        console.error('[Call] Failed to start call:', err);
        handleEnd(targetId);
      }
    };

    window.addEventListener('start_call', handleStartCall);
    return () => window.removeEventListener('start_call', handleStartCall);
  }, []);

  const handleAnswer = async () => {
    if (!callInfo?.call) return;
    try {
      const { call, stream } = await answerCall(callInfo.call, true);
      localStreamRef.current = stream;
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        setStatus('connected');
      });

      call.on('close', () => handleEnd(callInfo.id));
      call.on('error', () => handleEnd(callInfo.id));
    } catch (err) {
      console.error('[Call] Failed to answer:', err);
    }
  };

  const handleEnd = (peerId) => {
    const id = peerId || callInfo?.id;
    if (id) endCall(id);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setStatus(null);
    setCallInfo(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsVideoOff(v => !v);
  };

  if (!status) return null;

  const avatarLetter = callInfo?.name?.[0]?.toUpperCase() || '?';

  return (
    <div className="call-modal">
      {status === 'connected' ? (
        <div className="video-container">
          <video ref={remoteVideoRef} autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
          <div className="local-video">
            <video ref={myVideoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          {/* Controls overlay */}
          <div style={{ position: 'absolute', bottom: '7rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '1rem' }}>
            <button onClick={toggleMute} style={{ background: isMuted ? '#ff4500' : 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <MicOff size={20} color="white" />
            </button>
            <button onClick={toggleVideo} style={{ background: isVideoOff ? '#ff4500' : 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <VideoOff size={20} color="white" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{
            width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, #ff8c00, #ff4500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', fontWeight: 700, color: 'white',
            marginBottom: '1.5rem', animation: 'pulse 2s infinite'
          }}>
            {avatarLetter}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{callInfo?.name}</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '3rem', fontSize: '0.95rem' }}>
            {status === 'incoming' ? '📞 Incoming call...' : '📡 Calling...'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginBottom: '2rem' }}>
            🔒 End-to-End Encrypted (WebRTC DTLS-SRTP)
          </p>
        </>
      )}

      <div className="call-actions">
        {status === 'incoming' && (
          <button className="call-btn accept" onClick={handleAnswer}>
            <Phone size={24} />
          </button>
        )}
        <button className="call-btn reject" onClick={() => handleEnd()}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
