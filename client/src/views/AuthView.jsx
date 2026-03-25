import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Camera, User } from 'lucide-react';

export default function AuthView() {
  const navigate = useNavigate();
  const { initUser } = useStore();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatar(ev.target.result);
      setAvatarPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleStart = () => {
    if (!name.trim()) return;
    initUser({ name, bio, avatar });
    navigate('/');
  };

  return (
    <div className="auth-container">
      <h1 className="auth-header">Join Chatorbit</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Set up your profile. Your unique ID is generated for you — share it with friends to chat!
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <div
          onClick={() => fileRef.current.click()}
          style={{
            width: 90, height: 90, borderRadius: '50%',
            background: avatarPreview ? `url(${avatarPreview}) center/cover` : 'var(--bg-input)',
            border: '3px solid var(--accent-orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative'
          }}
        >
          {!avatarPreview && <Camera size={28} color="var(--text-secondary)" />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      <div className="input-group">
        <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="input-group">
        <input type="text" placeholder="Bio (optional)" value={bio} onChange={e => setBio(e.target.value)} />
      </div>

      <button className="btn-primary" onClick={handleStart} disabled={!name.trim()}>
        Start Chatting →
      </button>
    </div>
  );
}
