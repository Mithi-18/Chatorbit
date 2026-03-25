import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import {
  initPeer, setOnMessage, setOnPresenceChange, destroyPeer, connectToPeer
} from './lib/peerService';
import {
  requestNotificationPermission, playNotificationSound,
  showPushNotification, showInAppToast
} from './lib/notifications';

import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import ChatView from './views/ChatView';
import CallHandler from './components/CallHandler';

function App() {
  const {
    myPeerId, profile, contacts, appLoading,
    loadData, addMessage, updateContactPresence, incrementUnread
  } = useStore();
  
  const peerInitialized = useRef(false);
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;  // always up-to-date without re-running effect

  // ── Load data from IndexedDB on mount ────────────────────────────
  useEffect(() => {
    loadData();
  }, []);

  // ── Initialize PeerJS ONCE when user is ready ────────────────────
  useEffect(() => {
    if (!myPeerId || appLoading || peerInitialized.current) return;
    peerInitialized.current = true;

    // Request OS notification permission once
    requestNotificationPermission();

    setOnMessage(async (msg) => {
      const store = useStore.getState();
      await store.addMessage(msg);
      store.incrementUnread(msg.senderId);

      // Find sender name
      const sender = store.contacts.find(c => c.id === msg.senderId);
      const senderName = sender?.name || 'Someone';

      // Detect if user is currently reading this chat
      const isReadingThisChat = store.activeChat?.id === msg.senderId
        && document.visibilityState === 'visible';

      if (!isReadingThisChat) {
        // 🔊 Play ping sound
        playNotificationSound();

        // 📢 OS push notification (when tab is in background)
        const preview = msg.type === 'text'
          ? (msg.content || '')
          : msg.type === 'voice' ? '🎙 Voice message'
          : msg.type === 'image' ? '🖼 Image'
          : msg.type === 'video' ? '🎬 Video'
          : 'New message';

        showPushNotification(senderName, preview, sender?.avatar);

        // 🟠 In-app toast (when tab is visible but in different chat / home)
        if (document.visibilityState === 'visible') {
          showInAppToast(senderName, preview, () => {
            store.setActiveChat(sender || { id: msg.senderId, name: senderName });
            window.location.hash = `/chat/${msg.senderId}`;
          });
        }
      }
    });

    setOnPresenceChange((id, isActive) => useStore.getState().updateContactPresence(id, isActive));

    const contactIds = contactsRef.current.map(c => c.id);
    initPeer(myPeerId, contactIds);

    return () => {
      peerInitialized.current = false;
      destroyPeer();
    };
  }, [myPeerId, appLoading]);

  // ── When a NEW contact is added, connect to them without reiniting ──
  useEffect(() => {
    if (!peerInitialized.current) return;
    contacts.forEach(c => connectToPeer(c.id));
  }, [contacts.length]);

  if (appLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: '1rem'
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          border: '4px solid #ff6b00', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Chatorbit...</p>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/"        element={profile ? <HomeView />  : <Navigate to="/setup" />} />
        <Route path="/setup"   element={!profile ? <AuthView /> : <Navigate to="/" />} />
        <Route path="/chat/:id" element={profile ? <ChatView /> : <Navigate to="/setup" />} />
      </Routes>
      <CallHandler />
    </>
  );
}

export default App;
