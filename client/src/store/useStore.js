import { create } from 'zustand';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

// Separate IndexedDB stores for different data types
const messagesDB  = localforage.createInstance({ name: 'chatorbit', storeName: 'messages' });
const contactsDB  = localforage.createInstance({ name: 'chatorbit', storeName: 'contacts' });
const profileDB   = localforage.createInstance({ name: 'chatorbit', storeName: 'profile' });
const unreadDB    = localforage.createInstance({ name: 'chatorbit', storeName: 'unread' });

const generatePeerId = () => 'orbit-' + Math.random().toString(36).substr(2, 9);

export const useStore = create((set, get) => ({
  // ── Auth / Profile ──────────────────────────────────────────────
  myPeerId: localStorage.getItem('myPeerId') || '',
  // Small text profile fields in localStorage, avatar in IndexedDB
  profile: (() => {
    try { return JSON.parse(localStorage.getItem('myProfile') || 'null'); }
    catch { return null; }
  })(),

  // ── Data ────────────────────────────────────────────────────────
  contacts: [],
  activeChat: null,
  messages: [],
  unread: {},      // { [contactId]: count }
  appLoading: true,   // true until contacts are loaded from IndexedDB

  // ── Init / Load ─────────────────────────────────────────────────
  initUser: async (profileData) => {
    let peerId = localStorage.getItem('myPeerId');
    if (!peerId) {
      peerId = generatePeerId();
      localStorage.setItem('myPeerId', peerId);
    }

    // Store avatar separately in IndexedDB (avoids 5MB localStorage limit)
    const { avatar, ...textFields } = profileData;
    const textProfile = { ...textFields, id: peerId };
    localStorage.setItem('myProfile', JSON.stringify(textProfile));

    if (avatar) {
      await profileDB.setItem('avatar', avatar);
    }

    const fullProfile = { ...textProfile, avatar: avatar || null };
    set({ myPeerId: peerId, profile: fullProfile });
    return peerId;
  },

  // Load all persisted data including avatar from IndexedDB
  loadData: async () => {
    const [savedContacts, avatar, savedUnread] = await Promise.all([
      contactsDB.getItem('list'),
      profileDB.getItem('avatar'),
      unreadDB.getItem('counts'),
    ]);

    const profileText = (() => {
      try { return JSON.parse(localStorage.getItem('myProfile') || 'null'); }
      catch { return null; }
    })();

    const fullProfile = profileText ? { ...profileText, avatar: avatar || null } : null;

    set({
      contacts: savedContacts || [],
      profile: fullProfile,
      unread: savedUnread || {},
      appLoading: false,
    });
  },

  updateProfile: async (updates) => {
    const current = get().profile || {};
    const { avatar, ...textUpdates } = updates;

    if (avatar !== undefined) {
      await profileDB.setItem('avatar', avatar);
    }

    const { avatar: _old, ...textCurrent } = current;
    const newTextProfile = { ...textCurrent, ...textUpdates };
    localStorage.setItem('myProfile', JSON.stringify(newTextProfile));
    set({ profile: { ...newTextProfile, avatar: avatar !== undefined ? avatar : current.avatar } });
  },

  // ── Contacts ────────────────────────────────────────────────────
  addContact: async (contact) => {
    const { contacts } = get();
    if (contacts.find(c => c.id === contact.id)) return;
    const newList = [...contacts, { ...contact, isActive: false }];
    await contactsDB.setItem('list', newList);
    set({ contacts: newList });
  },

  updateContactPresence: (id, isActive) => {
    set((state) => {
      const newList = state.contacts.map(c => c.id === id ? { ...c, isActive } : c);
      // persist presence update (fire-and-forget)
      contactsDB.setItem('list', newList);
      return { contacts: newList };
    });
  },

  // ── Chat / Messages ─────────────────────────────────────────────
  setActiveChat: async (chat) => {
    const msgs = await messagesDB.getItem(`chat_${chat.id}`) || [];
    // Clear unread count when opening this chat and persist it
    set((state) => {
      const newUnread = { ...state.unread, [chat.id]: 0 };
      unreadDB.setItem('counts', newUnread); // persist
      return { activeChat: chat, messages: msgs, unread: newUnread };
    });
  },

  incrementUnread: (contactId) => {
    const { activeChat } = useStore.getState();
    if (activeChat?.id === contactId && document.visibilityState === 'visible') return;
    set((state) => {
      const newUnread = { ...state.unread, [contactId]: (state.unread[contactId] || 0) + 1 };
      unreadDB.setItem('counts', newUnread); // persist
      return { unread: newUnread };
    });
  },

  clearUnread: (contactId) => {
    set((state) => {
      const newUnread = { ...state.unread, [contactId]: 0 };
      unreadDB.setItem('counts', newUnread);
      return { unread: newUnread };
    });
  },

  addMessage: async (msg) => {
    const { myPeerId, activeChat } = get();
    // Determine which contact this chat belongs to
    const chatPartnerId = msg.senderId === myPeerId ? msg.receiverId : msg.senderId;

    const existing = await messagesDB.getItem(`chat_${chatPartnerId}`) || [];
    // Deduplicate by message ID
    if (existing.find(m => m.id === msg.id)) return;

    const updated = [...existing, msg];
    await messagesDB.setItem(`chat_${chatPartnerId}`, updated);

    // Only update live view if user is currently in that chat
    if (activeChat?.id === chatPartnerId) {
      set({ messages: updated });
    }
  },
}));
