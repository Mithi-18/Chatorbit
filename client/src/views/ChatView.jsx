import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ChevronLeft, Phone, Video } from 'lucide-react';
import ChatInput from '../components/ChatInput';

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, myPeerId, activeChat, setActiveChat, contacts, messages } = useStore();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!activeChat || activeChat.id !== id) {
      const contact = contacts.find(c => c.id === id);
      if (contact) setActiveChat(contact);
      else navigate('/');
    }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startCall = (video) => {
    window.dispatchEvent(new CustomEvent('start_call', {
      detail: { targetId: id, targetName: activeChat?.name, videoEnabled: video }
    }));
  };

  if (!activeChat) return null;

  return (
    <div className="chat-view">
      <div className="chat-topbar">
        <ChevronLeft className="back-btn" onClick={() => navigate(-1)} size={28} />
        <div className="chat-topbar-info">
          <div
            style={{
              width: 40, height: 40, borderRadius: '50%', marginRight: '0.8rem',
              background: activeChat.avatar ? `url(${activeChat.avatar}) center/cover` : '#555',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, flexShrink: 0
            }}
          >
            {!activeChat.avatar && activeChat.name[0]}
          </div>
          <div>
            <div className="topbar-name">{activeChat.name}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              {activeChat.isActive ? '🟢 Online' : '⚫ Offline'}
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-action-btn" onClick={() => startCall(false)}>
            <Phone size={18} fill="white" />
          </div>
          <div className="topbar-action-btn" onClick={() => startCall(true)}>
            <Video size={18} fill="white" />
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => {
          const isSent = msg.senderId === myPeerId;
          return (
            <div key={msg.id || i} className={`message ${isSent ? 'sent' : 'received'}`}>
              {msg.type === 'text' && <div>{msg.content}</div>}
              {msg.type === 'image' && <img src={msg.mediaData} alt="img" style={{ maxWidth: '100%', borderRadius: 10 }} />}
              {msg.type === 'video' && <video src={msg.mediaData} controls style={{ maxWidth: '100%', borderRadius: 10 }} />}
              {msg.type === 'voice' && <audio src={msg.mediaData} controls style={{ height: 30 }} />}
              <span className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput activeChat={activeChat} />
    </div>
  );
}
