import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ChevronLeft, Phone, Video } from 'lucide-react';
import ChatInput from '../components/ChatInput';

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeChat, setActiveChat, contacts, messages, setMessages } = useStore();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // If refreshed directly on /chat/:id
    if (!activeChat) {
      const contact = contacts.find(c => c.id === parseInt(id));
      if (contact) setActiveChat(contact);
      else {
        navigate('/');
        return;
      }
    }

    // Fetch message history
    const fetchHistory = async () => {
      try {
        const res = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/messages/${user.id}/${id}`);
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error('Failed to fetch messages');
      }
    };
    fetchHistory();
  }, [id, contacts, activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChat) return null;

  return (
    <div className="chat-view">
      <div className="chat-topbar">
        <ChevronLeft className="back-btn" onClick={() => navigate(-1)} size={28} />
        <div className="chat-topbar-info">
          <img 
            src={activeChat.profileImage ? `\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${activeChat.profileImage}` : 'https://i.pravatar.cc/150?u=' + activeChat.id} 
            className="topbar-avatar" 
            alt={activeChat.name}
          />
          <div>
            <div className="topbar-name">{activeChat.name}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              {activeChat.isActive ? 'Active now' : 'Offline'}
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-action-btn" onClick={() => window.dispatchEvent(new CustomEvent('start_call', { detail: { targetId: activeChat.id, targetName: activeChat.name } }))}>
            <Phone size={18} fill="white" />
          </div>
          <div className="topbar-action-btn" onClick={() => window.dispatchEvent(new CustomEvent('start_call', { detail: { targetId: activeChat.id, targetName: activeChat.name } }))}>
            <Video size={18} fill="white" />
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => {
          const isSent = msg.senderId === user.id;
          return (
            <div key={msg.id || i} className={`message ${isSent ? 'sent' : 'received'}`}>
              {msg.type === 'text' && <div>{msg.content}</div>}
              {msg.type === 'image' && <img src={`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${msg.mediaUrl}`} alt="Sent image" />}
              {msg.type === 'video' && <video src={`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${msg.mediaUrl}`} controls />}
              {msg.type === 'voice' && <audio src={`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${msg.mediaUrl}`} controls style={{ height: '30px' }} />}
              
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
