import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { connectSocket, disconnectSocket, socket } from './lib/socket';

// Placeholder Imports
import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import ChatView from './views/ChatView';
import CallHandler from './components/CallHandler';

function App() {
  const { user, token, setUser, logout } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && !user) {
      // Fetch user profile based on token (mocked fetching process for now)
      // For immediate dev, we rely on the user object being set upon login.
      // If refreshed, they need to log in again since we don't have a /me endpoint yet in this simple example.
      // Easiest fix: create /me or just require login on refresh.
      logout();
      navigate('/login');
    }
  }, [token, user]);

  useEffect(() => {
    if (user) {
      connectSocket(user.id);
    } else {
      disconnectSocket();
    }
  }, [user]);

  return (
    <>
    <Routes>
      <Route path="/" element={user ? <HomeView /> : <Navigate to="/login" />} />
      <Route path="/login" element={!user ? <AuthView isRegister={false} /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <AuthView isRegister={true} /> : <Navigate to="/" />} />
      <Route path="/chat/:id" element={user ? <ChatView /> : <Navigate to="/login" />} />
    </Routes>
    <CallHandler />
    </>
  );
}

export default App;
