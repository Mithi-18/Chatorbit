import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, UserPlus } from 'lucide-react';
import { connectToPeer } from '../lib/peerService';

const Avatar = ({ src, name, size = 50 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: src ? `url(${src}) center/cover no-repeat` : 'linear-gradient(135deg,#ff8c00,#ff4500)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: size * 0.4
  }}>
    {!src && name?.[0]?.toUpperCase()}
  </div>
);

export default function HomeView() {
  const { profile, myPeerId, contacts, unread, addContact, setActiveChat } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [addPeerId, setAddPeerId] = useState('');
  const [addName, setAddName]  = useState('');
  const [showAdd, setShowAdd]  = useState(false);
  const [copied, setCopied]    = useState(false);
  const [adding, setAdding]    = useState(false);

  const copyMyId = () => {
    navigator.clipboard.writeText(myPeerId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAddContact = async () => {
    if (!addPeerId.trim() || !addName.trim() || adding) return;
    setAdding(true);
    const contact = { id: addPeerId.trim(), name: addName.trim() };
    await addContact(contact);
    connectToPeer(contact.id);
    setAddPeerId(''); setAddName(''); setShowAdd(false);
    setAdding(false);
  };

  const handleChatSelect = (contact) => {
    setActiveChat(contact);
    navigate(`/chat/${contact.id}`);
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );
  const activeContacts = contacts.filter(c => c.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2 }}>
            Let's Stay<br />Connected
          </h1>
          <Avatar src={profile?.avatar} name={profile?.name} size={44} />
        </div>

        {/* My Peer ID */}
        <div onClick={copyMyId} style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '0.5rem 1rem',
          marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer'
        }}>
          <span style={{ color: 'white', fontSize: '0.72rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            My ID: <b>{myPeerId}</b>
          </span>
          <span style={{ color: copied ? '#aaffaa' : 'rgba(255,255,255,0.7)', fontSize: '0.75rem', flexShrink: 0 }}>
            {copied ? '✓ Copied' : <Copy size={13} />}
          </span>
        </div>

        {/* Search */}
        <div className="search-bar" style={{ marginTop: '0.8rem' }}>
          <Search size={16} color="rgba(255,255,255,0.7)" />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Online stories row */}
        {activeContacts.length > 0 && (
          <div className="stories-container" style={{ marginTop: '0.8rem' }}>
            {activeContacts.map(c => (
              <div key={c.id} className="story-item" onClick={() => handleChatSelect(c)}>
                <Avatar src={c.avatar} name={c.name} size={56} />
                <span className="story-name">{c.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add contact */}
      {showAdd ? (
        <div style={{ margin: '0.8rem', background: 'var(--bg-card)', borderRadius: 16, padding: '1rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.7rem' }}>
            Ask your friend for their Peer ID and paste it below.
          </p>
          <input type="text" placeholder="Friend's Peer ID (orbit-...)" value={addPeerId}
            onChange={e => setAddPeerId(e.target.value)}
            style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'white', marginBottom: '0.5rem', boxSizing: 'border-box' }} />
          <input type="text" placeholder="Nickname for this contact" value={addName}
            onChange={e => setAddName(e.target.value)}
            style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'white', marginBottom: '0.5rem', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ flex: 1, padding: '0.7rem' }} onClick={handleAddContact} disabled={adding}>
              {adding ? 'Adding...' : 'Add Contact'}
            </button>
            <button className="btn-primary" style={{ flex: 1, padding: '0.7rem', background: '#2a2d36' }} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} style={{
          margin: '0.8rem', padding: '0.7rem', borderRadius: 12,
          background: 'transparent', border: '1px dashed #555',
          color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem'
        }}>
          <UserPlus size={18} /> Add Contact by Peer ID
        </button>
      )}

      {/* Contact list */}
      <div className="chat-list">
        {filtered.length === 0 && !showAdd && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', padding: '0 2rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
            No contacts yet.<br />Add a friend using their Peer ID to get started!
          </p>
        )}
        {filtered.map(c => {
          const count = unread?.[c.id] || 0;
          return (
          <div key={c.id} className="chat-item" onClick={() => handleChatSelect(c)}>
            <div className="chat-avatar-container">
              <Avatar src={c.avatar} name={c.name} size={50} />
              <div className={`status-indicator ${c.isActive ? 'active' : 'inactive'}`} />
            </div>
            <div className="chat-info">
              <div className="chat-header">
                <span className="chat-name">{c.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {count > 0 && (
                    <span style={{
                      background: '#ff4500', color: 'white', borderRadius: '50%',
                      minWidth: 20, height: 20, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, padding: '0 4px'
                    }}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                  <span className="chat-time" style={{ color: c.isActive ? '#00dd88' : 'var(--text-secondary)' }}>
                    {c.isActive ? '● Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="chat-last-msg" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                {c.id}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
