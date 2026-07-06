window.RufflePlayer = window.RufflePlayer || {};
window.RufflePlayer.config = {
    autoplay: "on",
    unmuteOverlay: "hidden",
};
// play-together.js
// Handles the Flash Archive game selection and multiplayer interaction synchronization

document.addEventListener('DOMContentLoaded', () => {
  const ptModal = document.getElementById('play-together-modal');
  const togglePtBtn = document.getElementById('toggle-play-together-btn');
  const closePtModalBtn = document.getElementById('close-pt-modal-btn');
  const ptSearchInput = document.getElementById('pt-search-input');
  const ptSearchBtn = document.getElementById('pt-search-btn');
  const ptGamesGrid = document.getElementById('pt-games-grid');
  const ptStatusText = document.getElementById('pt-status-text');
  
  const ptContainer = document.getElementById('play-together-container');
  const ptPlayerRoot = document.getElementById('play-together-player-root');
  const ptCloseGameBtn = document.getElementById('pt-close-game-btn');
  
  let currentRufflePlayer = null;
  let isHostingGame = false;
  
  // Toggle Play Together Modal
  togglePtBtn?.addEventListener('click', () => {
    ptModal.classList.remove('hidden');
    if (ptGamesGrid.innerHTML.trim() === '') {
      loadGames("");
    }
  });
  
  closePtModalBtn?.addEventListener('click', () => {
    ptModal.classList.add('hidden');
  });
  
  ptSearchBtn?.addEventListener('click', () => {
    loadGames(ptSearchInput.value);
  });
  
  ptSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadGames(ptSearchInput.value);
    }
  });
  
  ptCloseGameBtn?.addEventListener('click', () => {
    closeGame(true);
  });
  
  async function loadGames(userQuery) {
    ptStatusText.textContent = "Loading archive contents...";
    ptGamesGrid.innerHTML = '';
    
    try {
      let searchUrl = "";
      if (userQuery.trim() === "") {
        searchUrl = `https://archive.org/advancedsearch.php?q=collection:(softwarelibrary_flash) AND format:(Shockwave Flash)&fl[]=identifier,title&rows=60&output=json`;
      } else {
        searchUrl = `https://archive.org/advancedsearch.php?q=title:(*${encodeURIComponent(userQuery)}*) AND (format:"Shockwave Flash" OR format:"Flash")&fl[]=identifier,title&rows=60&output=json`;
      }
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const rawItems = searchData.response.docs;

      if (!rawItems || rawItems.length === 0) {
        ptStatusText.textContent = "No games found matches your request.";
        return;
      }

      ptStatusText.textContent = "Deduplicating entries and sorting alphabetically...";
      
      const uniqueGames = {};
      for (const item of rawItems) {
        let title = item.title ? item.title.trim() : item.identifier;
        let cleanTitle = title.toLowerCase();
        
        if (!uniqueGames[cleanTitle]) {
          uniqueGames[cleanTitle] = {
            title: title,
            identifier: item.identifier,
            directUrl: '',
            thumbnailUrl: `https://archive.org/services/img/${item.identifier}`
          };
        }
      }

      const sortedGames = Object.values(uniqueGames).sort((a, b) => a.title.localeCompare(b.title));
      
      ptStatusText.textContent = `Extracting playable engines for ${sortedGames.length} games...`;
      
      const loadedGames = [];
      for (const item of sortedGames) {
        // Skip fetching individual metadata files for speed in this demo, just construct URL if possible
        // Actually, we need to know the SWF name. Archive.org provides it in the metadata.
        const metaUrl = `https://archive.org/metadata/${item.identifier}`;
        fetch(metaUrl).then(res => res.json()).then(metaData => {
            const swfFile = metaData.files ? metaData.files.find((f) => f.name.toLowerCase().endsWith('.swf')) : null;
            if (swfFile) {
                const directUrl = `https://archive.org/download/${item.identifier}/${swfFile.name}`;
                renderGameCard({...item, directUrl});
            }
        }).catch(err => console.warn(err));
      }

      ptStatusText.textContent = `Loaded games successfully. Sorted A-Z.`;
    } catch (error) {
      ptStatusText.textContent = `Database fetch failed: ${error.message}`;
    }
  }

  function renderGameCard(game) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="thumbnail-container">
          <img src="${game.thumbnailUrl}" class="thumbnail" alt="Cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <span class="fallback-text" style="display:none;">NO COVER ART</span>
      </div>
      <div class="result-info">
          <div class="result-title">${game.title}</div>
          <button class="play-btn">► PLAY</button>
      </div>
    `;
    
    card.querySelector('.play-btn').addEventListener('click', () => {
      startPlayingGame(game.directUrl, true);
    });
    
    ptGamesGrid.appendChild(card);
  }

  function startPlayingGame(url, isHost) {
    ptModal.classList.add('hidden');
    ptContainer.classList.remove('hidden');
    window.state.isPlayTogetherMode = true;
    togglePtBtn.classList.add('active');
    
    if (window.updateVideoLayout) window.updateVideoLayout();

    ptPlayerRoot.innerHTML = '';
    const ruffle = window.RufflePlayer?.newest();
    if (ruffle) {
        currentRufflePlayer = ruffle.createPlayer();
        currentRufflePlayer.style.width = '100%';
        currentRufflePlayer.style.height = '100%';
        currentRufflePlayer.style.display = 'block';
        ptPlayerRoot.appendChild(currentRufflePlayer);
        currentRufflePlayer.load(url);
        
        isHostingGame = isHost;
        
        if (isHost) {
            window.sendSignaling({
                type: 'pt-action',
                action: 'start-game',
                url: url,
                sender: window.state.userName
            });
            window.showToast('Game started! Partner is joining...', 'success');
        } else {
            window.showToast("Joined partner's game!", 'success');
        }

        setupMultiplayerEvents(currentRufflePlayer);
    } else {
        ptPlayerRoot.innerHTML = '<div style="color: white; padding: 20px;">RufflePlayer is not available. Ensure ruffle.js is loaded.</div>';
    }
  }

  function closeGame(broadcast) {
    ptContainer.classList.add('hidden');
    ptPlayerRoot.innerHTML = '';
    currentRufflePlayer = null;
    isHostingGame = false;
    window.state.isPlayTogetherMode = false;
    togglePtBtn.classList.remove('active');
    
    if (window.updateVideoLayout) window.updateVideoLayout();

    if (broadcast) {
        window.sendSignaling({
            type: 'pt-action',
            action: 'close-game',
            sender: window.state.userName
        });
    }
  }

  function setupMultiplayerEvents(playerElement) {
    // Intercept mouse and keyboard events on the player container to broadcast them
    // Note: True Ruffle multiplayer requires intercepting inner SWF events or having host stream video.
    // For this demonstration, we'll sync the game state by having both load the SWF
    // and broadcast generic pointer/keyboard intents, overlaying a remote cursor.
    
    // Create remote cursor element
    let remoteCursor = document.getElementById('pt-remote-cursor');
    if (!remoteCursor) {
        remoteCursor = document.createElement('div');
        remoteCursor.id = 'pt-remote-cursor';
        remoteCursor.style.position = 'absolute';
        remoteCursor.style.width = '12px';
        remoteCursor.style.height = '12px';
        remoteCursor.style.background = 'red';
        remoteCursor.style.borderRadius = '50%';
        remoteCursor.style.pointerEvents = 'none';
        remoteCursor.style.zIndex = '9999';
        remoteCursor.style.display = 'none';
        remoteCursor.style.boxShadow = '0 0 10px red';
        ptContainer.appendChild(remoteCursor);
    }

    // Capture and send events
    ptContainer.addEventListener('mousemove', (e) => {
        if (!currentRufflePlayer) return;
        const rect = ptContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        window.sendSignaling({
            type: 'pt-action',
            action: 'mousemove',
            x: x,
            y: y,
            sender: window.state.userName
        });
    });

    // Expose a handler globally to be called from app.js when receiving pt-action signaling
    window.handlePlayTogetherAction = (data) => {
        if (data.action === 'start-game') {
            startPlayingGame(data.url, false);
        } else if (data.action === 'close-game') {
            closeGame(false);
            window.showToast(`${data.sender} closed the game.`, 'info');
        } else if (data.action === 'mousemove') {
            if (remoteCursor && currentRufflePlayer) {
                const rect = ptContainer.getBoundingClientRect();
                remoteCursor.style.display = 'block';
                remoteCursor.style.left = `${data.x * rect.width}px`;
                remoteCursor.style.top = `${data.y * rect.height}px`;
                
                // Hide cursor after a while if no movement
                clearTimeout(remoteCursor.hideTimeout);
                remoteCursor.hideTimeout = setTimeout(() => {
                    remoteCursor.style.display = 'none';
                }, 2000);
            }
        }
    };
  }
});
