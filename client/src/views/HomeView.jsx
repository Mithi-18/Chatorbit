import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function HomeView() {
  const { user, contacts, setContacts, setActiveChat } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Fetch all contacts (simplified for demo: fetching all users except self)
    const fetchContacts = async () => {
      try {
        const res = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/users`);
        const data = await res.json();
        setContacts(data.filter(u => u.id !== user.id));
      } catch (err) {
        console.error('Failed to fetch contacts');
      }
    };
    fetchContacts();
  }, [user.id, setContacts]);

  const handleChatSelect = (contact) => {
    setActiveChat(contact);
    navigate(`/chat/${contact.id}`);
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="home-header">
        <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 700 }}>
          Let's Stay<br/>Connected
        </h1>
        <div className="search-bar">
          <Search size={18} color="rgba(255,255,255,0.7)" />
          <input 
            type="text" 
            placeholder="Search" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="stories-container">
          <div className="story-item">
            <div className="story-avatar add-story" style={{ color: 'white' }}>+</div>
            <span className="story-name">Add</span>
          </div>
          {contacts.filter(c => c.isActive).map(c => (
            <div className="story-item" key={`story-${c.id}`} onClick={() => handleChatSelect(c)}>
              <img src={c.profileImage ? `\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${c.profileImage}` : 'https://i.pravatar.cc/150?u=' + c.id} alt={c.name} className="story-avatar" />
              <span className="story-name">{c.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-list">
        {filteredContacts.map(contact => (
          <div className="chat-item" key={contact.id} onClick={() => handleChatSelect(contact)}>
            <div className="chat-avatar-container">
              <img 
                src={contact.profileImage ? `\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${contact.profileImage}` : 'https://i.pravatar.cc/150?u=' + contact.id} 
                alt={contact.name} 
                className="chat-avatar" 
              />
              <div className={`status-indicator ${contact.isActive ? 'active' : 'inactive'}`}></div>
            </div>
            <div className="chat-info">
              <div className="chat-header">
                <span className="chat-name">{contact.name}</span>
                <span className="chat-time">{contact.isActive ? 'Just Now' : 'Offline'}</span>
              </div>
              <div className="chat-last-msg">
                {/* Mocking last message for UI purposes */}
                Tap to start chatting
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
