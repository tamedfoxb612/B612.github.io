const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room') || 'DEFAULT';
const userName = urlParams.get('user') || 'Player1';

document.getElementById('room-id-display').textContent = roomCode;
document.getElementById('local-label').textContent = userName;

document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = './index.html?room=' + encodeURIComponent(roomCode) + '&user=' + encodeURIComponent(userName);
});

// Relay & Media Setup
let lastPollId = 0;
const seenEventIds = new Set();
let peerConnection = null;
let localStream = null;
let peerName = "Partner";
let isMuted = false;
let isCamOff = false;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

async function startLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
    } catch (e) {
        console.error("Camera+Audio failed, trying video only", e);
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true });
            document.getElementById('local-video').srcObject = localStream;
        } catch (e2) {
            console.error("Camera failed completely", e2);
        }
    }
}

function sendRelay(payload) {
    fetch('/api/relay?room=' + encodeURIComponent(roomCode), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: userName, timestamp: Date.now(), ...payload })
    }).catch(err => console.error("Relay send error", err));
}

function appendChat(sender, text, isSelf) {
    const feed = document.getElementById('chat-feed');
    const div = document.createElement('div');
    div.className = 'chat-msg' + (isSelf ? ' self' : '');
    div.innerHTML = `<b>${sender}</b><span>${text}</span>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
}

document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    appendChat(userName, text, true);
    sendRelay({ type: 'pt-chat', text: text });
    input.value = '';
});

document.getElementById('mic-btn').addEventListener('click', () => {
    isMuted = !isMuted;
    if (localStream) {
        localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    }
    const btn = document.getElementById('mic-btn');
    if (isMuted) {
        btn.classList.add('off');
        btn.textContent = '🔇';
    } else {
        btn.classList.remove('off');
        btn.textContent = '🎙️';
    }
});

document.getElementById('cam-btn').addEventListener('click', () => {
    isCamOff = !isCamOff;
    if (localStream) {
        localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
    }
    const btn = document.getElementById('cam-btn');
    if (isCamOff) {
        btn.classList.add('off');
        btn.textContent = '🚫';
    } else {
        btn.classList.remove('off');
        btn.textContent = '📷';
    }
});

function processRelayEvent(data) {
    if (!data) return;
    const evtId = data.id || (data.timestamp + '_' + data.type);
    if (seenEventIds.has(evtId)) return;
    seenEventIds.add(evtId);
    if (data.sender === userName) return;
    
    peerName = data.sender || "Partner";
    document.getElementById('remote-label').textContent = peerName;

    if (data.type === 'pt-chat' && data.text) {
        appendChat(peerName, data.text, false);
    } else if (data.type === 'pt-game-input' && data.payload) {
        const p = data.payload;
        let syntheticEvent;
        if (p.eventType === 'keydown' || p.eventType === 'keyup') {
            syntheticEvent = new KeyboardEvent(p.eventType, {
                key: p.key, code: p.code, keyCode: p.keyCode, which: p.keyCode,
                bubbles: true, cancelable: true, view: window
            });
        } else if (p.eventType && p.eventType.startsWith('mouse')) {
            syntheticEvent = new MouseEvent(p.eventType, {
                clientX: p.clientX || 0, clientY: p.clientY || 0, button: p.button || 0,
                buttons: p.eventType === 'mousedown' ? 1 : 0,
                bubbles: true, cancelable: true, view: window
            });
        }
        if (syntheticEvent) {
            syntheticEvent._isSynthetic = true;
            window.dispatchEvent(syntheticEvent);
            document.dispatchEvent(syntheticEvent);
            const canvas = document.querySelector('#game-container canvas');
            if (canvas) canvas.dispatchEvent(syntheticEvent);
        }
    } else if (data.type === 'call-invite' || data.type === 'pt-presence') {
        answerCall();
    } else if (data.type === 'offer') {
        handleOffer(data.offer);
    } else if (data.type === 'answer') {
        handleAnswer(data.answer);
    } else if (data.type === 'ice-candidate') {
        handleCandidate(data.candidate);
    }
}

async function startPoll() {
    setInterval(async () => {
        try {
            const res = await fetch(`/api/relay?room=${encodeURIComponent(roomCode)}&since=${lastPollId}`);
            if (res.ok) {
                const events = await res.json();
                events.forEach(evt => {
                    if (evt.id > lastPollId) lastPollId = evt.id;
                    processRelayEvent(evt);
                });
            }
        } catch (e) {}
    }, 250);
}

let dataChannel = null;
const broadcastChannel = new BroadcastChannel(`pt_game_${roomCode}`);
broadcastChannel.onmessage = (event) => {
    if (event.data) processRelayEvent(event.data);
};

function setupDataChannel(channel) {
    dataChannel = channel;
    dataChannel.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            processRelayEvent(data);
        } catch (e) {}
    };
}

function createPeerConnection() {
    if (peerConnection) return peerConnection;
    peerConnection = new RTCPeerConnection(configuration);
    
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendRelay({ type: 'ice-candidate', candidate: event.candidate });
        }
    };

    peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel);
    };

    return peerConnection;
}

async function startCall() {
    createPeerConnection();
    try {
        const channel = peerConnection.createDataChannel("gameSync");
        setupDataChannel(channel);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendRelay({ type: 'offer', offer: offer });
    } catch (e) {
        console.error("Error creating offer", e);
    }
}

async function handleOffer(offer) {
    createPeerConnection();
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendRelay({ type: 'answer', answer: answer });
    } catch (e) {
        console.error("Error handling offer", e);
    }
}

async function handleAnswer(answer) {
    if (!peerConnection) return;
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
        console.error("Error handling answer", e);
    }
}

async function handleCandidate(candidate) {
    if (!peerConnection) return;
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error("Error adding candidate", e);
    }
}

function answerCall() {
    if (userName > peerName) { startCall(); } else { setTimeout(startCall, 500); }
}

// Forward local game input to partner
let lastRelaySendTime = 0;
function broadcastGameInput(eventType, e) {
    if (e._isSynthetic) return;
    const payload = {
        eventType: eventType,
        key: e.key, code: e.code, keyCode: e.keyCode,
        clientX: e.clientX, clientY: e.clientY, button: e.button
    };
    const msg = {
        type: 'pt-game-input',
        sender: userName,
        timestamp: Date.now(),
        id: Date.now() + '_' + Math.random(),
        payload: payload
    };
    if (dataChannel && dataChannel.readyState === 'open') {
        try { dataChannel.send(JSON.stringify(msg)); } catch (err) {}
    }
    try { broadcastChannel.postMessage(msg); } catch (err) {}
    const now = Date.now();
    if (now - lastRelaySendTime > 40 || eventType.includes('key')) {
        lastRelaySendTime = now;
        sendRelay({ type: 'pt-game-input', payload: payload });
    }
}

['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove'].forEach(eventType => {
    window.addEventListener(eventType, (e) => broadcastGameInput(eventType, e), true);
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Ruffle directly in the main document without iframe sandbox restrictions
    try {
        const ruffle = window.RufflePlayer.newest();
        const player = ruffle.createPlayer();
        const container = document.getElementById('game-container');
        if (container) {
            container.appendChild(player);
            player.load("https://cdn.jsdelivr.net/gh/StarRepo444/ClassroomPlayV2@c28ef0cfdccbbfc61a42d9954f14af3115c7398a/games/flash/swf/fbwg.swf");
        }
    } catch (err) {
        console.error("Ruffle init error:", err);
    }

    await startLocalMedia();
    startPoll();
    sendRelay({ type: 'pt-presence' });
});
