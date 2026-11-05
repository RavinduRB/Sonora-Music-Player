const audio = document.querySelector('#audio');
const $ = (selector) => document.querySelector(selector);
const widget = $('.widget');
const STORAGE_KEY = 'sonora-library-v1';
let songs = loadSongs();
let activeIndex = -1;
let shuffled = false;
let repeating = false;
let favorite = false;
let pinned = true;
let youtubePlayer = null;
let youtubeReady = null;
let youtubeTimer = null;
let volumeLevel = 78;
let muted = false;

function setPlayingState(playing) {
  $('#cover').classList.toggle('playing', playing);
  $('#playButton').textContent = playing ? 'Ⅱ' : '▶';
}

function prepareYoutubePlayer() {
  if (youtubeReady) return youtubeReady;
  youtubeReady = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => {
      youtubePlayer = new window.YT.Player('youtubePlayer', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            youtubePlayer.setVolume(volumeLevel);
            resolve(youtubePlayer);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlayingState(true);
              startYoutubeTimer();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setPlayingState(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setPlayingState(false);
              repeating ? setActive(activeIndex, true) : nextSong();
            }
          }
        }
      });
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      youtubeReady = null;
      reject(new Error('YouTube iframe API failed to load'));
      showToast('YouTube audio is unavailable offline');
    };
    document.head.appendChild(script);
  });
  return youtubeReady;
}

function stopYoutube() {
  if (youtubePlayer) youtubePlayer.stopVideo();
  clearInterval(youtubeTimer);
  youtubeTimer = null;
}

function startYoutubeTimer() {
  clearInterval(youtubeTimer);
  youtubeTimer = setInterval(() => {
    if (!youtubePlayer || activeIndex < 0 || songs[activeIndex]?.type !== 'youtube') return;
    const current = youtubePlayer.getCurrentTime();
    const duration = youtubePlayer.getDuration();
    $('#currentTime').textContent = formatTime(current);
    $('#duration').textContent = formatTime(duration);
    $('#seekBar').value = duration ? (current / duration) * 100 : 0;
  }, 500);
}

function loadSongs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveSongs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  renderSongs();
  if (window.sonora?.persistLibrary) {
    window.sonora.persistLibrary(serializedSongs()).catch(() => showToast('Could not persist the library'));
  }
}
function serializedSongs() {
  return songs.map(({ id, title, artist, type, url, thumbnail, metadataLoaded }) => ({
    id, title, artist, type, url, thumbnail, metadataLoaded
  }));
}
async function saveLibraryFile() {
  saveSongs();
  try {
    if (window.sonora?.saveLibrary) {
      const result = await window.sonora.saveLibrary(serializedSongs());
      if (!result.canceled) showToast('Library saved as JSON');
      return;
    }
    const blob = new Blob([JSON.stringify(serializedSongs(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sonora-library.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Library saved as JSON');
  } catch {
    showToast('Could not save the library');
  }
}
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
function titleFromFile(name) { return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '); }
function youtubeId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0];
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      return parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || null;
    }
  } catch { /* invalid URL is handled by the caller */ }
  return null;
}
function renderSongs() {
  $('#songCount').textContent = songs.length;
  $('#songList').innerHTML = songs.map((song, index) => `
    <li class="song-item ${index === activeIndex ? 'active' : ''}" data-index="${index}">
      <span class="song-dot"></span>
      <span class="song-info"><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.artist || (song.type === 'youtube' ? 'YouTube' : 'Local audio'))}</small></span>
      <button class="remove-song" data-remove="${index}" aria-label="Remove ${escapeHtml(song.title)}">×</button>
    </li>`).join('');
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
async function enrichYoutubeSong(song) {
  if (song.type !== 'youtube' || song.metadataLoaded) return;
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(song.url)}&format=json`;
    const metadata = window.sonora?.getYoutubeMetadata
      ? await window.sonora.getYoutubeMetadata(song.url)
      : await fetch(endpoint).then((response) => {
        if (!response.ok) throw new Error('YouTube metadata request failed');
        return response.json().then((data) => ({
          title: data.title,
          artist: data.author_name,
          thumbnail: data.thumbnail_url
        }));
      });
    song.title = metadata.title || song.title;
    song.artist = metadata.artist || song.artist || 'YouTube';
    song.thumbnail = metadata.thumbnail || '';
    song.metadataLoaded = true;
    saveSongs();
    if (songs[activeIndex] === song) {
      $('#trackTitle').textContent = song.title;
      $('#trackArtist').textContent = song.artist;
      renderSongs();
    }
  } catch {
    if (songs[activeIndex] === song) showToast('Could not load YouTube song details');
  }
}
function setActive(index, autoplay = false) {
  const song = songs[index]; if (!song) return;
  activeIndex = index; audio.pause(); stopYoutube();
  setPlayingState(false);
  if (song.type === 'local') {
    audio.src = song.url; $('#sourceLabel').textContent = 'LOCAL AUDIO';
  } else {
    audio.removeAttribute('src'); $('#sourceLabel').textContent = 'YOUTUBE LINK';
    prepareYoutubePlayer().then((player) => {
      player.cueVideoById(youtubeId(song.url) || song.id);
      if (autoplay) {
        player.playVideo();
        startYoutubeTimer();
      }
    }).catch(() => showToast('YouTube audio could not load'));
  }
  $('#trackTitle').textContent = song.title; $('#trackArtist').textContent = song.artist || (song.type === 'youtube' ? 'YouTube' : 'Local audio');
  if (song.type === 'youtube') enrichYoutubeSong(song);
  $('#cover').style.background = song.type === 'youtube' ? 'linear-gradient(135deg,#83a6c8,#b5e3d8)' : 'linear-gradient(135deg,#6e9dcc,#c5e8dc)';
  $('#seekBar').value = 0; $('#currentTime').textContent = '0:00'; $('#duration').textContent = song.type === 'youtube' ? '—:——' : '0:00';
  renderSongs();
  if (autoplay && song.type === 'local') audio.play().catch(() => showToast('Press play to start audio'));
  if (autoplay && song.type === 'youtube') setPlayingState(true);
}
function nextSong(direction = 1) {
  if (!songs.length) return showToast('Add a song first');
  const index = shuffled ? Math.floor(Math.random() * songs.length) : (activeIndex + direction + songs.length) % songs.length;
  setActive(index, true);
}
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
async function addLocalFiles(files) {
  const audioFiles = [...files].filter((file) => file.type.startsWith('audio/'));
  try {
    const imported = await Promise.all(audioFiles.map(async (file) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
      title: titleFromFile(file.name),
      artist: 'Local audio',
      type: 'local',
      url: await fileAsDataUrl(file)
    })));
    songs.push(...imported);
    saveSongs();
    if (activeIndex < 0 && songs.length) setActive(0);
    showToast(`${imported.length} audio file${imported.length !== 1 ? 's' : ''} added`);
  } catch {
    showToast('Could not save the selected audio file');
  }
}
function addYoutube() {
  const url = $('#youtubeInput').value.trim();
  if (!url) return;
  const id = youtubeId(url);
  if (!id) return showToast('Enter a valid YouTube URL');
  const song = { id, title: `YouTube · ${id}`, artist: 'YouTube', type: 'youtube', url };
  songs.push(song);
  saveSongs(); if (activeIndex < 0) setActive(0);
  enrichYoutubeSong(song);
  $('#youtubeInput').value = '';
  $('#youtubeDialog').classList.remove('open');
  showToast('YouTube song added');
}

$('#playButton').addEventListener('click', () => {
  if (activeIndex < 0) return songs.length ? setActive(0, true) : showToast('Add a song first');
  if (songs[activeIndex].type === 'youtube') {
    prepareYoutubePlayer().then((player) => {
      if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
        setPlayingState(false);
      } else {
        player.playVideo();
        startYoutubeTimer();
        setPlayingState(true);
      }
    }).catch(() => showToast('YouTube audio could not load'));
    return;
  }
  if (audio.paused) audio.play().catch(() => showToast('This audio file cannot be played')); else audio.pause();
});
audio.addEventListener('play', () => setPlayingState(true));
audio.addEventListener('pause', () => setPlayingState(false));
audio.addEventListener('timeupdate', () => { $('#seekBar').value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0; $('#currentTime').textContent = formatTime(audio.currentTime); });
audio.addEventListener('loadedmetadata', () => { $('#duration').textContent = formatTime(audio.duration); });
audio.addEventListener('ended', () => repeating ? setActive(activeIndex, true) : nextSong());
$('#seekBar').addEventListener('input', (event) => {
  if (activeIndex >= 0 && songs[activeIndex].type === 'youtube' && youtubePlayer) {
    youtubePlayer.seekTo((event.target.value / 100) * youtubePlayer.getDuration(), true);
  } else if (audio.duration) audio.currentTime = (event.target.value / 100) * audio.duration;
});
function applyVolume(value) {
  volumeLevel = Math.max(0, Math.min(100, Number(value)));
  audio.volume = volumeLevel / 100;
  if (youtubePlayer) youtubePlayer.setVolume(volumeLevel);
  $('#volumeBar').value = volumeLevel;
  $('#volumeValue').textContent = volumeLevel;
  muted = volumeLevel === 0;
  $('#volumeButton').textContent = muted ? '🔇' : '🔊';
  $('#volumeButton').title = muted ? 'Unmute' : 'Mute';
  $('#volumeButton').setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}
$('#volumeBar').addEventListener('input', (event) => applyVolume(event.target.value));
$('#volumeButton').addEventListener('click', () => {
  if (muted) applyVolume(volumeLevel || 78);
  else { volumeLevel = Number($('#volumeBar').value) || 78; applyVolume(0); }
});
applyVolume(volumeLevel);
$('#previousButton').addEventListener('click', () => nextSong(-1));
$('#nextButton').addEventListener('click', () => nextSong());
$('#shuffleButton').addEventListener('click', (event) => { shuffled = !shuffled; event.currentTarget.style.color = shuffled ? '#527d9f' : ''; showToast(shuffled ? 'Shuffle on' : 'Shuffle off'); });
$('#repeatButton').addEventListener('click', (event) => { repeating = !repeating; event.currentTarget.style.color = repeating ? '#527d9f' : ''; showToast(repeating ? 'Repeat on' : 'Repeat off'); });
$('#favoriteButton').addEventListener('click', (event) => { favorite = !favorite; event.currentTarget.textContent = favorite ? '♥' : '♡'; event.currentTarget.style.color = favorite ? '#6d9bb8' : ''; });
$('#pinButton').addEventListener('click', (event) => {
  pinned = !pinned;
  event.currentTarget.classList.toggle('active', pinned);
  event.currentTarget.title = pinned ? 'Unpin from desktop' : 'Pin to desktop';
  event.currentTarget.setAttribute('aria-label', event.currentTarget.title);
  window.sonora?.setAlwaysOnTop(pinned);
  showToast(pinned ? 'Widget pinned to desktop' : 'Widget unpinned');
});
$('#libraryButton').addEventListener('click', () => {
  $('.widget').classList.add('library-open');
  window.sonora?.resize(660);
});
$('#closeLibrary').addEventListener('click', () => {
  $('.widget').classList.remove('library-open');
  window.sonora?.resize(150);
});
$('#minimizeButton').addEventListener('click', () => window.sonora?.minimize());
$('#closeButton').addEventListener('click', () => window.sonora?.close());
$('#fileInput').addEventListener('change', (event) => addLocalFiles(event.target.files));
$('#youtubeButton').addEventListener('click', () => {
  $('#youtubeDialog').classList.add('open');
  $('#youtubeInput').focus();
});
$('#cancelYoutube').addEventListener('click', () => {
  $('#youtubeDialog').classList.remove('open');
  $('#youtubeInput').value = '';
});
$('#saveYoutube').addEventListener('click', addYoutube);
$('#youtubeInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addYoutube();
  if (event.key === 'Escape') $('#cancelYoutube').click();
});
$('#dropZone').addEventListener('dragover', (event) => { event.preventDefault(); event.currentTarget.classList.add('dragging'); });
$('#dropZone').addEventListener('dragleave', (event) => event.currentTarget.classList.remove('dragging'));
$('#dropZone').addEventListener('drop', (event) => { event.preventDefault(); event.currentTarget.classList.remove('dragging'); addLocalFiles(event.dataTransfer.files); });
$('#songList').addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (remove) { const index = Number(remove.dataset.remove); songs.splice(index, 1); if (index === activeIndex) { activeIndex = -1; audio.pause(); $('#trackTitle').textContent = 'Your quiet space'; $('#trackArtist').textContent = 'Add a song to begin'; } else if (index < activeIndex) activeIndex--; saveSongs(); return; }
  const item = event.target.closest('[data-index]'); if (item) setActive(Number(item.dataset.index), false);
});
$('#saveButton').addEventListener('click', saveLibraryFile);
$('#exportButton').addEventListener('click', saveLibraryFile);
$('#importInput').addEventListener('change', async (event) => {
  try {
    const imported = JSON.parse(await event.target.files[0].text());
    if (!Array.isArray(imported) || imported.some((song) => !song.title || !['local', 'youtube'].includes(song.type))) throw new Error();
    songs = imported; saveSongs(); renderSongs(); showToast(`${songs.length} songs imported`);
  } catch { showToast('Could not read that library JSON'); }
});
renderSongs();
songs.filter((song) => song.type === 'youtube' && !song.metadataLoaded).forEach(enrichYoutubeSong);
window.sonora?.loadLibrary().then((savedSongs) => {
  if (!Array.isArray(savedSongs) || !savedSongs.length) return;
  songs = savedSongs;
  renderSongs();
  songs.filter((song) => song.type === 'youtube' && !song.metadataLoaded).forEach(enrichYoutubeSong);
}).catch(() => showToast('Could not restore the saved library'));
window.sonora?.resize(widget.classList.contains('library-open') ? 660 : 150);
widget.addEventListener('mouseenter', () => window.sonora?.setMouseThrough(false));
widget.addEventListener('mouseleave', () => window.sonora?.setMouseThrough(true));
window.sonora?.setMouseThrough(true);
