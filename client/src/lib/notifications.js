// ─── Notification & Sound System ─────────────────────────────────────────────

let audioCtx = null;

// Get or lazily create AudioContext (must be after user gesture)
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Play a modern "ping" notification sound using Web Audio API (no file needed)
export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const notes = [880, 1320]; // A5, E6 — short, pleasant double ping
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.4, now + i * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.35);
    });
  } catch (e) {
    console.warn('[Sound] Could not play notification sound', e);
  }
}

// Play incoming call ringtone (loops)
let ringtoneOsc = null;
let ringtoneGain = null;

export function startRingtone() {
  try {
    stopRingtone();
    const ctx = getAudioCtx();
    ringtoneOsc = ctx.createOscillator();
    ringtoneGain = ctx.createGain();
    ringtoneOsc.connect(ringtoneGain);
    ringtoneGain.connect(ctx.destination);
    ringtoneOsc.type = 'sine';
    ringtoneOsc.frequency.setValueAtTime(440, ctx.currentTime);
    ringtoneGain.gain.setValueAtTime(0.3, ctx.currentTime);

    // Create a pulsing effect
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.connect(lfoGain);
    lfoGain.connect(ringtoneGain.gain);
    lfo.frequency.setValueAtTime(2, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.3, ctx.currentTime);
    lfo.start();
    ringtoneOsc.start();
  } catch (e) {
    console.warn('[Sound] Could not start ringtone', e);
  }
}

export function stopRingtone() {
  try {
    if (ringtoneOsc) { ringtoneOsc.stop(); ringtoneOsc = null; }
  } catch (e) {}
}

// ─── Browser Push Notifications ──────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'not-supported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function showPushNotification(senderName, messagePreview, avatar = null) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // don't show when tab is focused

  const notif = new Notification(`💬 ${senderName}`, {
    body: messagePreview,
    icon: avatar || '/favicon.svg',
    badge: '/favicon.svg',
    tag: `chatorbit-msg-${senderName}`, // groups notifications per contact
    renotify: true,
    silent: true, // we play our own sound
  });

  notif.onclick = () => {
    window.focus();
    notif.close();
  };

  // Auto-close after 5 seconds
  setTimeout(() => notif.close(), 5000);
}

// Show an in-app toast banner (for when the user is in a different chat)
export function showInAppToast(senderName, message, onClick) {
  const existing = document.getElementById('chatorbit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'chatorbit-toast';
  Object.assign(toast.style, {
    position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #ff8c00, #ff4500)',
    color: 'white', borderRadius: '14px', padding: '0.8rem 1.2rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 9999, cursor: 'pointer', maxWidth: '320px', width: '90%',
    display: 'flex', alignItems: 'center', gap: '0.8rem',
    animation: 'toastSlide 0.3s ease',
    fontFamily: 'Inter, -apple-system, sans-serif',
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastSlide {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);

  toast.innerHTML = `
    <div style="font-size:1.5rem">💬</div>
    <div>
      <div style="font-weight:700;font-size:0.9rem">${senderName}</div>
      <div style="font-size:0.8rem;opacity:0.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${message}</div>
    </div>
  `;

  toast.onclick = () => { toast.remove(); if (onClick) onClick(); };
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}
