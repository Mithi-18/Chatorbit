import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';

export const socket = io('http://localhost:5000', {
  autoConnect: false,
});

export const connectSocket = (userId) => {
  if (!socket.connected) {
    socket.connect();
  }
  socket.emit('user_connected', userId);

  socket.off('receive_message').on('receive_message', (msg) => {
    useStore.getState().addMessage(msg);
  });

  socket.off('user_status_changed').on('user_status_changed', ({ userId, isActive }) => {
    useStore.getState().updateContactStatus(userId, isActive);
  });
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
