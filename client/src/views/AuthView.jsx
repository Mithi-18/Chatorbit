import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Camera } from 'lucide-react';

export default function AuthView() {
  const navigate = useNavigate();
  const { initUser } = useStore();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarData, setAvatarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarData(ev.target.result);
      setAvatarPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleStart = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    await initUser({ name: name.trim(), bio: bio.trim(), avatar: avatarData });
    navigate('/');
  };

  return (
    <div className="auth-container">
      <h1 className="auth-header">Join Chatorbit</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
        No account needed. Your unique Peer ID is created instantly.<br/>
        Share it with friends to start chatting!
      </p>

      {/* Avatar Picker */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div
          onClick={() => fileRef.current.click()}
          style={{
            width: 90, height: 90, borderRadius: '50%',
            background: avatarPreview ? `url(${avatarPreview}) center/cover no-repeat` : 'var(--bg-input)',
            border: '3px solid #ff6b00',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '2rem'
          }}
        >
          {!avatarPreview && <Camera size={30} color="#666" />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      <div className="input-group">
        <input
          type="text" placeholder="Your Display Name"
          value={name} onChange={e => setName(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleStart()}
        />
      </div>
      <div className="input-group">
        <input
          type="text" placeholder="Bio (optional)"
          value={bio} onChange={e => setBio(e.target.value)}
        />
      </div>

      <button className="btn-primary" onClick={handleStart} disabled={!name.trim() || loading}>
        {loading ? 'Setting up...' : 'Start Chatting →'}
      </button>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
        🔒 Your data stays on your device. Nothing is uploaded to any server.
      </p>
    </div>
  );
}
