import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Paperclip, Send, Mic, Smile, X } from 'lucide-react';
import { socket } from '../lib/socket';
import EmojiPicker from 'emoji-picker-react';

export default function ChatInput({ activeChat }) {
  const { user } = useStore();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleSend = async () => {
    if (!input.trim() && !mediaFile) return;

    let mediaUrl = null;
    let type = 'text';

    if (mediaFile) {
      const formData = new FormData();
      formData.append('mediaFile', mediaFile);
      
      try {
        const res = await fetch('http://localhost:5000/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        mediaUrl = data.url;
        type = mediaFile.type.startsWith('image/') ? 'image' : 
               mediaFile.type.startsWith('video/') ? 'video' : 'voice';
      } catch (err) {
        console.error('Upload failed', err);
        return;
      }
    }

    const msgData = {
      senderId: user.id,
      receiverId: activeChat.id,
      content: input,
      mediaUrl,
      type
    };

    socket.emit('send_message', msgData);
    
    setInput('');
    setMediaFile(null);
    setShowEmoji(false);
  };

  const handleEmojiClick = (emojiData) => {
    setInput(prev => prev + emojiData.emoji);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        setMediaFile(file);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {showEmoji && (
        <div style={{ position: 'absolute', bottom: '70px', left: '10px', zIndex: 10 }}>
          <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
        </div>
      )}

      {mediaFile && (
        <div style={{ position: 'absolute', bottom: '70px', right: '10px', background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '10px', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem' }}>{mediaFile.name}</span>
          <X size={16} style={{ cursor: 'pointer' }} onClick={() => setMediaFile(null)} />
        </div>
      )}

      <div className="chat-input-area">
        <button className="icon-btn" onClick={() => setShowEmoji(!showEmoji)}>
          <Smile size={24} />
        </button>

        <div className="input-wrapper">
          <input 
            type="text" 
            placeholder={recording ? "Recording..." : "Your Message..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            disabled={recording}
          />
          <input 
            type="file" 
            style={{ display: 'none' }} 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="image/*,video/*,audio/*"
          />
          <button className="icon-btn" style={{ marginRight: '0.5rem' }} onClick={() => fileInputRef.current.click()}>
            <Paperclip size={20} />
          </button>
        </div>

        {input.trim() || mediaFile ? (
          <button className="send-btn" onClick={handleSend}>
            <Send size={20} />
          </button>
        ) : (
          <button 
            className="send-btn" 
            onClick={recording ? stopRecording : startRecording}
            style={{ backgroundColor: recording ? 'red' : 'var(--bg-input)' }}
          >
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
