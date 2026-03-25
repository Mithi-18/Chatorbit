import { create } from 'zustand';

export const useStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  onlineUsers: [],
  activeChat: null,
  messages: [],
  contacts: [],

  setUser: (user) => set({ user }),
  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, activeChat: null });
  },

  setContacts: (contacts) => set({ contacts }),
  updateContactStatus: (userId, isActive) => set((state) => ({
    contacts: state.contacts.map(c => c.id === userId ? { ...c, isActive } : c)
  })),

  setActiveChat: (chat) => set({ activeChat: chat }),
  
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => {
    // only add if it belongs to active chat
    const { activeChat } = get();
    if (!activeChat) return state;
    if (
      (msg.senderId === activeChat.id && msg.receiverId === state.user.id) ||
      (msg.senderId === state.user.id && msg.receiverId === activeChat.id)
    ) {
      if (state.messages.find(m => m.id === msg.id)) return state;
      return { messages: [...state.messages, msg] };
    }
    return state;
  }),
}));
