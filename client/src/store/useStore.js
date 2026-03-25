import { create } from 'zustand';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

const messagesDB = localforage.createInstance({ name: 'chatorbit_messages' });
const contactsDB = localforage.createInstance({ name: 'chatorbit_contacts' });

const generatePeerId = () => 'orbit-' + Math.random().toString(36).substr(2, 9);

export const useStore = create((set, get) => ({
  myPeerId: localStorage.getItem('myPeerId') || '',
  profile: JSON.parse(localStorage.getItem('myProfile') || 'null'),
  contacts: [],
  activeChat: null,
  messages: [],

  initUser: (profileData) => {
    let peerId = localStorage.getItem('myPeerId');
    if (!peerId) {
      peerId = generatePeerId();
      localStorage.setItem('myPeerId', peerId);
    }
    const updatedProfile = { ...profileData, id: peerId };
    localStorage.setItem('myProfile', JSON.stringify(updatedProfile));
    set({ myPeerId: peerId, profile: updatedProfile });
    return peerId;
  },

  loadData: async () => {
    const savedContacts = await contactsDB.getItem('list') || [];
    set({ contacts: savedContacts });
  },

  saveProfile: (profileData) => {
    const current = get().profile || {};
    const updated = { ...current, ...profileData };
    localStorage.setItem('myProfile', JSON.stringify(updated));
    set({ profile: updated });
  },

  addContact: async (contact) => {
    const { contacts } = get();
    if (!contacts.find(c => c.id === contact.id)) {
      const newList = [...contacts, { ...contact, isActive: false }];
      await contactsDB.setItem('list', newList);
      set({ contacts: newList });
    }
  },

  updateContactPresence: (id, isActive) => {
    set((state) => {
      const newList = state.contacts.map(c => c.id === id ? { ...c, isActive } : c);
      contactsDB.setItem('list', newList);
      return { contacts: newList };
    });
  },

  setActiveChat: async (chat) => {
    const msgs = await messagesDB.getItem(`chat_${chat.id}`) || [];
    set({ activeChat: chat, messages: msgs });
  },

  addMessage: async (msg) => {
    const { activeChat, myPeerId } = get();
    const chatPartnerId = msg.senderId === myPeerId ? msg.receiverId : msg.senderId;
    const existingMsgs = await messagesDB.getItem(`chat_${chatPartnerId}`) || [];
    if (!existingMsgs.find(m => m.id === msg.id)) {
      const updated = [...existingMsgs, msg];
      await messagesDB.setItem(`chat_${chatPartnerId}`, updated);
      if (activeChat && activeChat.id === chatPartnerId) {
        set({ messages: updated });
      }
    }
  },
}));
