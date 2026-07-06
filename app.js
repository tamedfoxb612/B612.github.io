/**
 * app.js - 312110 ❤️ Pager & Video Call PWA
 * Full Supabase Realtime, WebRTC Video, & VAPID Push Notifications implementation
 * Strict Rule: NO native browser alert(), confirm(), or prompt() used.
 */

// =========================================================================
// MANUAL BACKEND CONFIGURATION INSTRUCTIONS:
// 1. Go to https://supabase.com and sign in to your project dashboard.
// 2. Click the gear/settings icon (⚙️ Project Settings) in the bottom left sidebar.
// 3. Click on "Data API" (or "API") under Configuration.
// 4. Copy your "Project URL" into MANUAL_SUPABASE_URL below.
// 5. Under "Project API keys", copy your "anon / public" key into MANUAL_SUPABASE_ANON_KEY below.
// Note: If left empty (""), the app runs smoothly in local/broadcast P2P mode!
// =========================================================================
const MANUAL_SUPABASE_URL = "https://fwwvksyewbdfdyegzgfz.supabase.co"
const MANUAL_SUPABASE_ANON_KEY = "sb_publishable_IED8Q0cnxphV6LWsaOV9cg_qChpAX8H"
const MANUAL_VAPID_PUBLIC_KEY = "BJOSxJvBN0cbRzFRFEv-WCnPKKCjV9i1OUc4kzTp4lDPklRzgxCDSHmyCT7mtx8vV9qMozjd47SR77NHlk8fDls"

// State Management
const state = {
  supabase: null,
  roomCode: '',
  userName: 'Sweetheart',
  channel: null,
  localStream: null,
  peerConnection: null,
  isCalling: false,
  isMuted: false,
  isCamOff: false,
  isScreenSharing: false,
  enlargedPane: null,
  isImmersiveMode: false,
  activeTheme: 'slate',
  lastInteractionTime: 0,
  screenStream: null,
  ttsEnabled: false,
  circleSpeechEnabled: true,
  pushSubscription: null,
  activitiesCount: 0,
  consoleLogs: []
};

// Google STUN Servers for reliable P2P WebRTC connection
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// UI DOM Elements
const elements = {
  toastContainer: document.getElementById('toast-container'),
  statusBadge: document.getElementById('status-badge'),
  loginView: document.getElementById('login-view'),
  dashboardView: document.getElementById('dashboard-view'),
  roomCodeInput: document.getElementById('room-code-input'),
  userNameInput: document.getElementById('user-name-input'),
  joinBtn: document.getElementById('join-btn'),
  enablePushBtn: document.getElementById('enable-push-btn'),
  enablePushDashBtn: document.getElementById('enable-push-dash-btn'),
  clearRoomMessagesBtn: document.getElementById('clear-room-messages-btn'),
  leaveRoomBtn: document.getElementById('leave-room-btn'),
  currentRoomCode: document.getElementById('current-room-code'),
  giantHeartBtn: document.getElementById('giant-heart-btn'),
  startCallBtn: document.getElementById('start-call-btn'),
  videoUi: document.getElementById('video-ui'),
  remoteVideo: document.getElementById('remote-video'),
  localVideo: document.getElementById('local-video'),
  remoteWaitingOverlay: document.getElementById('remote-waiting-overlay'),
  toggleMuteBtn: document.getElementById('toggle-mute-btn'),
  toggleCamBtn: document.getElementById('toggle-cam-btn'),
  endCallBtn: document.getElementById('end-call-btn'),
  chatFeed: document.getElementById('chat-feed'),
  feedCount: document.getElementById('feed-count'),
  messageForm: document.getElementById('message-form'),
  messageInput: document.getElementById('message-input'),
  roomHeartBtn: document.getElementById('room-heart-btn'),
  notifyCallBtn: document.getElementById('notify-call-btn'),
  callInviteModal: document.getElementById('call-invite-modal'),
  inviteSenderText: document.getElementById('invite-sender-text'),
  acceptCallBtn: document.getElementById('accept-call-btn'),
  declineCallBtn: document.getElementById('decline-call-btn'),
  roomThemeBtn: document.getElementById('room-theme-btn'),
  roomThemeMenu: document.getElementById('room-theme-menu'),
  frontThemeBtn: document.getElementById('front-theme-btn'),
  frontThemeMenu: document.getElementById('front-theme-menu'),
  roomConsoleBtn: document.getElementById('room-console-btn'),
  videoConsoleBtn: document.getElementById('video-console-btn'),
  consoleBadge: document.getElementById('console-badge'),
  consoleLogModal: document.getElementById('console-log-modal'),
  consoleLogList: document.getElementById('console-log-list'),
  closeConsoleBtn: document.getElementById('close-console-btn'),
  clearConsoleBtn: document.getElementById('clear-console-btn'),
  themeColorBtn: document.getElementById('theme-color-btn'),
  themeMenu: document.getElementById('theme-menu'),
  remoteCamOff: document.getElementById('remote-cam-off'),
  localCamOff: document.getElementById('local-cam-off'),
  toggleChatBgBtn: document.getElementById('toggle-chat-bg-btn'),
  toggleCircleSpeechBtn: document.getElementById('toggle-circle-speech-btn'),
  toggleTtsBtn: document.getElementById('toggle-tts-btn'),
  remoteCircleSpeech: document.getElementById('remote-circle-speech'),
  localCircleSpeech: document.getElementById('local-circle-speech'),
  exitFullscreenTrigger: document.getElementById('exit-fullscreen-trigger'),
  exitFullscreenBtn: document.getElementById('exit-fullscreen-btn'),
  videoPanesWrapper: document.getElementById('video-panes-wrapper'),
  remoteVideoContainer: document.getElementById('remote-video-container'),
  localVideoContainer: document.getElementById('local-video-container'),
  screenShareContainer: document.getElementById('screen-share-container'),
  screenShareVideo: document.getElementById('screen-share-video'),
  videoResizer: document.getElementById('video-resizer'),
  videoChatOverlay: document.getElementById('video-chat-overlay'),
  videoChatFeed: document.getElementById('video-chat-feed'),
  clearVideoMessagesBtn: document.getElementById('clear-video-messages-btn'),
  videoChatForm: document.getElementById('video-chat-form'),
  videoChatInput: document.getElementById('video-chat-input'),
  toggleScreenBtn: document.getElementById('toggle-screen-btn'),
  minimizeVideoChat: document.getElementById('minimize-video-chat'),
  notifUrgeModal: document.getElementById('notif-urge-modal'),
  enableNotifsEnterBtn: document.getElementById('enable-notifs-enter-btn'),
  skipNotifsEnterBtn: document.getElementById('skip-notifs-enter-btn')
};

// Initialize PWA & Service Worker
window.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  setupEventListeners();
  loadSavedCredentials();
});

/**
 * System Console Logs & Toast Wrapper
 */
function logToConsole(message, type = 'info') {
  if (!state.consoleLogs) state.consoleLogs = [];
  state.consoleLogs.push({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type
  });
  if (elements.consoleBadge) {
    elements.consoleBadge.textContent = state.consoleLogs.length;
    elements.consoleBadge.classList.remove('hidden');
  }
  renderConsoleLogs();
}

function renderConsoleLogs() {
  if (!elements.consoleLogList) return;
  if (!state.consoleLogs || state.consoleLogs.length === 0) {
    elements.consoleLogList.innerHTML = '<p class="console-empty">No console messages yet.</p>';
    return;
  }
  elements.consoleLogList.innerHTML = state.consoleLogs.map(log => `
    <div class="console-log-item ${log.type}">
      <span style="opacity:0.75; font-size: 0.78rem;">[${log.timestamp}]</span> ${log.message}
    </div>
  `).join('');
  elements.consoleLogList.scrollTop = elements.consoleLogList.scrollHeight;
}

function showToast(message, type = 'info', duration = 4000) {
  logToConsole(message, type);
  // Only display intrusive visual toast for hard errors
  if (type === 'error' && elements.toastContainer) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

function showNativeNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const options = {
      body: body || 'Open B612 to view your room!',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❤️</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❤️</text></svg>',
      vibrate: [200, 100, 200]
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title || 'B612 ❤️', options).catch(() => {});
      }).catch(() => {
        try { new Notification(title || 'B612 ❤️', options); } catch (e) {}
      });
    } else {
      try { new Notification(title || 'B612 ❤️', options); } catch (e) {}
    }
  }
}

/**
 * Register Service Worker for PWA and Push Notifications
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js?v=sketch4');
      await reg.update();
      console.log('Service Worker registered successfully:', reg.scope);
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  }
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  elements.joinBtn?.addEventListener('click', handleJoinRoom);
  elements.roomCodeInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleJoinRoom();
  });
  
  elements.enablePushBtn?.addEventListener('click', () => handleEnablePush());
  elements.enablePushDashBtn?.addEventListener('click', () => handleEnablePush());
  elements.leaveRoomBtn?.addEventListener('click', handleLeaveRoom);
  
  elements.giantHeartBtn?.addEventListener('click', handleSendHeart);
  
  // Room Heart action & Form Submit
  elements.messageForm?.addEventListener('submit', handleRoomFormSubmit);
  elements.roomHeartBtn?.addEventListener('click', handleRoomHeartClick);
  
  // Video Call Invite & Modal
  elements.notifyCallBtn?.addEventListener('click', sendCallInvite);
  elements.acceptCallBtn?.addEventListener('click', acceptCallInvite);
  elements.declineCallBtn?.addEventListener('click', declineCallInvite);
  
  // Video Controls
  elements.startCallBtn?.addEventListener('click', initiateVideoCall);
  elements.endCallBtn?.addEventListener('click', endVideoCall);
  elements.toggleMuteBtn?.addEventListener('click', toggleMute);
  elements.toggleCamBtn?.addEventListener('click', toggleCamera);
  elements.toggleScreenBtn?.addEventListener('click', toggleScreenShare);
  
  // Theme & Console Controls
  elements.themeColorBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.themeMenu?.classList.toggle('hidden');
  });

  elements.roomThemeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.roomThemeMenu?.classList.toggle('hidden');
  });

  elements.frontThemeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.frontThemeMenu?.classList.toggle('hidden');
  });

  document.querySelectorAll('.theme-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleThemeSelection(e.currentTarget.dataset.theme);
      elements.themeMenu?.classList.add('hidden');
      elements.roomThemeMenu?.classList.add('hidden');
      elements.frontThemeMenu?.classList.add('hidden');
    });
  });

  const openConsole = () => {
    elements.consoleLogModal?.classList.remove('hidden');
    if (elements.consoleBadge) elements.consoleBadge.classList.add('hidden');
  };
  elements.roomConsoleBtn?.addEventListener('click', openConsole);
  elements.videoConsoleBtn?.addEventListener('click', openConsole);
  elements.closeConsoleBtn?.addEventListener('click', () => elements.consoleLogModal?.classList.add('hidden'));
  elements.clearConsoleBtn?.addEventListener('click', () => {
    state.consoleLogs = [];
    renderConsoleLogs();
    showToast('System console cleared.');
  });

  elements.clearRoomMessagesBtn?.addEventListener('click', clearRoomMessages);
  elements.clearVideoMessagesBtn?.addEventListener('click', clearVideoMessages);
  
  elements.toggleChatBgBtn?.addEventListener('click', toggleImmersiveFullscreen);
  elements.toggleCircleSpeechBtn?.addEventListener('click', () => toggleCircleSpeech(true));
  elements.exitFullscreenBtn?.addEventListener('click', exitImmersiveFullscreen);
  elements.toggleTtsBtn?.addEventListener('click', toggleTts);
  
  // Interactive Click-to-Enlarge & Draggable PiP / Circles
  elements.remoteVideoContainer?.addEventListener('click', () => handlePaneClick('remote'));
  elements.localVideoContainer?.addEventListener('click', () => handlePaneClick('local'));
  setupPaneDragging(elements.remoteVideoContainer);
  setupPaneDragging(elements.localVideoContainer);
  setupPaneResizer(elements.remoteVideoContainer);
  setupPaneResizer(elements.localVideoContainer);
  setupManualResizer();
  window.addEventListener('resize', updateSpeechBubblePositions);

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.isImmersiveMode) {
      exitImmersiveFullscreen();
    }
  });

  // Push Notifications Pre-Room Modal buttons
  elements.enableNotifsEnterBtn?.addEventListener('click', async () => {
    elements.notifUrgeModal?.classList.add('hidden');
    await handleEnablePush(false);
    completeRoomJoin();
  });
  elements.skipNotifsEnterBtn?.addEventListener('click', () => {
    elements.notifUrgeModal?.classList.add('hidden');
    completeRoomJoin();
  });
  
  // Video overlay chat
  elements.videoChatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elements.videoChatInput?.value.trim();
    if (text) {
      sendChatMessageText(text);
      elements.videoChatInput.value = '';
    }
  });
  elements.minimizeVideoChat?.addEventListener('click', () => {
    const overlay = elements.videoChatOverlay;
    if (!overlay) return;
    const isMinimized = overlay.classList.toggle('minimized');
    if (elements.minimizeVideoChat) {
      elements.minimizeVideoChat.textContent = isMinimized ? '+' : '─';
      elements.minimizeVideoChat.title = isMinimized ? 'Expand Live Chat' : 'Minimize Live Chat';
    }
  });
}

function handleRoomHeartClick(e) {
  if (e) e.preventDefault();
  const text = elements.messageInput?.value.trim();
  if (!text) {
    // press heart without text inputted to send notification pager heart
    handleSendHeart();
  } else {
    // if text is present send message with notification
    sendChatMessageText(text);
    if (elements.messageInput) elements.messageInput.value = '';
  }
}

function handleRoomFormSubmit(e) {
  if (e) e.preventDefault();
  handleRoomHeartClick(e);
}

/**
 * Load saved room code or user name from localStorage
 */
function loadSavedCredentials() {
  const savedRoom = localStorage.getItem('b612_room') || localStorage.getItem('lovepager_room');
  const savedName = localStorage.getItem('b612_name') || localStorage.getItem('lovepager_name');
  const savedTheme = localStorage.getItem('b612_theme') || 'slate';
  
  if (savedRoom && elements.roomCodeInput) elements.roomCodeInput.value = savedRoom;
  if (savedName && elements.userNameInput) elements.userNameInput.value = savedName;

  applyTheme(savedTheme, getThemeLabel(savedTheme), false);
}

/**
 * Join Room Logic
 */
async function handleJoinRoom() {
  const roomCode = elements.roomCodeInput?.value.trim().toUpperCase();
  const userName = elements.userNameInput?.value.trim() || 'Sweetheart';
  const sbUrl = MANUAL_SUPABASE_URL;
  const sbKey = MANUAL_SUPABASE_ANON_KEY;
  
  if (!roomCode) {
    showToast('Please enter a Room Code (e.g. SUMMER-92)', 'error');
    return;
  }

  // Save to local storage for quick rejoin
  localStorage.setItem('b612_room', roomCode);
  localStorage.setItem('b612_name', userName);

  state.roomCode = roomCode;
  state.userName = userName;

  // Initialize Supabase Client if manually configured
  try {
    if (window.supabase && sbUrl && sbKey) {
      state.supabase = window.supabase.createClient(sbUrl, sbKey);
    } else {
      console.log('Running in local real-time WebSocket / broadcast mode.');
    }
  } catch (err) {
    console.warn('Supabase init notice:', err);
  }

  // Before entering room, check if push notifications are enabled or prompted
  if ('Notification' in window && Notification.permission !== 'granted' && !state.pushSubscription && elements.notifUrgeModal) {
    elements.notifUrgeModal.classList.remove('hidden');
  } else {
    completeRoomJoin();
  }
}

/**
 * Robust Media Stream Acquisition with fallbacks
 */
async function getOrAcquireLocalStream() {
  if (state.localStream && state.localStream.active) {
    state.localStream.getTracks().forEach(t => t.enabled = true);
    state.isMuted = false;
    state.isCamOff = false;
    if (elements.localVideo && elements.localVideo.srcObject !== state.localStream) {
      elements.localVideo.srcObject = state.localStream;
    }
    return state.localStream;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
      audio: true 
    });
    state.localStream = stream;
    if (elements.localVideo) elements.localVideo.srcObject = stream;
    return stream;
  } catch (err1) {
    console.warn('Strict video/audio getUserMedia failed, trying relaxed constraints:', err1);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      state.localStream = stream;
      if (elements.localVideo) elements.localVideo.srcObject = stream;
      return stream;
    } catch (err2) {
      console.warn('Video+audio failed, trying video only:', err2);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        state.localStream = stream;
        if (elements.localVideo) elements.localVideo.srcObject = stream;
        return stream;
      } catch (err3) {
        console.warn('Video failed, trying audio only:', err3);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.localStream = stream;
        if (elements.localVideo) elements.localVideo.srcObject = stream;
        return stream;
      }
    }
  }
}

async function completeRoomJoin() {
  // Switch View
  elements.loginView?.classList.remove('active');
  elements.loginView?.classList.add('hidden');
  elements.dashboardView?.classList.remove('hidden');
  if (elements.currentRoomCode) elements.currentRoomCode.textContent = state.roomCode;
  
  if (elements.statusBadge) {
    elements.statusBadge.className = 'status-badge online';
    elements.statusBadge.textContent = 'Online';
  }

  // Request Camera & Audio right from the start
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      await getOrAcquireLocalStream();
    }
  } catch (mediaErr) {
    console.warn('Camera/audio permission prompt note:', mediaErr);
  }

  // Connect to Realtime Channel
  setupRealtimeSubscription();

  // Load past history if connected to live DB
  loadPastMessages();
}

/**
 * Leave Room Logic
 */
function handleLeaveRoom() {
  if (state.channel) {
    state.channel.unsubscribe();
    state.channel = null;
  }
  endVideoCall();
  
  elements.dashboardView.classList.add('hidden');
  elements.loginView.classList.remove('hidden');
  elements.loginView.classList.add('active');
  
  elements.statusBadge.className = 'status-badge offline';
  elements.statusBadge.textContent = 'Offline';
  showToast('You left the love room.', 'info');
}

/**
 * Setup Supabase Realtime Channel
 */
function setupRealtimeSubscription() {
  if (!state.supabase) {
    // Fallback broadcast via broadcastChannel or memory for instant UI demo
    window.demoBroadcast = window.demoBroadcast || new BroadcastChannel(`b612_${state.roomCode}`);
    window.demoBroadcast.onmessage = (event) => handleIncomingPayload(event.data);
    return;
  }

  const channelName = `room:${state.roomCode}`;
  state.channel = state.supabase.channel(channelName, {
    config: {
      broadcast: { self: false },
      presence: { key: state.userName }
    }
  });

  state.channel
    .on('broadcast', { event: 'pager_event' }, (payload) => {
      handleIncomingPayload(payload.payload);
    })
    .on('broadcast', { event: 'webrtc_signaling' }, (payload) => {
      handleSignalingMessage(payload.payload);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to Realtime channel: ${channelName}`);
      }
    });
}

/**
 * Handle incoming chat or heart pager payload
 */
function handleIncomingPayload(data) {
  if (!data) return;
  const { type, content, sender, timestamp } = data;
  if (sender === state.userName) return; // ignore self broadcast echoes
  
  appendFeedItem(type, content, sender || 'Partner', new Date(timestamp || Date.now()));
  
  if (type === 'heart') {
    showToast(`❤️ Heart Page received from ${sender || 'Partner'}!`, 'success');
    showNativeNotification(`❤️ Heart Page!`, `${sender || 'Partner'} sent you a giant heart!`);
  } else if (type === 'message') {
    showToast(`💌 New message from ${sender || 'Partner'}: "${content}"`, 'info');
    showNativeNotification(`💌 ${sender || 'Partner'}`, content);
  }
}

/**
 * Load past messages from Supabase 'messages' table
 */
async function loadPastMessages() {
  if (!state.supabase || state.supabase.supabaseUrl === DEFAULT_SUPABASE_URL) return;
  try {
    const { data, error } = await state.supabase
      .from('messages')
      .select('*')
      .eq('room_code', state.roomCode)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (data && data.length > 0) {
      elements.chatFeed.innerHTML = '';
      data.forEach(msg => {
        appendFeedItem(msg.type, msg.content, msg.content.includes(':') ? msg.content.split(':')[0] : 'Partner', new Date(msg.created_at), false);
      });
    }
  } catch (err) {
    console.log('Past history notice (table not yet created or demo project):', err.message);
  }
}

/**
 * Send Heart Page
 */
async function handleSendHeart() {
  const payload = {
    type: 'heart',
    content: '❤️ Sent a giant heart page!',
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  // Add to local UI
  appendFeedItem('heart', payload.content, 'You', new Date());

  // Broadcast over Supabase Realtime
  if (state.channel) {
    state.channel.send({
      type: 'broadcast',
      event: 'pager_event',
      payload: payload
    });
  } else if (window.demoBroadcast) {
    window.demoBroadcast.postMessage(payload);
  }

  // Persist to Supabase database
  if (state.supabase && state.supabase.supabaseUrl !== DEFAULT_SUPABASE_URL) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'heart',
        content: `${state.userName}: Sent a heart ❤️`
      }]);
    } catch (e) { /* ignore in demo */ }
  }

  // Trigger Web Push notification to partner via VAPID Vercel/Supabase function
  triggerRemotePushNotification('❤️ Heart Page!', `${state.userName} sent you a giant heart!`);
}

/**
 * Send Custom Chat Message
 */
async function handleSendMessage(e) {
  e?.preventDefault();
  const text = elements.messageInput?.value.trim();
  if (!text) return;
  sendChatMessageText(text);
  if (elements.messageInput) elements.messageInput.value = '';
}

async function sendChatMessageText(text) {
  if (!text) return;

  const payload = {
    type: 'message',
    content: text,
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  appendFeedItem('message', text, 'You', new Date());

  if (state.channel) {
    state.channel.send({
      type: 'broadcast',
      event: 'pager_event',
      payload: payload
    });
  } else if (window.demoBroadcast) {
    window.demoBroadcast.postMessage(payload);
  }

  if (state.supabase && state.supabase.supabaseUrl !== DEFAULT_SUPABASE_URL) {
    try {
      await state.supabase.from('messages').upsert([{
        room_code: state.roomCode,
        type: 'message',
        content: `${state.userName}: ${text}`
      }]);
    } catch (e) { /* ignore */ }
  }

  triggerRemotePushNotification(`💌 ${state.userName}`, text);
}

/**
 * Append Item to UI Chat Feed
 */
function appendFeedItem(type, content, sender, timeObj, animate = true) {
  if (!elements.chatFeed) return;
  const emptyEl = elements.chatFeed.querySelector('.empty-feed');
  if (emptyEl) emptyEl.remove();

  const item = document.createElement('div');
  const isSelf = sender === 'You' || sender === state.userName;
  const timeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (type === 'heart') {
    item.className = `feed-item heart-event ${animate ? '' : 'no-animate'}`;
    item.innerHTML = `
      <div class="feed-meta"><span>${isSelf ? 'You sent a page' : `Page from <b>${sender}</b>`}</span> <span>${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content" style="font-size: 1.5rem; margin: 4px 0;">❤️❤️❤️</div>
    `;
    showCircleSpeechBubble(isSelf ? 'local' : 'remote', '❤️❤️❤️');
  } else {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = `feed-item ${isSelf ? 'self' : 'partner'} ${animate ? '' : 'no-animate'}`;
    item.innerHTML = `
      <div class="feed-meta"><span class="sender">${isSelf ? 'You' : sender}</span> <span>${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">${cleanContent}</div>
    `;
    showCircleSpeechBubble(isSelf ? 'local' : 'remote', cleanContent);
  }

  let vItem = null;
  const delBtn = item.querySelector('.msg-delete-btn');
  delBtn?.addEventListener('click', () => {
    item.remove();
    vItem?.remove();
    state.activitiesCount = Math.max(0, state.activitiesCount - 1);
    if (elements.feedCount) elements.feedCount.textContent = `${state.activitiesCount} message${state.activitiesCount === 1 ? '' : 's'}`;
    showToast('Message deleted');
  });

  elements.chatFeed.appendChild(item);
  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;

  // Mirror to video chat feed if present
  if (elements.videoChatFeed) {
    vItem = item.cloneNode(true);
    const vDelBtn = vItem.querySelector('.msg-delete-btn');
    vDelBtn?.addEventListener('click', () => {
      item.remove();
      vItem?.remove();
      state.activitiesCount = Math.max(0, state.activitiesCount - 1);
      if (elements.feedCount) elements.feedCount.textContent = `${state.activitiesCount} message${state.activitiesCount === 1 ? '' : 's'}`;
      showToast('Message deleted');
    });
    elements.videoChatFeed.appendChild(vItem);
    elements.videoChatFeed.scrollTop = elements.videoChatFeed.scrollHeight;
  }

  // Text To Speech (TTS) for messages using distinct voices without prefix
  if (state.ttsEnabled && type === 'message' && ('speechSynthesis' in window)) {
    try {
      const cleanText = content.replace(/^.*?: /, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length > 0) {
        const langVoices = voices.filter(v => v.lang.startsWith(navigator.language?.slice(0, 2) || 'en'));
        const pool = langVoices.length >= 2 ? langVoices : voices;
        if (isSelf) {
          utterance.voice = pool[0];
          utterance.pitch = 1.08;
        } else {
          // Select a distinctly different voice for partner messages
          const diffVoice = pool.find(v => v !== pool[0]) || voices.find(v => v !== pool[0]);
          if (diffVoice) {
            utterance.voice = diffVoice;
            utterance.pitch = 0.92;
          } else {
            utterance.pitch = 0.82;
          }
        }
      } else {
        utterance.pitch = isSelf ? 1.08 : 0.82;
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS Speech error:', err);
    }
  }

  state.activitiesCount++;
  if (elements.feedCount) {
    elements.feedCount.textContent = `${state.activitiesCount} message${state.activitiesCount === 1 ? '' : 's'}`;
  }
}

/**
 * WebRTC Video Calling Logic
 */
async function initiateVideoCall() {
  if (state.isCalling) return;

  try {
    await getOrAcquireLocalStream();
    if (elements.localVideo && state.localStream) {
      elements.localVideo.srcObject = state.localStream;
      elements.localVideo.play().catch(e => console.debug('localVideo play note:', e));
    }
    elements.videoUi.classList.remove('hidden');
    elements.remoteWaitingOverlay.style.display = 'flex';
    state.isCalling = true;

    setupPeerConnection();

    // Create WebRTC Offer
    const offer = await state.peerConnection.createOffer();
    await state.peerConnection.setLocalDescription(offer);

    sendSignaling({
      type: 'offer',
      sdp: offer,
      sender: state.userName
    });

    showToast('Initiating live video call...', 'info');
    clearVideoMessages();
    triggerRemotePushNotification('📹 Incoming Video Date!', `${state.userName} is inviting you to a live video stream!`);

  } catch (err) {
    showToast('Could not access camera/microphone. Please check browser permissions.', 'error');
    console.error('WebRTC media error:', err);
  }
}

function setupPeerConnection() {
  state.peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Add local media tracks
  if (state.localStream) {
    state.localStream.getTracks().forEach(track => {
      state.peerConnection.addTrack(track, state.localStream);
    });
  }

  // Handle incoming remote stream
  state.peerConnection.ontrack = (event) => {
    const track = event.track;
    if (track.kind === 'video' && (track.label?.toLowerCase().includes('screen') || track.label?.toLowerCase().includes('window') || state.partnerScreenSharing)) {
      if (elements.screenShareVideo && elements.screenShareVideo.srcObject !== event.streams[0]) {
        elements.screenShareVideo.srcObject = event.streams[0];
        elements.screenShareVideo.play().catch(e => console.debug(e));
        elements.screenShareContainer?.classList.remove('hidden');
        showToast('Screen share connected! 🖥️', 'success');
      }
    } else {
      if (elements.remoteVideo.srcObject !== event.streams[0]) {
        elements.remoteVideo.srcObject = event.streams[0];
        elements.remoteVideo.play().catch(e => console.debug(e));
        if (elements.remoteWaitingOverlay) elements.remoteWaitingOverlay.style.display = 'none';
        showToast('Partner connected to video stream! 📹❤️', 'success');
      }
    }
  };

  // ICE Candidate handling
  state.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignaling({
        type: 'ice-candidate',
        candidate: event.candidate,
        sender: state.userName
      });
    }
  };
}

function sendSignaling(payload) {
  if (state.channel) {
    state.channel.send({
      type: 'broadcast',
      event: 'webrtc_signaling',
      payload: payload
    });
  } else if (window.demoBroadcast) {
    window.demoBroadcast.postMessage({ signaling: true, ...payload });
  }
}

function toggleCircleSpeech(broadcast = true) {
  state.circleSpeechEnabled = !state.circleSpeechEnabled;
  document.body.classList.toggle('circle-speech-on', state.circleSpeechEnabled);
  if (elements.toggleCircleSpeechBtn) {
    elements.toggleCircleSpeechBtn.innerHTML = state.circleSpeechEnabled ? '<span>💭 Circle Speech: On</span>' : '<span>💭 Circle Speech: Off</span>';
    elements.toggleCircleSpeechBtn.classList.toggle('active', state.circleSpeechEnabled);
  }
  if (!state.circleSpeechEnabled) {
    if (elements.remoteCircleSpeech) elements.remoteCircleSpeech.classList.add('hidden');
    if (elements.localCircleSpeech) elements.localCircleSpeech.classList.add('hidden');
  }
  showToast(state.circleSpeechEnabled ? '💭 Circle Speech Bubbles enabled above heads' : '💭 Circle Speech Bubbles disabled');
  if (broadcast) {
    sendSignaling({ type: 'toggle-circle-speech', enabled: state.circleSpeechEnabled, sender: state.userName });
  }
}

let speechBubbleTimeouts = { local: null, remote: null };

function showCircleSpeechBubble(targetPane, text) {
  if (state.circleSpeechEnabled === false) return;
  const bubbleEl = targetPane === 'local' ? elements.localCircleSpeech : elements.remoteCircleSpeech;
  const circleEl = targetPane === 'local' ? elements.localVideoContainer : elements.remoteVideoContainer;
  if (!bubbleEl || !circleEl) return;

  // Only show bubble if we are in circles mode or PiP/enlarged mode
  if (!elements.videoPanesWrapper?.classList.contains('layout-circles') && !elements.videoPanesWrapper?.classList.contains('layout-enlarged')) {
    return;
  }

  bubbleEl.textContent = text;
  bubbleEl.classList.remove('hidden');
  updateSpeechBubblePositions();

  if (speechBubbleTimeouts[targetPane]) clearTimeout(speechBubbleTimeouts[targetPane]);
  speechBubbleTimeouts[targetPane] = setTimeout(() => {
    bubbleEl.classList.add('hidden');
  }, 6000);
}

function updateSpeechBubblePositions() {
  const wrapper = elements.videoPanesWrapper;
  if (!wrapper) return;
  const wrapperRect = wrapper.getBoundingClientRect();

  ['local', 'remote'].forEach(pane => {
    const bubbleEl = pane === 'local' ? elements.localCircleSpeech : elements.remoteCircleSpeech;
    const circleEl = pane === 'local' ? elements.localVideoContainer : elements.remoteVideoContainer;
    if (!bubbleEl || !circleEl || bubbleEl.classList.contains('hidden')) return;

    const circleRect = circleEl.getBoundingClientRect();
    const centerX = circleRect.left + circleRect.width / 2 - wrapperRect.left;
    const topY = circleRect.top - wrapperRect.top;

    bubbleEl.style.left = `${centerX}px`;
    bubbleEl.style.top = `${topY}px`;
  });
}

async function handleSignalingMessage(data) {
  if (!data || data.sender === state.userName) return;

  if (data.type === 'toggle-circle-speech') {
    state.circleSpeechEnabled = data.enabled;
    document.body.classList.toggle('circle-speech-on', state.circleSpeechEnabled);
    if (elements.toggleCircleSpeechBtn) {
      elements.toggleCircleSpeechBtn.innerHTML = state.circleSpeechEnabled ? '<span>💭 Circle Speech: On</span>' : '<span>💭 Circle Speech: Off</span>';
      elements.toggleCircleSpeechBtn.classList.toggle('active', state.circleSpeechEnabled);
    }
    if (!state.circleSpeechEnabled) {
      if (elements.remoteCircleSpeech) elements.remoteCircleSpeech.classList.add('hidden');
      if (elements.localCircleSpeech) elements.localCircleSpeech.classList.add('hidden');
    }
    return;
  } else if (data.type === 'screen-share-toggle') {
    state.partnerScreenSharing = data.isScreenSharing;
    if (state.partnerScreenSharing) {
      if (elements.screenShareVideo && elements.remoteVideo) {
        elements.screenShareVideo.srcObject = elements.remoteVideo.srcObject;
        elements.screenShareVideo.play().catch(e => console.debug(e));
      }
      elements.screenShareContainer?.classList.remove('hidden');
    } else {
      if (elements.screenShareVideo) elements.screenShareVideo.srcObject = null;
      elements.screenShareContainer?.classList.add('hidden');
    }
    updateVideoLayout();
    return;
  }

  if (data.type === 'cam-toggle') {
    if (elements.remoteCamOff) elements.remoteCamOff.classList.toggle('hidden', !data.isCamOff);
    return;
  } else if (data.type === 'theme-change') {
    applyTheme(data.theme, data.themeLabel, false);
    return;
  }

  if (data.type === 'call-invite') {
    if (!state.isCalling) {
      showToast(`📹 ${data.sender} is inviting you to a live video call!`, 'info');
      if (elements.inviteSenderText) elements.inviteSenderText.textContent = `${data.sender} is inviting you to a Video Call!`;
      elements.callInviteModal?.classList.remove('hidden');
      triggerRemotePushNotification('📹 Video Call Invitation', `${data.sender} invited you to join a live video stream!`);
    }
    return;
  } else if (data.type === 'call-accept') {
    showToast(`✨ ${data.sender} accepted your invite! Connecting stream...`, 'success');
    if (!state.isCalling) initiateVideoCall();
    return;
  } else if (data.type === 'call-decline') {
    showToast(`⚠️ ${data.sender} declined the video call invitation.`, 'error');
    return;
  }

  if (data.type === 'offer') {
    if (!state.isCalling) {
      state.pendingOffer = data;
      showToast(`📹 ${data.sender} started a video call!`, 'info');
      if (elements.inviteSenderText) elements.inviteSenderText.textContent = `${data.sender} is inviting you to a Video Call!`;
      elements.callInviteModal?.classList.remove('hidden');
      triggerRemotePushNotification('📹 Video Call Invitation', `${data.sender} invited you to join a live video stream!`);
      return;
    }

    showToast(`📹 Connecting partner video stream...`, 'success');
    if (!state.peerConnection) setupPeerConnection();

    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await state.peerConnection.createAnswer();
    await state.peerConnection.setLocalDescription(answer);

    sendSignaling({
      type: 'answer',
      sdp: answer,
      sender: state.userName
    });

    if (state.pendingIceCandidates && state.pendingIceCandidates.length > 0) {
      for (const cand of state.pendingIceCandidates) {
        try { await state.peerConnection.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
      }
      state.pendingIceCandidates = [];
    }

  } else if (data.type === 'answer' && state.peerConnection) {
    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (state.pendingIceCandidates && state.pendingIceCandidates.length > 0) {
      for (const cand of state.pendingIceCandidates) {
        try { await state.peerConnection.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
      }
      state.pendingIceCandidates = [];
    }
  } else if (data.type === 'ice-candidate') {
    if (state.peerConnection && state.peerConnection.remoteDescription) {
      try {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('ICE add error:', e);
      }
    } else {
      if (!state.pendingIceCandidates) state.pendingIceCandidates = [];
      state.pendingIceCandidates.push(data.candidate);
    }
  } else if (data.type === 'end-call') {
    showToast('Partner left the video call.', 'info');
    cleanupMedia();
  }
}

function endVideoCall() {
  if (!state.isCalling) return;
  sendSignaling({ type: 'end-call', sender: state.userName });
  cleanupMedia();
  clearVideoMessages();
  showToast('You left the call.', 'info');
}

function cleanupMedia() {
  if (state.screenStream) {
    state.screenStream.getTracks().forEach(t => t.stop());
    state.screenStream = null;
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach(t => t.stop());
    state.localStream = null;
  }
  if (state.peerConnection) {
    state.peerConnection.close();
    state.peerConnection = null;
  }
  elements.videoUi?.classList.add('hidden');
  if (elements.remoteVideo) elements.remoteVideo.srcObject = null;
  if (elements.screenShareVideo) elements.screenShareVideo.srcObject = null;
  if (elements.screenShareContainer) elements.screenShareContainer.classList.add('hidden');
  if (elements.remoteCamOff) elements.remoteCamOff.classList.add('hidden');
  if (elements.localCamOff) elements.localCamOff.classList.add('hidden');
  state.isCalling = false;
  state.isScreenSharing = false;
  state.enlargedPane = null;
  updateVideoLayout();
  if (elements.toggleScreenBtn) elements.toggleScreenBtn.classList.remove('active');
}

function toggleMute() {
  if (!state.localStream) return;
  state.isMuted = !state.isMuted;
  state.localStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
  updateControlEmojis();
  showToast(state.isMuted ? 'Microphone muted' : 'Microphone unmuted');
}

function toggleCamera() {
  if (!state.localStream) return;
  state.isCamOff = !state.isCamOff;
  state.localStream.getVideoTracks().forEach(t => t.enabled = !state.isCamOff);
  updateControlEmojis();
  if (elements.localCamOff) {
    elements.localCamOff.classList.toggle('hidden', !state.isCamOff);
  }
  sendSignaling({ type: 'cam-toggle', isCamOff: state.isCamOff, sender: state.userName });
  showToast(state.isCamOff ? 'Camera turned off' : 'Camera turned on');
}

function updateControlEmojis() {
  const isPurpleOrYellow = state.activeTheme === 'purple' || state.activeTheme === 'yellow' || state.activeTheme === 'purple-yellow';
  if (elements.toggleMuteBtn) {
    elements.toggleMuteBtn.classList.toggle('active-off', state.isMuted);
    if (isPurpleOrYellow) {
      elements.toggleMuteBtn.textContent = state.isMuted ? '🔇' : '〰️';
    } else {
      elements.toggleMuteBtn.textContent = state.isMuted ? '🔇' : '🎙️';
    }
  }
  if (elements.toggleCamBtn) {
    elements.toggleCamBtn.classList.toggle('active-off', state.isCamOff);
    if (isPurpleOrYellow) {
      elements.toggleCamBtn.textContent = state.isCamOff ? '🚫' : '⚡';
    } else {
      elements.toggleCamBtn.textContent = state.isCamOff ? '🚫' : '📷';
    }
  }
}

/**
 * Enable Web Push Notifications (VAPID)
 */
async function handleEnablePush(silent = false) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (!silent) showToast('Push notifications are not supported in this browser.', 'error');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (!silent) showToast('Push notification permission denied.', 'error');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    
    // Demo / Standard VAPID Public Key
    const publicVapidKey = MANUAL_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    state.pushSubscription = subscription;
    console.log('Push subscription acquired:', JSON.stringify(subscription));

    // Save subscription to Supabase 'subscriptions' table
    if (state.supabase && state.roomCode) {
      await state.supabase.from('subscriptions').upsert([{
        room_code: state.roomCode,
        push_sub: JSON.stringify(subscription)
      }]);
    }

    if (!silent) showToast('🔔 Push Notifications enabled for this device!', 'success');
    showNativeNotification('🔔 Push Notifications Active', 'You will now receive notifications when your partner sends pages or calls!');
  } catch (err) {
    console.error('Push setup failed:', err);
    if (!silent) showToast('Could not register push notifications.', 'error');
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function triggerRemotePushNotification(title, body) {
  // Invokes Supabase Edge Function to push notification to partner
  if (!state.supabase || !MANUAL_SUPABASE_URL) return;
  try {
    await state.supabase.functions.invoke('send-push', {
      body: { room_code: state.roomCode, sender: state.userName, title, message: body }
    });
  } catch (err) {
    console.debug('Edge push trigger note:', err?.message);
  }
}

// =========================================================================
// VIDEO CALL INVITATION & PRESENCE
// =========================================================================
function sendCallInvite() {
  initiateVideoCall();
}

async function acceptCallInvite() {
  elements.callInviteModal?.classList.add('hidden');
  sendSignaling({ type: 'call-accept', sender: state.userName });
  
  if (state.pendingOffer && state.pendingOffer.sdp) {
    const offerData = state.pendingOffer;
    state.pendingOffer = null;
    await answerPendingVideoCall(offerData);
  } else {
    initiateVideoCall();
  }
}

async function answerPendingVideoCall(data) {
  if (state.isCalling) return;
  try {
    await getOrAcquireLocalStream();
    if (elements.localVideo && state.localStream) {
      elements.localVideo.srcObject = state.localStream;
      elements.localVideo.play().catch(e => console.debug('localVideo play note:', e));
    }
    elements.videoUi?.classList.remove('hidden');
    if (elements.remoteWaitingOverlay) elements.remoteWaitingOverlay.style.display = 'flex';
    state.isCalling = true;

    if (!state.peerConnection) setupPeerConnection();

    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await state.peerConnection.createAnswer();
    await state.peerConnection.setLocalDescription(answer);

    sendSignaling({
      type: 'answer',
      sdp: answer,
      sender: state.userName
    });
    if (state.pendingIceCandidates && state.pendingIceCandidates.length > 0) {
      for (const cand of state.pendingIceCandidates) {
        try { await state.peerConnection.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
      }
      state.pendingIceCandidates = [];
    }
    showToast('Joined live video call! Connecting stream...', 'success');
  } catch (err) {
    showToast('Could not access camera/microphone. Please check browser permissions.', 'error');
    console.error('WebRTC media error:', err);
  }
}

function declineCallInvite() {
  elements.callInviteModal?.classList.add('hidden');
  state.pendingOffer = null;
  sendSignaling({ type: 'call-decline', sender: state.userName });
  showToast('You declined the video call.', 'info');
}

// =========================================================================
// VIDEO CALL LAYOUT CONTROLS (Side-by-Side Default, Click-to-Enlarge, Draggable PiP)
// =========================================================================
function handlePaneClick(paneName) {
  const container = paneName === 'remote' ? elements.remoteVideoContainer : elements.localVideoContainer;
  if (container?.dataset.wasDragged === 'true') {
    delete container.dataset.wasDragged;
    return;
  }

  // Do not reset position or enlarge circles when clicked in screen sharing mode
  if (state.isScreenSharing) return;

  if (state.enlargedPane === paneName) {
    state.enlargedPane = null; // Return to equal side-by-side
    showToast('Screen layout: Side by Side (50/50)');
  } else {
    state.enlargedPane = paneName;
    showToast(`Screen layout: Enlarged ${paneName === 'remote' ? 'Partner' : 'You'}`);
  }
  updateVideoLayout();
}

function updateVideoLayout() {
  const wrapper = elements.videoPanesWrapper;
  if (!wrapper) return;

  const isScreenShareMode = state.isScreenSharing || state.partnerScreenSharing;
  document.body.classList.toggle('layout-circles-active', isScreenShareMode);

  wrapper.classList.remove('layout-equal', 'layout-enlarged', 'layout-circles');
  elements.remoteVideoContainer?.classList.remove('enlarged', 'pip', 'circle');
  elements.localVideoContainer?.classList.remove('enlarged', 'pip', 'circle');

  // Reset custom positioning coordinates when returning to default side-by-side
  if (!isScreenShareMode && !state.enlargedPane) {
    wrapper.classList.add('layout-equal');
    if (elements.remoteVideoContainer) elements.remoteVideoContainer.style.cssText = 'position: relative; flex: 50;';
    if (elements.localVideoContainer) elements.localVideoContainer.style.cssText = 'position: relative; flex: 50;';
    updateSpeechBubblePositions();
    return;
  }

  if (isScreenShareMode) {
    wrapper.classList.add('layout-circles');
    elements.remoteVideoContainer?.classList.add('circle');
    elements.localVideoContainer?.classList.add('circle');
    // Preserve custom circle position/dimensions if previously dragged or resized
    if (!elements.remoteVideoContainer.style.top && !elements.remoteVideoContainer.style.left) {
      elements.remoteVideoContainer.style.top = '30px';
      elements.remoteVideoContainer.style.left = '30px';
    }
    if (!elements.localVideoContainer.style.bottom && !elements.localVideoContainer.style.right) {
      elements.localVideoContainer.style.bottom = '30px';
      elements.localVideoContainer.style.right = '30px';
    }
  } else if (state.enlargedPane === 'remote') {
    wrapper.classList.add('layout-enlarged');
    elements.remoteVideoContainer?.classList.add('enlarged');
    elements.localVideoContainer?.classList.add('pip');
    if (elements.remoteVideoContainer) elements.remoteVideoContainer.style.cssText = '';
    if (elements.localVideoContainer) elements.localVideoContainer.style.cssText = '';
  } else if (state.enlargedPane === 'local') {
    wrapper.classList.add('layout-enlarged');
    elements.localVideoContainer?.classList.add('enlarged');
    elements.remoteVideoContainer?.classList.add('pip');
    if (elements.remoteVideoContainer) elements.remoteVideoContainer.style.cssText = '';
    if (elements.localVideoContainer) elements.localVideoContainer.style.cssText = '';
  }
  updateSpeechBubblePositions();
}

function setupPaneDragging(paneEl) {
  if (!paneEl) return;
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

  const onStart = (e) => {
    if (e.target?.classList.contains('custom-pane-resizer')) return;
    if (!paneEl.classList.contains('pip') && !paneEl.classList.contains('circle')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    isDragging = true;
    startX = clientX;
    startY = clientY;
    
    const rect = paneEl.getBoundingClientRect();
    const parentRect = elements.videoPanesWrapper?.getBoundingClientRect() || { left: 0, top: 0 };
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
  };

  const onMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      paneEl.dataset.wasDragged = 'true';
    }

    const wrapper = elements.videoPanesWrapper;
    if (!wrapper) return;
    const minLeft = -paneEl.clientWidth + 60;
    const maxLeft = wrapper.clientWidth - 60;
    const minTop = -paneEl.clientHeight + 60;
    const maxTop = wrapper.clientHeight - 60;

    let newLeft = Math.max(minLeft, Math.min(maxLeft, initialLeft + dx));
    let newTop = Math.max(minTop, Math.min(maxTop, initialTop + dy));

    paneEl.style.left = `${newLeft}px`;
    paneEl.style.top = `${newTop}px`;
    paneEl.style.right = 'auto';
    paneEl.style.bottom = 'auto';
    updateSpeechBubblePositions();
  };

  const onEnd = () => {
    isDragging = false;
  };

  paneEl.addEventListener('mousedown', onStart);
  paneEl.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function setupPaneResizer(paneEl) {
  if (!paneEl) return;
  const resizerBtn = paneEl.querySelector('.custom-pane-resizer');
  if (!resizerBtn) return;

  let isResizing = false;
  let startX = 0, startY = 0, initialW = 0, initialH = 0;

  const onStart = (e) => {
    e.stopPropagation();
    isResizing = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    initialW = paneEl.clientWidth;
    initialH = paneEl.clientHeight;

    // Anchor top/left before resizing so expanding width/height goes smoothly towards cursor without jumping
    paneEl.style.left = `${paneEl.offsetLeft}px`;
    paneEl.style.top = `${paneEl.offsetTop}px`;
    paneEl.style.right = 'auto';
    paneEl.style.bottom = 'auto';
  };

  const onMove = (e) => {
    if (!isResizing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (paneEl.classList.contains('circle')) {
      // Keep perfect circle aspect ratio by changing radius uniformly
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const newSize = Math.max(120, Math.min(650, initialW + delta));
      paneEl.style.width = `${newSize}px`;
      paneEl.style.height = `${newSize}px`;
    } else if (paneEl.classList.contains('pip')) {
      // Change length and width together proportionally when resizing sideways
      const newWidth = Math.max(140, Math.min(800, initialW + dx));
      const ratio = (initialH || 180) / (initialW || 260);
      const newHeight = Math.round(newWidth * ratio);
      paneEl.style.width = `${newWidth}px`;
      paneEl.style.height = `${newHeight}px`;
    }
    updateSpeechBubblePositions();
  };

  const onEnd = () => {
    isResizing = false;
  };

  resizerBtn.addEventListener('mousedown', onStart);
  resizerBtn.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function setupManualResizer() {
  const resizer = elements.videoResizer;
  const wrapper = elements.videoPanesWrapper;
  const leftPane = elements.remoteVideoContainer;
  const rightPane = elements.localVideoContainer;
  if (!resizer || !wrapper || !leftPane || !rightPane) return;

  let isResizing = false;

  const onStart = (e) => {
    if (!wrapper.classList.contains('layout-equal')) return;
    isResizing = true;
    wrapper.classList.add('resizing-active');
    document.body.style.cursor = 'col-resize';
  };

  const onMove = (e) => {
    if (!isResizing || !wrapper.classList.contains('layout-equal')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = wrapper.getBoundingClientRect();
    const offset = clientX - rect.left;
    const percent = Math.max(15, Math.min(85, (offset / rect.width) * 100));
    leftPane.style.flex = `${percent}`;
    rightPane.style.flex = `${100 - percent}`;
  };

  const onEnd = () => {
    if (isResizing) {
      isResizing = false;
      wrapper.classList.remove('resizing-active');
      document.body.style.cursor = '';
    }
  };

  resizer.addEventListener('mousedown', onStart);
  resizer.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function toggleImmersiveFullscreen() {
  state.isImmersiveMode = !state.isImmersiveMode;
  if (state.isImmersiveMode) {
    elements.videoUi?.classList.add('immersive-mode');
    if (elements.toggleChatBgBtn) elements.toggleChatBgBtn.innerHTML = '<span>🖥️ Normal UI</span>';
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    showToast('✨ Immersive Fullscreen Mode. Only videos, floating messages, and input box visible. Hover top-left or press Esc to exit.');
  } else {
    exitImmersiveFullscreen();
  }
}

function exitImmersiveFullscreen() {
  state.isImmersiveMode = false;
  elements.videoUi?.classList.remove('immersive-mode');
  if (elements.toggleChatBgBtn) elements.toggleChatBgBtn.innerHTML = '<span>🖥️ Fullscreen Chat</span>';
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  showToast('Restored standard controls.');
}

function toggleTts() {
  state.ttsEnabled = !state.ttsEnabled;
  if (elements.toggleTtsBtn) {
    elements.toggleTtsBtn.innerHTML = state.ttsEnabled ? '<span>🔊 TTS: On</span>' : '<span>🔊 TTS: Off</span>';
    elements.toggleTtsBtn.classList.toggle('active', state.ttsEnabled);
  }
  showToast(state.ttsEnabled ? '🔊 Message Speech (TTS) enabled for your & partner messages' : '🔇 Message Speech disabled');
}

// =========================================================================
// SCREEN SHARING FUNCTIONALITY (Shows Both Camera & Screen Feed)
// =========================================================================
async function toggleScreenShare() {
  if (!state.peerConnection || !state.localStream) {
    showToast('Join or start a video call before screen sharing.', 'error');
    return;
  }

  if (state.isScreenSharing) {
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(t => t.stop());
      state.screenStream = null;
    }
    const camTrack = state.localStream.getVideoTracks()[0];
    const sender = state.peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (sender && camTrack) {
      await sender.replaceTrack(camTrack);
    }
    if (elements.localVideo) elements.localVideo.srcObject = state.localStream;
    if (elements.screenShareVideo) elements.screenShareVideo.srcObject = null;
    elements.screenShareContainer?.classList.add('hidden');
    state.isScreenSharing = false;
    if (elements.toggleScreenBtn) {
      elements.toggleScreenBtn.classList.remove('active');
    }
    updateVideoLayout();
    sendSignaling({ type: 'screen-share-toggle', isScreenSharing: false, sender: state.userName });
    showToast('Screen sharing stopped.');
  } else {
    try {
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = state.screenStream.getVideoTracks()[0];
      
      screenTrack.onended = () => {
        if (state.isScreenSharing) toggleScreenShare();
      };

      const sender = state.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      }
      if (elements.screenShareVideo) {
        elements.screenShareVideo.srcObject = state.screenStream;
        elements.screenShareVideo.play().catch(e => console.debug(e));
      }
      elements.screenShareContainer?.classList.remove('hidden');
      state.isScreenSharing = true;
      if (elements.toggleScreenBtn) {
        elements.toggleScreenBtn.classList.add('active');
      }
      updateVideoLayout();
      sendSignaling({ type: 'screen-share-toggle', isScreenSharing: true, sender: state.userName });
      showToast('🖥️ Screen sharing active! Camera feeds converted to resizable floating circles.', 'success');
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
    }
  }
}

// =========================================================================
// THEMES & MESSAGE CLEARING
// =========================================================================
function getThemeLabel(themeName) {
  if (themeName === 'slate') return '🤎 Warm Slate';
  if (themeName === 'electric-blue') return '⚡ Electric Blue';
  if (themeName === 'pastel-blue') return '🫧 Pastel Blue';
  if (themeName === 'glass') return '🔮 Transparent Glass';
  if (themeName === 'purple') return '💜 Purple';
  if (themeName === 'yellow') return '💛 Yellow';
  if (themeName === 'matcha') return '🍵 Matcha';
  if (themeName === 'strawberry') return '🍓 Strawberry';
  return themeName;
}

function handleThemeSelection(themeName) {
  if (themeName === 'purple-yellow') {
    // 50% chance for whoever pressed it to get purple vs yellow
    const chosenTheme = Math.random() < 0.5 ? 'purple' : 'yellow';
    const partnerTheme = chosenTheme === 'purple' ? 'yellow' : 'purple';
    applyTheme(chosenTheme, chosenTheme === 'purple' ? '💜 Purple' : '💛 Yellow', false);
    sendSignaling({ type: 'theme-change', theme: partnerTheme, themeLabel: partnerTheme === 'purple' ? '💜 Purple' : '💛 Yellow', sender: state.userName });
    showToast(`🎲 50/50 Random Theme: You received the ${chosenTheme.toUpperCase()} theme!`);
  } else if (themeName === 'matcha-strawberry') {
    // 50% chance for whoever pressed it to get matcha vs strawberry
    const chosenTheme = Math.random() < 0.5 ? 'matcha' : 'strawberry';
    const partnerTheme = chosenTheme === 'matcha' ? 'strawberry' : 'matcha';
    applyTheme(chosenTheme, chosenTheme === 'matcha' ? '🍵 Matcha' : '🍓 Strawberry', false);
    sendSignaling({ type: 'theme-change', theme: partnerTheme, themeLabel: partnerTheme === 'matcha' ? '🍵 Matcha' : '🍓 Strawberry', sender: state.userName });
    showToast(`🎲 50/50 Random Theme: You received the ${chosenTheme.toUpperCase()} theme!`);
  } else {
    applyTheme(themeName, getThemeLabel(themeName), true);
  }
}

function applyTheme(themeName, themeLabel, broadcast = true) {
  state.activeTheme = themeName;
  localStorage.setItem('b612_theme', themeName);
  document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
  document.body.classList.add(`theme-${themeName}`);
  if (elements.videoUi) {
    elements.videoUi.className = elements.videoUi.className.replace(/\btheme-\S+/g, '').trim();
    elements.videoUi.classList.add(`theme-${themeName}`);
    if (state.isImmersiveMode) elements.videoUi.classList.add('immersive-mode');
  }
  if (elements.themeColorBtn && themeLabel) {
    elements.themeColorBtn.querySelector('span').textContent = `🎨 Theme: ${themeLabel}`;
  }
  if (elements.roomThemeBtn && themeLabel) {
    elements.roomThemeBtn.title = `Theme: ${themeLabel}`;
  }
  if (elements.frontThemeBtn && themeLabel) {
    elements.frontThemeBtn.title = `Theme: ${themeLabel}`;
  }
  updateControlEmojis();
  showToast(`🎨 Page theme set to ${themeLabel || themeName}!`);
  if (broadcast) {
    sendSignaling({ type: 'theme-change', theme: themeName, themeLabel: themeLabel || themeName, sender: state.userName });
  }
}

async function clearRoomMessages() {
  if (!elements.chatFeed) return;
  elements.chatFeed.innerHTML = '<div class="empty-feed">Room messages cleared.</div>';
  state.activitiesCount = 0;
  if (elements.feedCount) elements.feedCount.textContent = '0 messages';
  if (state.supabase && state.roomCode) {
    try {
      await state.supabase.from('messages').delete().eq('room_code', state.roomCode);
    } catch (e) { console.warn(e); }
  }
  showToast('🧹 All room messages deleted!', 'success');
}

function clearVideoMessages() {
  if (!elements.videoChatFeed) return;
  elements.videoChatFeed.innerHTML = '';
  showToast('🧹 Video call session messages cleared.');
}

