import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Paperclip, Send, Mic, Smile, X } from 'lucide-react';
import { sendMessage } from '../lib/peerService';
import EmojiPicker from 'emoji-picker-react';
import { v4 as uuidv4 } from 'uuid';

const fileToBase64 = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

export default function ChatInput({ activeChat }) {
  const { myPeerId, addMessage } = useStore();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const fileInputRef = useRef();
  const mediaRecorderRef = useRef();
  const audioChunksRef = useRef([]);

  const buildAndSend = async ({ type, content = null, mediaFile = null }) => {
    let mediaData = null;
    let msgType = type;

    if (mediaFile) {
      mediaData = await fileToBase64(mediaFile);
      msgType = mediaFile.type.startsWith('image/') ? 'image' :
                mediaFile.type.startsWith('video/') ? 'video' : 'voice';
    }

    const msg = {
      id: uuidv4(),
      senderId: myPeerId,
      receiverId: activeChat.id,
      content,
      mediaData,
      type: msgType,
      createdAt: new Date().toISOString(),
    };

    // store locally
    await addMessage(msg);
    // send over P2P
    sendMessage(activeChat.id, msg);
  };

  const handleSend = async () => {
    if (!input.trim() && !mediaFile) return;
    await buildAndSend({ type: 'text', content: input, mediaFile });
    setInput('');
    setMediaFile(null);
    setShowEmoji(false);
  };

  const handleEmojiClick = (emojiData) => setInput(prev => prev + emojiData.emoji);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setMediaFile(e.target.files[0]);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setMediaFile(new File([blob], 'voice.webm', { type: 'audio/webm' }));
    };
    mediaRecorderRef.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    setRecording(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      {showEmoji && (
        <div style={{ position: 'absolute', bottom: 70, left: 10, zIndex: 10 }}>
          <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" height={350} />
        </div>
      )}
      {mediaFile && (
        <div style={{ position: 'absolute', bottom: 70, right: 10, background: 'var(--bg-card)', padding: '0.5rem 0.8rem', borderRadius: 10, border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mediaFile.name}</span>
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
            placeholder={recording ? 'Recording...' : 'Your Message...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            disabled={recording}
          />
          <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*,audio/*" />
          <button className="icon-btn" onClick={() => fileInputRef.current.click()}>
            <Paperclip size={20} />
          </button>
        </div>
        {input.trim() || mediaFile ? (
          <button className="send-btn" onClick={handleSend}><Send size={20} /></button>
        ) : (
          <button className="send-btn" onClick={recording ? stopRecording : startRecording}
            style={{ backgroundColor: recording ? 'red' : undefined }}>
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
