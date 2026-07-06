let isPartnerInitiated = false;

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-btn').addEventListener('click', () => {
    loadGames(document.getElementById('search-input').value);
  });
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadGames(e.target.value);
  });
  document.getElementById('back-btn').addEventListener('click', () => {
    closeGame();
    // Notify parent window to broadcast to partner
    window.parent.postMessage({ type: 'arcade-back' }, '*');
  });

  loadGames('');
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'arcade-play') {
    isPartnerInitiated = true;
    playGame(data.swfUrl, data.gameTitle);
  } else if (data && data.type === 'arcade-back') {
    closeGame();
  }
});

async function loadGames(userQuery = "") {
  const status = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  if (!status || !resultsDiv) return;
    
  status.innerText = "Loading archive contents...";
  resultsDiv.innerHTML = "";

  try {
    let gamesList = null;
    try {
      const apiRes = await fetch(`/api/arcade-games?query=${encodeURIComponent(userQuery)}`);
      if (apiRes.ok) gamesList = await apiRes.json();
    } catch { gamesList = null; }

    if (gamesList && gamesList.length > 0) {
      status.innerText = `Loaded ${gamesList.length} games successfully.`;
      gamesList.forEach(item => {
        const directUrl = item.swfUrl;
        const thumbnailUrl = item.thumbnailUrl;
        const fallbackThumbUrl = item.identifier ? `https://archive.org/services/img/${item.identifier}` : '';
        const safeTitle = (item.title || "").replace(/'/g, "\\'");
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
          <div class="thumbnail-container">
            <img src="${thumbnailUrl}" alt="Cover" referrerPolicy="no-referrer" onerror="if(this.src !== '${fallbackThumbUrl}' && '${fallbackThumbUrl}'){ this.src='${fallbackThumbUrl}'; } else { this.style.display='none'; this.nextElementSibling.style.display='block'; }">
            <span class="fallback-text" style="display:none;">NO COVER ART</span>
          </div>
          <div class="result-info">
            <div class="result-title">${item.title}</div>
            <button class="play-btn" onclick="playGame('${directUrl}', '${safeTitle}')">► PLAY NOW</button>
          </div>
        `;
        resultsDiv.appendChild(card);
      });
    } else {
      status.innerText = "No games found.";
    }
  } catch (error) {
    status.innerText = `Fetch failed: ${error.message}`;
  }
}

window.RufflePlayer = window.RufflePlayer || {};

function playGame(swfUrl, gameTitle = "Arcade Game") {
  document.getElementById('vault-section').style.display = 'none';
  document.getElementById('player-section').style.display = 'flex';
  document.getElementById('search-box').style.display = 'none';

  const container = document.getElementById('player-container');
  document.getElementById('now-playing').innerText = `> Now Playing: ${gameTitle}`;
  container.innerHTML = '';
    
  const proxiedUrl = swfUrl.startsWith('http') ? `/api/proxy-swf?url=${encodeURIComponent(swfUrl)}` : swfUrl;
  const ruffle = window.RufflePlayer?.newest();
  if (ruffle) {
    const player = ruffle.createPlayer();
    player.style.width = '100%';
    player.style.height = '100%';
    container.appendChild(player);
    player.load({ url: proxiedUrl, autoplay: true, allowScriptAccess: false }).catch(() => {
      player.load({ url: swfUrl, autoplay: true, allowScriptAccess: false });
    });
  } else {
    container.innerHTML = '<span class="placeholder-text">Initializing Ruffle...</span>';
  }

  if (!isPartnerInitiated) {
    window.parent.postMessage({ type: 'arcade-play', swfUrl, gameTitle }, '*');
  }
  isPartnerInitiated = false;
}

function closeGame() {
  document.getElementById('vault-section').style.display = 'block';
  document.getElementById('player-section').style.display = 'none';
  document.getElementById('search-box').style.display = 'flex';
  
  const container = document.getElementById('player-container');
  container.innerHTML = '<span class="placeholder-text">Select a game from the vault to begin playing.</span>';
}

// Make playGame available globally for the onclick handlers
window.playGame = playGame;
