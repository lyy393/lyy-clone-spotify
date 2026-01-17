/* ========== 1. GLOBAL VARIABLES ========== */
const audio              = document.getElementById('audio-source');
const searchInput        = document.getElementById('searchInput');
const searchResults      = document.getElementById('search-results');
const loadingDiv         = document.getElementById('search-loading');
const libraryList        = document.getElementById('library-list');
const miniPlayer         = document.getElementById('bottom-player');
const fullPlayer         = document.getElementById('full-player');
const miniProgress       = document.getElementById('mini-progress');
const mainSlider         = document.getElementById('main-slider');
const playIconMini       = document.getElementById('mini-play-btn');
const playIconFull       = document.getElementById('full-play-icon');

let isPlaying            = false;
let currentMeta          = null;        // lagu yang sedang diputar
let currentPlaylistSongs = [];          // playlist yang sedang diputar
let isDraggingSlider     = false;

/* ========== 2. NAVIGASI INSTAN (TANPA KEDIP) ========== */
function switchTab(tabName) {
  const targetId = tabName === 'playlist-detail' ? 'view-playlist-detail' : `view-${tabName}`;
  const target   = document.getElementById(targetId);

  document.querySelectorAll('.page-view').forEach(v => {
    if (v.id !== targetId) { v.style.display = 'none'; v.classList.remove('active'); }
  });
  if (target) { target.style.display = 'block'; target.classList.add('active'); }

  // navbar active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navIndex = ['home','search','library'].indexOf(tabName);
  if (navIndex !== -1) document.querySelectorAll('.nav-item')[navIndex]?.classList.add('active');
}

/* ========== 3. SEARCH ========== */
let debounceTimer;
searchInput.addEventListener('input', e => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (e.target.value.length > 2) performSearch(e.target.value);
  }, 600);
});

function quickSearch(term) {
  switchTab('search');
  searchInput.value = term;
  performSearch(term);
}

async function performSearch(query) {
  loadingDiv.style.display = 'block';
  searchResults.innerHTML = '';

  try {
    // iTunes Search API (gratis)
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=25`);
    const data = await res.json();

    loadingDiv.style.display = 'none';

    if (!data.results.length) {
      searchResults.innerHTML = '<div style="text-align:center;padding:20px;">Lagu tidak ditemukan.</div>';
      return;
    }

    data.results.forEach(item => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `
        <img src="${item.artworkUrl100}" alt="">
        <div class="result-info">
          <h4>${item.trackName}</h4>
          <p>${item.artistName}</p>
        </div>
        <i class="fa-solid fa-play" style="color:var(--green)"></i>`;
      div.onclick = () => playMusic({
        url: item.previewUrl,
        title: item.trackName,
        artist: item.artistName,
        cover: item.artworkUrl100.replace('100x100','600x600')
      });
      searchResults.appendChild(div);
    });
  } catch (e) {
    loadingDiv.style.display = 'none';
    searchResults.innerHTML = '<div style="text-align:center;padding:20px;">Error koneksi.</div>';
  }
}

/* ========== 4. PLAYER CORE ========== */
async function playMusic(meta) {
  currentMeta = meta;
  currentPlaylistSongs = []; // reset playlist aktif
  updateUI(meta);

  playIconMini.className = 'fa-solid fa-spinner fa-spin';
  try {
    audio.src = meta.url;
    await audio.play();
    isPlaying = true;
  } catch (e) {
    console.error(e);
    isPlaying = false;
  }
  updatePlayIcons();
}

function updateUI(meta) {
  // mini
  document.getElementById('mini-cover').src   = meta.cover;
  document.getElementById('mini-title').innerText  = meta.title;
  document.getElementById('mini-artist').innerText = meta.artist;
  // full
  document.getElementById('full-cover').src   = meta.cover;
  document.getElementById('full-title').innerText  = meta.title;
  document.getElementById('full-artist').innerText = meta.artist;

  miniPlayer.style.display = 'flex'; // tampilkan bottom bar
  checkLikeStatus();
}

function checkLikeStatus() {
  if (!currentMeta) return;
  const liked = JSON.parse(localStorage.getItem('sann_library') || '[]');
  const btn   = document.getElementById('like-btn');
  const exist = liked.find(s => s.url === currentMeta.url);
  if (exist) {
    btn.className = 'fa-solid fa-heart';
    btn.style.color = 'var(--green)';
  } else {
    btn.className = 'fa-regular fa-heart';
    btn.style.color = 'white';
  }
}

/* ========== 5. CONTROL ========== */
function togglePlay() {
  if (!audio.src) return;
  isPlaying ? audio.pause() : audio.play();
  isPlaying = !isPlaying;
  updatePlayIcons();
}
function updatePlayIcons() {
  const icon = isPlaying ? 'fa-pause' : 'fa-play';
  playIconMini.className = `fa-solid ${icon}`;
  playIconFull.className = `fa-solid ${icon}`;
}

function closeFullPlayer() { fullPlayer.classList.remove('show'); }
function nextSong() { playRandom(); }
function prevSong() { playRandom(); } // bisa diganti ke previous jika ada playlist

function playRandom() {
  if (!playlistCache.length) return;
  const idx = Math.floor(Math.random() * playlistCache.length);
  playMusic(playlistCache[idx]);
}

/* ========== 6. SEEK / PROGRESS ========== */
audio.addEventListener('timeupdate', () => {
  if (!audio.duration || isDraggingSlider) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  miniProgress.style.width = pct + '%';
  mainSlider.value = pct;
  document.getElementById('curr-time').innerText = formatTime(audio.currentTime);
});
mainSlider.addEventListener('input', e => {
  isDraggingSlider = true;
  const time = (e.target.value / 100) * audio.duration;
  document.getElementById('curr-time').innerText = formatTime(time);
});
mainSlider.addEventListener('change', e => {
  audio.currentTime = (e.target.value / 100) * audio.duration;
  isDraggingSlider = false;
});
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' + sec : sec}`;
}

/* ========== 7. AUTO NEXT (RANDOM) ========== */
audio.addEventListener('ended', () => {
  playRandom(); // lagu baru random
  isPlaying = true;
  updatePlayIcons();
});

/* ========== 8. LIBRARY ========== */
function loadLibrary() {
  libraryList.innerHTML = '';

  // Liked Songs
  const liked = JSON.parse(localStorage.getItem('sann_library') || '[]');
  const likedDiv = document.createElement('div');
  likedDiv.className = 'result-item';
  likedDiv.style.background = 'linear-gradient(135deg, #450af5, #8e8e8e)';
  likedDiv.innerHTML = `
    <div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:20px;"><i class="fa-solid fa-heart"></i></div>
    <div class="result-info"><h4>Liked Songs</h4><p>${liked.length} songs</p></div>`;
  likedDiv.onclick = () => openPlaylistDetail('liked', 'Liked Songs', 'https://cdn.odzre.my.id/rri.jpg');
  libraryList.appendChild(likedDiv);

  // Custom Playlists
  const playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
  playlists.forEach(pl => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <img src="${pl.image}" alt="">
      <div class="result-info"><h4>${pl.name}</h4><p>${pl.songs.length} songs</p></div>
      <i class="fa-solid fa-trash del-pl-btn" onclick="deletePlaylist(${pl.id},event)"></i>`;
    div.onclick = e => { if (!e.target.classList.contains('del-pl-btn')) openPlaylistDetail(pl.id, pl.name, pl.image); };
    libraryList.appendChild(div);
  });
}

/* ========== 9. PLAYLIST DETAIL ========== */
function openPlaylistDetail(id, name, img) {
  switchTab('playlist-detail');
  document.getElementById('pl-detail-name').innerText = name;
  document.getElementById('pl-detail-img').src = img;

  let songs = [];
  if (id === 'liked') {
    songs = JSON.parse(localStorage.getItem('sann_library') || '[]');
  } else {
    const pl = JSON.parse(localStorage.getItem('sann_playlists') || '[]').find(p => p.id === id);
    songs = pl ? pl.songs : [];
  }
  currentPlaylistSongs = songs;

  const listDiv = document.getElementById('playlist-songs-list');
  listDiv.innerHTML = '';
  document.getElementById('pl-detail-count').innerText = `${songs.length} Songs`;

  if (!songs.length) {
    listDiv.innerHTML = '<p style="text-align:center;padding:20px;color:#777">Playlist kosong.</p>';
    return;
  }
  songs.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <span style="color:#777;font-size:12px;margin-right:10px">${i + 1}</span>
      <img src="${s.cover}" alt="">
      <div class="result-info"><h4>${s.title}</h4><p>${s.artist}</p></div>`;
    div.onclick = () => playMusic(s);
    listDiv.appendChild(div);
  });
}

function playPlaylistAll() {
  if (currentPlaylistSongs.length) playMusic(currentPlaylistSongs[0]);
}

/* ========== 10. LIKE / UNLIKE ========== */
function toggleLikedSongs() {
  if (!currentMeta) return;
  let liked = JSON.parse(localStorage.getItem('sann_library') || '[]');
  const exist = liked.find(s => s.url === currentMeta.url);
  if (!exist) {
    liked.unshift(currentMeta);
    alert('Ditambahkan ke Liked Songs');
  } else {
    liked = liked.filter(s => s.url !== currentMeta.url);
    alert('Dihapus dari Liked Songs');
  }
  localStorage.setItem('sann_library', JSON.stringify(liked));
  checkLikeStatus();
  loadLibrary();
}

/* ========== 11. MODAL ========== */
function openCreateModal() { document.getElementById('modal-create-playlist').classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.getElementById('new-pl-file').addEventListener('change', e => {
  const name = e.target.files[0]?.name || 'Belum ada foto';
  document.getElementById('file-name-display').innerText = name;
});

function saveNewPlaylist() {
  const name = document.getElementById('new-pl-name').value.trim();
  if (!name) return alert('Nama playlist wajib diisi!');
  const fileInput = document.getElementById('new-pl-file');
  const file = fileInput.files[0];

  const save = img => {
    const playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
    playlists.push({ id: Date.now(), name, image: img, songs: [] });
    localStorage.setItem('sann_playlists', JSON.stringify(playlists));
    closeModal('modal-create-playlist');
    document.getElementById('new-pl-name').value = '';
    fileInput.value = '';
    document.getElementById('file-name-display').innerText = 'Belum ada foto';
    loadLibrary();
  };

  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => save(reader.result);
    reader.readAsDataURL(file);
  } else {
    save('https://cdn.odzre.my.id/77c.jpg');
  }
}

function deletePlaylist(id, e) {
  e.stopPropagation();
  if (!confirm('Hapus playlist ini?')) return;
  let playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
  playlists = playlists.filter(p => p.id !== id);
  localStorage.setItem('sann_playlists', JSON.stringify(playlists));
  loadLibrary();
}

/* ========== 12. FULL PLAYER OPEN/CLOSE ========== */
miniPlayer.addEventListener('click', e => {
  if (e.target.closest('.mini-controls')) return;
  fullPlayer.classList.add('show');
});
function closeFullPlayer() { fullPlayer.classList.remove('show'); }

/* ========== 13. ON LOAD ========== */
window.onload = () => {
  switchTab('home');
  loadLibrary();
};            
