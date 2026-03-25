import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, UserPlus } from 'lucide-react';
import { connectToPeer } from '../lib/peerService';

export default function HomeView() {
  const { profile, myPeerId, contacts, addContact, setActiveChat } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [addPeerId, setAddPeerId] = useState('');
  const [addName, setAddName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyMyId = () => {
    navigator.clipboard.writeText(myPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddContact = async () => {
    if (!addPeerId.trim() || !addName.trim()) return;
    const contact = { id: addPeerId.trim(), name: addName.trim(), isActive: false };
    await addContact(contact);
    // Pre-connect so we get presence events
    connectToPeer(contact.id);
    setAddPeerId('');
    setAddName('');
    setShowAdd(false);
  };

  const handleChatSelect = (contact) => {
    setActiveChat(contact);
    navigate(`/chat/${contact.id}`);
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="home-header">
        <h1 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 700 }}>
          Let's Stay<br />Connected
        </h1>

        {/* My Peer ID card */}
        <div
          onClick={copyMyId}
          style={{
            background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '0.6rem 1rem',
            marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            cursor: 'pointer', userSelect: 'none'
          }}
        >
          <span style={{ color: 'white', fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📋 My ID: <b>{myPeerId}</b>
          </span>
          <Copy size={14} color="white" />
          {copied && <span style={{ color: '#aaffaa', fontSize: '0.75rem' }}>Copied!</span>}
        </div>

        <div className="search-bar" style={{ marginTop: '0.8rem' }}>
          <Search size={18} color="rgba(255,255,255,0.7)" />
          <input type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Active user stories */}
        {contacts.filter(c => c.isActive).length > 0 && (
          <div className="stories-container" style={{ marginTop: '0.8rem' }}>
            {contacts.filter(c => c.isActive).map(c => (
              <div className="story-item" key={c.id} onClick={() => handleChatSelect(c)}>
                <div className="story-avatar" style={{ background: c.avatar ? `url(${c.avatar}) center/cover` : '#555' }}>
                  {!c.avatar && <span style={{ fontSize: '1.2rem' }}>{c.name[0]}</span>}
                </div>
                <span className="story-name">{c.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add contact */}
      {showAdd ? (
        <div style={{ padding: '1rem', background: 'var(--bg-card)', margin: '1rem', borderRadius: '16px' }}>
          <input className="input-group" type="text" placeholder="Friend's Peer ID" value={addPeerId}
            onChange={e => setAddPeerId(e.target.value)}
            style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'white', marginBottom: '0.5rem' }} />
          <input type="text" placeholder="Give them a name" value={addName}
            onChange={e => setAddName(e.target.value)}
            style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'white', marginBottom: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddContact}>Add</button>
            <button className="btn-primary" style={{ flex: 1, background: '#333' }} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          style={{ margin: '1rem', padding: '0.8rem', borderRadius: 12, background: 'var(--bg-card)', border: '1px dashed #555', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <UserPlus size={18} /> Add a Contact by Peer ID
        </button>
      )}

      <div className="chat-list" style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', padding: '0 2rem' }}>
            <p>No contacts yet!</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Share your Peer ID with a friend and ask for theirs to start chatting.</p>
          </div>
        )}
        {filtered.map(contact => (
          <div className="chat-item" key={contact.id} onClick={() => handleChatSelect(contact)}>
            <div className="chat-avatar-container">
              <div className="chat-avatar" style={{ background: contact.avatar ? `url(${contact.avatar}) center/cover` : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.2rem' }}>
                {!contact.avatar && contact.name[0]}
              </div>
              <div className={`status-indicator ${contact.isActive ? 'active' : 'inactive'}`}></div>
            </div>
            <div className="chat-info">
              <div className="chat-header">
                <span className="chat-name">{contact.name}</span>
                <span className="chat-time">{contact.isActive ? 'Online' : 'Offline'}</span>
              </div>
              <div className="chat-last-msg">{contact.id}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
