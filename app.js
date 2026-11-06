const audio = document.querySelector('#audio');
const $ = (selector) => document.querySelector(selector);
const widget = $('.widget');
const STORAGE_KEY = 'sonora-library-v1';
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'webm'];

const svg = (body, size = 15, extra = '') => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ${extra}>${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  play: svg('<path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/>', 14),
  pause: svg('<rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.3"/><rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.3"/>', 14),
  previous: svg('<rect fill="currentColor" x="5" y="5" width="2.6" height="14" rx="1"/><path fill="currentColor" d="M19 6.2v11.6a.9.9 0 0 1-1.4.76L9.4 12.76a.9.9 0 0 1 0-1.52l8.2-5.8A.9.9 0 0 1 19 6.2z"/>', 15),
  next: svg('<rect fill="currentColor" x="16.4" y="5" width="2.6" height="14" rx="1"/><path fill="currentColor" d="M5 6.2v11.6a.9.9 0 0 0 1.4.76l8.2-5.8a.9.9 0 0 0 0-1.52L6.4 5.44A.9.9 0 0 0 5 6.2z"/>', 15),
  shuffle: svg(`<path ${stroke} d="M16 4h4v4M4 20 20 4M20 16v4h-4M4 4l5 5M15 15l5 5"/>`, 15),
  repeat: svg(`<path ${stroke} d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>`, 15),
  repeatOne: svg(`<path ${stroke} d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/><text x="12" y="15.4" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" font-family="DM Sans, sans-serif">1</text>`, 15),
  heart: svg(`<path ${stroke} d="M12 20.5s-7.6-4.6-9.4-9.3C1.4 8 3.2 4.8 6.6 4.8c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.4 0 5.2 3.2 4 6.4-1.8 4.7-9.4 9.3-9.4 9.3z"/>`, 16),
  heartFilled: svg('<path fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 20.5s-7.6-4.6-9.4-9.3C1.4 8 3.2 4.8 6.6 4.8c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.4 0 5.2 3.2 4 6.4-1.8 4.7-9.4 9.3-9.4 9.3z"/>', 16),
  edit: svg(`<path ${stroke} d="M4 20h4L19.5 8.5a1.9 1.9 0 0 0 0-2.7l-1.3-1.3a1.9 1.9 0 0 0-2.7 0L4 16v4zM13.5 6.5l4 4"/>`, 12),
  volume: svg(`<path fill="currentColor" d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path ${stroke} d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>`, 13),
  muted: svg(`<path fill="currentColor" d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path ${stroke} d="m16 9.5 5 5M21 9.5l-5 5"/>`, 13)
};

let songs = normalizeSongs(loadSongs());
let activeIndex = -1;
let shuffled = false;
let repeatMode = 'off';
let pinned = true;
let youtubePlayer = null;
let youtubeReady = null;
let youtubeTimer = null;
let pendingPlaylistSetup = false;
let volumeLevel = 78;
let muted = false;
let loadToken = 0;
let playHistory = [];
let shuffleSeen = new Set();
let editingId = null;
let editingValue = '';
let rendering = false;

const activeSong = () => songs[activeIndex];
const isPlaylist = (song) => song?.type === 'youtube' && Boolean(song.playlistId);
function newId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function setPlayingState(playing) {
  $('#cover').classList.toggle('playing', playing);
  const button = $('#playButton');
  button.innerHTML = playing ? ICONS.pause : ICONS.play;
  button.title = playing ? 'Pause' : 'Play';
  button.setAttribute('aria-label', button.title);
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
          onStateChange: handleYoutubeState,
          onError: () => {
            if (activeSong()?.type !== 'youtube') return;
            setPlayingState(false);
            showToast('This video cannot be played in the widget');
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

function handleYoutubeState(event) {
  if (activeSong()?.type !== 'youtube') return;
  const states = window.YT.PlayerState;
  if (event.data === states.PLAYING) {
    setPlayingState(true);
    startYoutubeTimer();
    applyPlaylistSettings();
    syncPlaylistTrack();
  } else if (event.data === states.PAUSED) {
    setPlayingState(false);
  } else if (event.data === states.CUED) {
    applyPlaylistSettings();
    syncPlaylistTrack();
  } else if (event.data === states.ENDED) {
    setPlayingState(false);
    handleEnded();
  }
}

function applyPlaylistSettings() {
  if (!youtubePlayer || !isPlaylist(activeSong())) return;
  youtubePlayer.setLoop(repeatMode !== 'off');
  if (pendingPlaylistSetup) {
    pendingPlaylistSetup = false;
    if (shuffled) youtubePlayer.setShuffle(true);
  }
}

function syncPlaylistTrack() {
  const song = activeSong();
  if (!youtubePlayer || !isPlaylist(song)) return;
  const title = youtubePlayer.getVideoData?.().title;
  const total = youtubePlayer.getPlaylist?.()?.length || 0;
  const position = youtubePlayer.getPlaylistIndex?.();
  if (title) $('#trackTitle').textContent = title;
  $('#trackArtist').textContent = total && position >= 0 ? `${song.title} · ${position + 1}/${total}` : song.title;
}

function stopYoutube() {
  if (youtubePlayer) youtubePlayer.stopVideo();
  clearInterval(youtubeTimer);
  youtubeTimer = null;
}

function startYoutubeTimer() {
  clearInterval(youtubeTimer);
  youtubeTimer = setInterval(() => {
    if (!youtubePlayer || activeSong()?.type !== 'youtube') return;
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
function normalizeSongs(list) {
  const seen = new Set();
  const cleaned = (Array.isArray(list) ? list : []).filter((song) => song && song.title && ['local', 'youtube'].includes(song.type)).map((song) => {
    const id = song.id && !seen.has(song.id) ? song.id : newId();
    seen.add(id);
    return { ...song, id, favorite: Boolean(song.favorite) };
  });
  return [...cleaned.filter((song) => song.favorite), ...cleaned.filter((song) => !song.favorite)];
}
function sortFavorites() {
  const currentId = activeSong()?.id;
  songs = [...songs.filter((song) => song.favorite), ...songs.filter((song) => !song.favorite)];
  activeIndex = currentId ? songs.findIndex((song) => song.id === currentId) : -1;
}
function saveSongs() {
  sortFavorites();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(songs)); } catch { /* the file library below is the durable copy */ }
  renderSongs();
  if (window.sonora?.persistLibrary) {
    window.sonora.persistLibrary(serializedSongs()).catch(() => showToast('Could not persist the library'));
  }
}
function serializedSongs() {
  return songs.map(({ id, title, artist, type, url, thumbnail, metadataLoaded, playlistId, favorite, customTitle }) => ({
    id, title, artist, type, url, thumbnail, metadataLoaded, playlistId, favorite, customTitle
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
    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      return parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || null;
    }
  } catch { /* invalid URL is handled by the caller */ }
  return null;
}
function youtubePlaylistId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) return null;
    const list = parsed.searchParams.get('list');
    // Auto-generated mixes (RD...) cannot be embedded as playlists
    return list && /^[\w-]+$/.test(list) && !list.startsWith('RD') ? list : null;
  } catch { return null; }
}
const subtitleFor = (song) => song.artist || (song.type === 'youtube' ? 'YouTube' : 'Local audio');

function renderSongs() {
  rendering = true;
  const list = $('#songList');
  const focused = document.activeElement?.classList.contains('rename-input') ? document.activeElement : null;
  if (focused) editingValue = focused.value;
  const selection = focused ? [focused.selectionStart, focused.selectionEnd] : null;
  $('#songCount').textContent = songs.length;
  list.innerHTML = songs.map((song, index) => {
    const title = song.id === editingId
      ? `<input class="rename-input" value="${escapeHtml(editingValue)}" maxlength="120" aria-label="Song name" />`
      : `<strong>${escapeHtml(song.title)}</strong>`;
    const subtitle = song.playlistId ? `Playlist · ${subtitleFor(song)}` : subtitleFor(song);
    return `
    <li class="song-item ${index === activeIndex ? 'active' : ''} ${song.favorite ? 'is-favorite' : ''}" data-index="${index}">
      <span class="song-dot"></span>
      <span class="song-info">${title}<small>${escapeHtml(subtitle)}</small></span>
      <button class="item-action fav-song ${song.favorite ? 'on' : ''}" data-favorite="${index}" title="${song.favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-label="Toggle favorite for ${escapeHtml(song.title)}">${song.favorite ? ICONS.heartFilled : ICONS.heart}</button>
      <button class="item-action rename-song" data-rename="${index}" title="Rename" aria-label="Rename ${escapeHtml(song.title)}">${ICONS.edit}</button>
      <button class="remove-song" data-remove="${index}" title="Remove" aria-label="Remove ${escapeHtml(song.title)}">×</button>
    </li>`;
  }).join('');
  const input = list.querySelector('.rename-input');
  if (input && focused) {
    input.focus();
    input.setSelectionRange(selection[0], selection[1]);
  }
  rendering = false;
  refreshFavoriteButton();
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function startRename(index) {
  const song = songs[index]; if (!song) return;
  editingId = song.id; editingValue = song.title;
  renderSongs();
  const input = $('.rename-input');
  input.focus(); input.select();
}
function commitRename() {
  if (editingId === null) return;
  const song = songs.find((item) => item.id === editingId);
  const title = editingValue.trim();
  editingId = null;
  if (song && title && title !== song.title) {
    song.title = title;
    song.customTitle = true;
    saveSongs();
    if (song === activeSong()) { showTrack(song); syncPlaylistTrack(); }
    showToast('Song renamed');
  } else renderSongs();
}
function cancelRename() {
  editingId = null;
  renderSongs();
}

function showTrack(song) {
  $('#trackTitle').textContent = song ? song.title : 'Your quiet space';
  $('#trackArtist').textContent = song ? subtitleFor(song) : 'Add a song to begin';
  $('#sourceLabel').textContent = !song ? 'READY TO PLAY'
    : song.type === 'local' ? 'LOCAL AUDIO'
      : isPlaylist(song) ? 'YOUTUBE PLAYLIST' : 'YOUTUBE LINK';
  refreshFavoriteButton();
}
function refreshFavoriteButton() {
  const button = $('#favoriteButton');
  const on = Boolean(activeSong()?.favorite);
  button.innerHTML = on ? ICONS.heartFilled : ICONS.heart;
  button.classList.toggle('on', on);
  button.title = on ? 'Remove from favorites' : 'Add to favorites';
  button.setAttribute('aria-label', button.title);
}
function toggleFavorite(index) {
  const song = songs[index]; if (!song) return;
  song.favorite = !song.favorite;
  saveSongs();
  if (song.favorite) $('#songList').scrollTop = 0;
  showToast(song.favorite ? 'Added to favorites' : 'Removed from favorites');
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
    if (!song.customTitle) song.title = metadata.title || song.title;
    song.artist = metadata.artist || song.artist || 'YouTube';
    song.thumbnail = metadata.thumbnail || '';
    song.metadataLoaded = true;
    saveSongs();
    if (song === activeSong()) { showTrack(song); syncPlaylistTrack(); }
  } catch {
    if (song === activeSong()) showToast('Could not load YouTube song details');
  }
}

function setActive(index, autoplay = false, { back = false } = {}) {
  const song = songs[index]; if (!song) return;
  const previous = activeSong();
  if (!back && previous && previous.id !== song.id) {
    playHistory.push(previous.id);
    if (playHistory.length > 100) playHistory.shift();
  }
  shuffleSeen.add(song.id);
  activeIndex = index; audio.pause(); stopYoutube();
  setPlayingState(false);
  const token = ++loadToken;
  if (song.type === 'local') {
    audio.src = song.url;
  } else {
    audio.removeAttribute('src'); audio.load();
    prepareYoutubePlayer().then((player) => {
      if (token !== loadToken) return;
      pendingPlaylistSetup = isPlaylist(song);
      const method = autoplay ? 'load' : 'cue';
      if (isPlaylist(song)) player[`${method}Playlist`]({ listType: 'playlist', list: song.playlistId, index: 0 });
      else player[`${method}VideoById`](youtubeId(song.url) || song.id);
      if (autoplay) startYoutubeTimer();
    }).catch(() => { setPlayingState(false); showToast('YouTube audio could not load'); });
  }
  showTrack(song);
  if (song.type === 'youtube') enrichYoutubeSong(song);
  $('#cover').style.background = song.type === 'youtube' ? 'linear-gradient(135deg,#83a6c8,#b5e3d8)' : 'linear-gradient(135deg,#6e9dcc,#c5e8dc)';
  $('#seekBar').value = 0; $('#currentTime').textContent = '0:00'; $('#duration').textContent = song.type === 'youtube' ? '—:——' : '0:00';
  renderSongs();
  $('.song-item.active')?.scrollIntoView({ block: 'nearest' });
  if (autoplay && song.type === 'local') audio.play().catch(() => showToast('This audio file cannot be played'));
  if (autoplay && song.type === 'youtube') setPlayingState(true);
}

function clearActive() {
  loadToken++;
  activeIndex = -1;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  stopYoutube();
  setPlayingState(false);
  showTrack(null);
  $('#seekBar').value = 0; $('#currentTime').textContent = '0:00'; $('#duration').textContent = '0:00';
}

function stopPlayback() {
  setPlayingState(false);
  if (activeSong()?.type === 'youtube') { clearInterval(youtubeTimer); youtubePlayer?.pauseVideo(); }
}

// Moves inside a YouTube playlist first; returns false when the library should advance instead
function stepWithinPlaylist(direction) {
  if (!youtubePlayer || !isPlaylist(activeSong())) return false;
  const total = youtubePlayer.getPlaylist?.()?.length || 0;
  const position = youtubePlayer.getPlaylistIndex?.();
  if (!total || position == null || position < 0) return false;
  if (direction > 0 && position < total - 1) { youtubePlayer.nextVideo(); return true; }
  if (direction < 0 && position > 0) { youtubePlayer.previousVideo(); return true; }
  return false;
}

function changeSong(direction = 1, auto = false) {
  if (!songs.length) return showToast('Add a song first');
  if (activeIndex < 0) return setActive(0, true);
  if (!auto && stepWithinPlaylist(direction)) return;
  const count = songs.length;
  if (direction < 0) {
    if (shuffled) {
      while (playHistory.length) {
        const index = songs.findIndex((song) => song.id === playHistory.pop());
        if (index >= 0) return setActive(index, true, { back: true });
      }
    }
    return setActive((activeIndex - 1 + count) % count, true);
  }
  if (shuffled) {
    let candidates = songs.map((_, index) => index).filter((index) => !shuffleSeen.has(songs[index].id));
    if (!candidates.length) {
      if (auto && repeatMode === 'off') return stopPlayback();
      shuffleSeen = new Set([activeSong().id]);
      candidates = songs.map((_, index) => index).filter((index) => index !== activeIndex);
      if (!candidates.length) candidates = [activeIndex];
    }
    return setActive(candidates[Math.floor(Math.random() * candidates.length)], true);
  }
  if (activeIndex + 1 >= count && auto && repeatMode === 'off') return stopPlayback();
  setActive((activeIndex + 1) % count, true);
}

function handleEnded() {
  if (repeatMode === 'one' && !isPlaylist(activeSong())) return setActive(activeIndex, true);
  changeSong(1, true);
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
function isAudioFile(file) {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.includes(file.name.split('.').pop().toLowerCase());
}
async function addLocalFiles(files) {
  const audioFiles = [...files].filter(isAudioFile);
  if (!audioFiles.length) return showToast('Drop audio files only');
  try {
    const imported = await Promise.all(audioFiles.map(async (file) => ({
      id: newId(),
      title: titleFromFile(file.name),
      artist: 'Local audio',
      type: 'local',
      url: await fileAsDataUrl(file),
      favorite: false
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
  const playlistId = youtubePlaylistId(url);
  const id = youtubeId(url);
  if (!playlistId && !id) return showToast('Enter a valid YouTube video or playlist URL');
  const song = playlistId
    ? { id: newId(), title: 'YouTube playlist', artist: 'YouTube', type: 'youtube', playlistId, url: `https://www.youtube.com/playlist?list=${playlistId}`, favorite: false }
    : { id: newId(), title: `YouTube · ${id}`, artist: 'YouTube', type: 'youtube', url, favorite: false };
  songs.push(song);
  saveSongs(); if (activeIndex < 0) setActive(0);
  enrichYoutubeSong(song);
  $('#youtubeInput').value = '';
  $('#youtubeDialog').classList.remove('open');
  showToast(playlistId ? 'YouTube playlist added' : 'YouTube song added');
}

function togglePlayback() {
  const song = activeSong();
  if (!song) return songs.length ? setActive(0, true) : showToast('Add a song first');
  if (song.type === 'youtube') {
    prepareYoutubePlayer().then((player) => {
      const states = window.YT.PlayerState;
      const state = player.getPlayerState();
      if (state === states.PLAYING || state === states.BUFFERING) {
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
}

function setLibraryOpen(open) {
  widget.classList.toggle('library-open', open);
  const button = $('#libraryButton');
  button.classList.toggle('active', open);
  button.title = open ? 'Close library' : 'Open library';
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-expanded', String(open));
  window.sonora?.resize(open ? 660 : 150);
}

function updateModeButtons() {
  const shuffle = $('#shuffleButton');
  shuffle.classList.toggle('active', shuffled);
  shuffle.title = shuffled ? 'Shuffle: on' : 'Shuffle: off';
  shuffle.setAttribute('aria-pressed', String(shuffled));
  const repeat = $('#repeatButton');
  repeat.innerHTML = repeatMode === 'one' ? ICONS.repeatOne : ICONS.repeat;
  repeat.classList.toggle('active', repeatMode !== 'off');
  repeat.title = { off: 'Repeat: off', all: 'Repeat: all songs', one: 'Repeat: current song' }[repeatMode];
  repeat.setAttribute('aria-label', repeat.title);
}

$('#playButton').addEventListener('click', togglePlayback);
audio.addEventListener('play', () => { if (activeSong()?.type === 'local') setPlayingState(true); });
audio.addEventListener('pause', () => { if (activeSong()?.type === 'local') setPlayingState(false); });
audio.addEventListener('error', () => { if (activeSong()?.type === 'local' && audio.getAttribute('src')) showToast('This audio file cannot be played'); });
audio.addEventListener('timeupdate', () => { $('#seekBar').value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0; $('#currentTime').textContent = formatTime(audio.currentTime); });
audio.addEventListener('loadedmetadata', () => { $('#duration').textContent = formatTime(audio.duration); });
audio.addEventListener('ended', () => { if (activeSong()?.type === 'local') handleEnded(); });
$('#seekBar').addEventListener('input', (event) => {
  if (activeSong()?.type === 'youtube' && youtubePlayer) {
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
  $('#volumeButton').innerHTML = muted ? ICONS.muted : ICONS.volume;
  $('#volumeButton').title = muted ? 'Unmute' : 'Mute';
  $('#volumeButton').setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}
$('#volumeBar').addEventListener('input', (event) => applyVolume(event.target.value));
$('#volumeButton').addEventListener('click', () => {
  if (muted) applyVolume(volumeLevel || 78);
  else { volumeLevel = Number($('#volumeBar').value) || 78; applyVolume(0); }
});
applyVolume(volumeLevel);
$('#previousButton').addEventListener('click', () => changeSong(-1));
$('#nextButton').addEventListener('click', () => changeSong(1));
$('#shuffleButton').addEventListener('click', () => {
  shuffled = !shuffled;
  shuffleSeen = new Set(activeSong() ? [activeSong().id] : []);
  if (youtubePlayer && isPlaylist(activeSong())) youtubePlayer.setShuffle(shuffled);
  updateModeButtons();
  showToast(shuffled ? 'Shuffle on' : 'Shuffle off');
});
$('#repeatButton').addEventListener('click', () => {
  repeatMode = { off: 'all', all: 'one', one: 'off' }[repeatMode];
  if (youtubePlayer && isPlaylist(activeSong())) youtubePlayer.setLoop(repeatMode !== 'off');
  updateModeButtons();
  showToast({ off: 'Repeat off', all: 'Repeat all songs', one: 'Repeat current song' }[repeatMode]);
});
$('#favoriteButton').addEventListener('click', () => {
  if (!activeSong()) return showToast('Select a song first');
  toggleFavorite(activeIndex);
});
$('#pinButton').addEventListener('click', (event) => {
  pinned = !pinned;
  event.currentTarget.classList.toggle('active', pinned);
  event.currentTarget.title = pinned ? 'Unpin from desktop' : 'Pin to desktop';
  event.currentTarget.setAttribute('aria-label', event.currentTarget.title);
  window.sonora?.setAlwaysOnTop(pinned);
  showToast(pinned ? 'Widget pinned to desktop' : 'Widget unpinned');
});
$('#libraryButton').addEventListener('click', () => setLibraryOpen(!widget.classList.contains('library-open')));
$('#closeLibrary').addEventListener('click', () => setLibraryOpen(false));
$('#minimizeButton').addEventListener('click', () => window.sonora?.minimize());
$('#closeButton').addEventListener('click', () => window.sonora?.close());
$('#fileInput').addEventListener('change', (event) => {
  const files = [...event.target.files];
  event.target.value = '';
  addLocalFiles(files);
});
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

// Dropping a file anywhere must never navigate the window away from the app
const isFileDrag = (event) => [...(event.dataTransfer?.types || [])].includes('Files');
const setDragging = (on) => { widget.classList.toggle('drag-over', on); $('#dropZone').classList.toggle('dragging', on); };
['dragenter', 'dragover'].forEach((type) => document.addEventListener(type, (event) => {
  event.preventDefault();
  if (!isFileDrag(event)) return;
  event.dataTransfer.dropEffect = 'copy';
  setDragging(true);
}));
document.addEventListener('dragleave', (event) => { if (!event.relatedTarget) setDragging(false); });
document.addEventListener('drop', (event) => {
  event.preventDefault();
  setDragging(false);
  if (event.dataTransfer?.files?.length) addLocalFiles(event.dataTransfer.files);
});

$('#songList').addEventListener('click', (event) => {
  if (event.target.closest('.rename-input')) return;
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    const index = Number(remove.dataset.remove);
    if (songs[index]?.id === editingId) editingId = null;
    if (index === activeIndex) clearActive();
    else if (index < activeIndex) activeIndex--;
    songs.splice(index, 1);
    saveSongs();
    return;
  }
  const favoriteToggle = event.target.closest('[data-favorite]');
  if (favoriteToggle) return toggleFavorite(Number(favoriteToggle.dataset.favorite));
  const rename = event.target.closest('[data-rename]');
  if (rename) return startRename(Number(rename.dataset.rename));
  const item = event.target.closest('[data-index]');
  if (!item) return;
  const index = Number(item.dataset.index);
  if (index === activeIndex) togglePlayback(); else setActive(index, true);
});
$('#songList').addEventListener('input', (event) => {
  if (event.target.classList.contains('rename-input')) editingValue = event.target.value;
});
$('#songList').addEventListener('keydown', (event) => {
  if (!event.target.classList.contains('rename-input')) return;
  if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
  if (event.key === 'Escape') { event.preventDefault(); cancelRename(); }
});
$('#songList').addEventListener('focusout', (event) => {
  if (!rendering && event.target.classList.contains('rename-input')) commitRename();
});
$('#saveButton').addEventListener('click', saveLibraryFile);
$('#exportButton').addEventListener('click', saveLibraryFile);
$('#importInput').addEventListener('change', async (event) => {
  try {
    const imported = JSON.parse(await event.target.files[0].text());
    if (!Array.isArray(imported) || imported.some((song) => !song.title || !['local', 'youtube'].includes(song.type))) throw new Error();
    clearActive();
    songs = normalizeSongs(imported); playHistory = []; shuffleSeen = new Set();
    saveSongs(); showToast(`${songs.length} songs imported`);
  } catch { showToast('Could not read that library JSON'); }
  event.target.value = '';
});

function trackWidgetBounds() {
  if (!window.sonora?.setWidgetRect) return;
  let queued = false;
  const send = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const { x, y, width, height } = widget.getBoundingClientRect();
      window.sonora.setWidgetRect({ x, y, width, height });
    });
  };
  new ResizeObserver(send).observe(widget);
  window.addEventListener('resize', send);
  send();
}

setPlayingState(false);
updateModeButtons();
$('#previousButton').innerHTML = ICONS.previous;
$('#nextButton').innerHTML = ICONS.next;
$('#shuffleButton').innerHTML = ICONS.shuffle;
setLibraryOpen(widget.classList.contains('library-open'));
renderSongs();
songs.filter((song) => song.type === 'youtube' && !song.metadataLoaded).forEach(enrichYoutubeSong);
window.sonora?.loadLibrary().then((savedSongs) => {
  if (!Array.isArray(savedSongs) || !savedSongs.length || activeIndex >= 0) return;
  songs = normalizeSongs(savedSongs);
  renderSongs();
  songs.filter((song) => song.type === 'youtube' && !song.metadataLoaded).forEach(enrichYoutubeSong);
}).catch(() => showToast('Could not restore the saved library'));
trackWidgetBounds();
window.sonora?.onTheme((theme) => { document.documentElement.dataset.theme = theme; });
