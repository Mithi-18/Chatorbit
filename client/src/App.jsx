import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { initPeer, setOnMessage, setOnPresenceChange, setOnIncomingCall, destroyPeer } from './lib/peerService';

import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import ChatView from './views/ChatView';
import CallHandler from './components/CallHandler';

function App() {
  const { myPeerId, profile, contacts, loadData, addMessage, updateContactPresence } = useStore();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!myPeerId) return;

    const contactIds = contacts.map(c => c.id);

    // Set up callbacks BEFORE connecting so we never miss events
    setOnMessage((msg) => addMessage(msg));
    setOnPresenceChange((id, isActive) => updateContactPresence(id, isActive));

    initPeer(myPeerId, contactIds);

    return () => destroyPeer();
  }, [myPeerId, contacts.length]); // re-init when a new contact is added

  return (
    <>
      <Routes>
        <Route path="/" element={profile ? <HomeView /> : <Navigate to="/setup" />} />
        <Route path="/setup" element={!profile ? <AuthView /> : <Navigate to="/" />} />
        <Route path="/chat/:id" element={profile ? <ChatView /> : <Navigate to="/setup" />} />
      </Routes>
      <CallHandler />
    </>
  );
}

export default App;
