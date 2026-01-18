/* 
  FmcComic - improved reader UX
  - Fix klik chapter harus beberapa kali (navigation lock + feedback)
  - Fix next/prev kadang ngadat (anti double click + lock)
  - Tambah indikator chapter & judul komik di reader top bar
  - Progress bar reading
*/

const API_PROXY = "https://api.nekolabs.web.id/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

const contentArea = document.getElementById('content-area');
const filterPanel = document.getElementById('filter-panel');
const mainNav = document.getElementById('main-nav');
const mobileNav = document.getElementById('mobile-nav');
const progressBar = document.getElementById('progress-bar');

let currentChapterList = [];
let currentComicContext = { slug: null, title: null, image: null };
let isNavigating = false;

/* ---------------- Helpers ---------------- */

async function getUuidFromSlug(slug, type) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/get-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, type })
    });
    const data = await res.json();
    return data.uuid;
  } catch (e) {
    return slug;
  }
}

async function getSlugFromUuid(uuid) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/get-slug/${uuid}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function updateURL(path) {
  if (window.location.pathname !== path) history.pushState(null, null, path);
}

function getTypeClass(type) {
  if (!type) return 'type-default';
  const t = type.toLowerCase();
  if (t.includes('manga')) return 'type-manga';
  if (t.includes('manhwa')) return 'type-manhwa';
  if (t.includes('manhua')) return 'type-manhua';
  return 'type-default';
}

function redirectTo404() {
  contentArea.innerHTML = `<div class="text-center py-40 text-red-500">Error 404: Halaman tidak ditemukan.</div>`;
}

async function fetchAPI(url) {
  try {
    const response = await fetch(API_PROXY + encodeURIComponent(url));
    const data = await response.json();
    if (data.success) return data.result?.content || data.result || data;
    return null;
  } catch (e) {
    return null;
  }
}

function toggleFilter() {
  filterPanel.classList.toggle('hidden');
  const genreSelect = document.getElementById('filter-genre');
  if (genreSelect && genreSelect.options.length <= 1) loadGenres();
}

function resetNavs() {
  mainNav.classList.remove('-translate-y-full');
  mobileNav.classList.remove('translate-y-full');
  filterPanel.classList.add('hidden');
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

function setLoading() {
  contentArea.innerHTML = `
    <div class="flex justify-center py-40">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div>
    </div>`;
}

function lockNav() {
  isNavigating = true;
  // kecil: bikin progress bar jadi kecil dulu
  setProgress(0);
}

function unlockNav() {
  isNavigating = false;
}

function setProgress(percent) {
  if (!progressBar) return;
  const p = Math.max(0, Math.min(100, percent));
  progressBar.style.width = `${p}%`;
}

/* progress reader: berdasarkan scroll */
function bindReaderProgress() {
  const onScroll = () => {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    if (scrollHeight <= 0) return setProgress(0);
    const percent = (scrollTop / scrollHeight) * 100;
    setProgress(percent);
  };
  window.removeEventListener('scroll', onScroll);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------------- Data Functions ---------------- */

async function loadGenres() {
  const data = await fetchAPI(`${API_BASE}/genres`);
  if (data && data.data) {
    const select = document.getElementById('filter-genre');
    const sorted = data.data.sort((a, b) => a.title.localeCompare(b.title));
    select.innerHTML = '<option value="">Pilih Genre</option>';
    sorted.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.slug;
      opt.text = g.title;
      select.appendChild(opt);
    });
  }
}

async function showHome(push = true) {
  if (push) updateURL('/');
  resetNavs();
  setLoading();

  const data = await fetchAPI(`${API_BASE}/home`);
  if (!data || !data.data) { redirectTo404(); return; }

  contentArea.innerHTML = `
    <section class="mb-12">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold flex items-center gap-2">
          <i class="fa fa-fire text-amber-500"></i> Populer Hari Ini
        </h2>
      </div>
      <div class="flex overflow-x-auto gap-4 hide-scroll pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        ${data.data.hotUpdates.map(item => `
          <div class="min-w-[150px] md:min-w-[200px] cursor-pointer card-hover relative rounded-2xl overflow-hidden group"
              onclick="showDetail('${item.slug}')">
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10"></div>
            <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Hot'}</span>
            <img src="${item.image}" class="h-64 md:h-80 w-full object-cover transform group-hover:scale-110 transition duration-500">
            <div class="absolute bottom-0 left-0 p-3 z-20 w-full">
              <h3 class="text-sm font-bold truncate text-white drop-shadow-md">${item.title}</h3>
              <p class="text-amber-400 text-xs font-semibold mt-1">${item.chapter || item.latestChapter}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div class="lg:col-span-2">
        <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Rilis Terbaru</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
          ${data.data.latestReleases.slice(0, 15).map(item => `
            <div class="bg-zinc-900/40 border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/50 transition group"
                onclick="showDetail('${item.slug}')">
              <div class="relative h-48 overflow-hidden">
                <span class="type-badge ${getTypeClass(item.type)} bottom-2 left-2 top-auto">${item.type || 'UP'}</span>
                <img src="${item.image}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
              </div>
              <div class="p-3">
                <h3 class="text-xs font-bold line-clamp-2 h-8 leading-relaxed">${item.title}</h3>
                <div class="flex justify-between items-center mt-3">
                  <span class="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400">${item.chapters?.[0]?.title || 'Ch.?'}</span>
                  <span class="text-[10px] text-gray-500">${item.chapters?.[0]?.time || ''}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Proyek Kami</h2>
        <div class="space-y-4">
          ${data.data.projectUpdates.map(item => `
            <div class="flex gap-4 bg-zinc-900/30 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition border border-transparent hover:border-white/10"
                onclick="showDetail('${item.slug}')">
              <img src="${item.image}" class="w-16 h-20 rounded-lg object-cover shadow-lg">
              <div class="flex-1 flex flex-col justify-center overflow-hidden">
                <h3 class="font-bold text-xs truncate mb-1">${item.title}</h3>
                <div class="flex items-center gap-2">
                  <span class="text-amber-500 text-[10px] font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                    ${item.chapters?.[0]?.title || ''}
                  </span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  window.scrollTo(0, 0);
}

async function showOngoing(page = 1) {
  updateURL('/ongoing'); resetNavs();
  setLoading();
  const data = await fetchAPI(`${API_BASE}/list?status=Ongoing&orderby=popular&page=${page}`);
  renderGrid(data, "Komik Ongoing Terpopuler", "showOngoing");
}

async function showCompleted(page = 1) {
  updateURL('/completed'); resetNavs();
  setLoading();
  const data = await fetchAPI(`${API_BASE}/list?status=Completed&orderby=popular&page=${page}`);
  renderGrid(data, "Komik Tamat (Selesai)", "showCompleted");
}

async function showGenre(slug, page = 1) {
  resetNavs();
  setLoading();
  const data = await fetchAPI(`${API_BASE}/genre/${slug}/${page}`);
  if (!data || !data.data || data.data.length === 0) { redirectTo404(); return; }
  renderGrid(data, `Genre: ${slug.toUpperCase()}`, "showGenre", slug);
}

async function applyAdvancedFilter() {
  const query = document.getElementById('search-input').value;
  const genre = document.getElementById('filter-genre').value;
  const type = document.getElementById('filter-type').value;
  const status = document.getElementById('filter-status').value;

  filterPanel.classList.add('hidden');
  setLoading();

  if (query) {
    const data = await fetchAPI(`${API_BASE}/search/${encodeURIComponent(query)}/1`);
    renderGrid(data, `Hasil Pencarian: "${query}"`, null);
    return;
  }
  if (genre) { showGenre(genre, 1); return; }

  let url = `${API_BASE}/list?page=1`;
  if (type) url += `&type=${type}`;
  if (status) url += `&status=${status}`;
  const data = await fetchAPI(url + `&orderby=popular`);
  renderGrid(data, "Hasil Filter", null);
}

function renderGrid(data, title, funcName, extraArg = null) {
  const list = data?.data || [];
  if (list.length === 0) {
    contentArea.innerHTML = `
      <div class="text-center py-40 text-gray-500 flex flex-col items-center gap-4">
        <i class="fa fa-folder-open text-4xl opacity-50"></i>
        <p>Tidak ada komik ditemukan.</p>
      </div>`;
    return;
  }

  let paginationHTML = '';
  if (data.pagination && funcName) {
    const current = data.pagination.currentPage;
    const argStr = extraArg ? `'${extraArg}', ` : '';
    paginationHTML = `
      <div class="mt-14 flex justify-center items-center gap-4">
        ${current > 1 ? `<button onclick="${funcName}(${argStr}${current - 1})" class="glass px-5 py-2 rounded-lg text-xs font-bold hover:bg-amber-500 hover:text-black transition"><i class="fa fa-chevron-left"></i> Prev</button>` : ''}
        <span class="bg-amber-500 text-black px-4 py-2 rounded-lg text-xs font-extrabold shadow-lg shadow-amber-500/20">${current}</span>
        ${data.pagination.hasNextPage ? `<button onclick="${funcName}(${argStr}${current + 1})" class="glass px-5 py-2 rounded-lg text-xs font-bold hover:bg-amber-500 hover:text-black transition">Next <i class="fa fa-chevron-right"></i></button>` : ''}
      </div>
    `;
  }

  contentArea.innerHTML = `
    <h2 class="text-2xl font-bold mb-8 border-l-4 border-amber-500 pl-4">${title}</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      ${list.map(item => `
        <div class="bg-zinc-900/40 rounded-xl overflow-hidden border border-white/5 card-hover cursor-pointer relative group"
            onclick="showDetail('${item.slug}')">
          <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Comic'}</span>
          <div class="relative overflow-hidden aspect-[3/4]">
            <img src="${item.image}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition duration-300"></div>
          </div>
          <div class="p-3 text-center">
            <h3 class="text-xs font-bold truncate group-hover:text-amber-500 transition">${item.title}</h3>
            <p class="text-[10px] text-amber-500 mt-1 font-medium">${item.latestChapter || item.chapter || 'Baca Sekarang'}</p>
          </div>
        </div>
      `).join('')}
    </div>
    ${paginationHTML}
  `;
  window.scrollTo(0, 0);
}

/* ---------------- Detail Page Logic ---------------- */

async function showDetail(idOrSlug, push = true) {
  let slug = idOrSlug;
  setLoading();

  if (idOrSlug.length === 36) {
    const mapping = await getSlugFromUuid(idOrSlug);
    if (mapping) slug = mapping.slug;
  }

  if (push) {
    const uuid = await getUuidFromSlug(slug, 'series');
    updateURL(`/series/${uuid}`);
  }

  resetNavs();
  const data = await fetchAPI(`${API_BASE}/detail/${slug}`);
  if (!data || !data.data) { redirectTo404(); return; }

  const res = data.data;
  currentChapterList = res.chapters || [];

  // simpan context komik utk reader header
  currentComicContext = { slug, title: res.title, image: res.image };

  // tombol baca
  const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
  const savedItem = history.find(h => h.slug === slug);
  const lastCh = savedItem ? savedItem.lastChapterSlug : null;
  const firstCh = res.chapters?.length > 0 ? res.chapters[res.chapters.length - 1].slug : null;

  const startBtnText = lastCh ? "Lanjut Baca" : "Mulai Baca";
  const startBtnAction = lastCh
    ? `readChapter('${lastCh}', '${slug}')`
    : (firstCh ? `readChapter('${firstCh}', '${slug}')` : "alert('Chapter belum tersedia')");

  const backdropHTML = `
    <div class="fixed top-0 left-0 w-full h-[60vh] -z-10 pointer-events-none overflow-hidden">
      <img src="${res.image}" class="w-full h-full object-cover blur-2xl opacity-20 backdrop-banner animate-pulse-slow">
      <div class="absolute inset-0 bg-gradient-to-b from-[#0b0b0f]/40 via-[#0b0b0f]/80 to-[#0b0b0f]"></div>
    </div>
  `;

  const synopsisText = res.synopsis || "Sinopsis tidak tersedia.";
  const isLongSynopsis = synopsisText.length > 250;

  contentArea.innerHTML = `
    ${backdropHTML}

    <div class="relative z-10 flex flex-col md:flex-row gap-8 lg:gap-12 mt-4 animate-fade-in">

      <div class="md:w-[280px] flex-shrink-0 mx-auto md:mx-0 w-full max-w-[280px]">
        <div class="relative group">
          <span class="type-badge ${getTypeClass(res.type)} scale-110 top-4 left-4 shadow-lg">${res.type || 'Comic'}</span>
          <img src="${res.image}" class="w-full rounded-2xl shadow-2xl border border-white/10 group-hover:border-amber-500/30 transition duration-500">
        </div>

        <div class="flex flex-col gap-3 mt-6">
          <button onclick="${startBtnAction}" class="amber-gradient w-full py-3.5 rounded-xl font-bold text-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-amber-500/20">
            <i class="fa fa-book-open"></i> ${startBtnText}
          </button>
          <button onclick="toggleBookmark('${slug}', '${String(res.title).replace(/'/g, "")}', '${res.image}')" id="btn-bookmark"
            class="w-full py-3.5 rounded-xl glass font-semibold border-white/10 hover:bg-white/10 transition flex items-center justify-center gap-2">
            <i class="fa fa-bookmark"></i> Simpan
          </button>
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <h1 class="text-3xl md:text-5xl font-extrabold mb-4 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">${res.title}</h1>

        <div class="flex flex-wrap gap-3 mb-6">
          <div class="glass px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold text-amber-400 border border-amber-500/20">
            <i class="fa fa-star"></i> ${res.rating}
          </div>
          <div class="glass px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold text-green-400 border border-green-500/20">
            <i class="fa fa-circle text-[6px]"></i> ${res.status}
          </div>
          <div class="glass px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold text-blue-400 border border-blue-500/20">
            ${res.type}
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mb-6">
          ${res.genres ? res.genres.map(g => `
            <span onclick="showGenre('${g.slug}')" class="cursor-pointer hover:text-amber-500 transition text-gray-400 text-xs px-3 py-1 rounded-full border border-white/10 hover:border-amber-500/50 bg-white/5">
              ${g.title}
            </span>`).join('') : ''}
        </div>

        <div class="bg-white/5 rounded-2xl p-5 md:p-6 mb-8 border border-white/5 backdrop-blur-sm">
          <h3 class="font-bold text-sm mb-2 text-amber-500 uppercase tracking-wide">Sinopsis</h3>
          <p id="synopsis-text" class="text-gray-300 text-sm leading-relaxed text-justify ${isLongSynopsis ? 'line-clamp-4' : ''} transition-all duration-300">
            ${synopsisText}
          </p>
          ${isLongSynopsis ? `
            <button onclick="toggleSynopsis()" id="synopsis-btn" class="text-amber-500 text-xs font-bold mt-2 hover:text-white transition flex items-center gap-1">
              Baca Selengkapnya <i class="fa fa-chevron-down"></i>
            </button>` : ''}
        </div>

        <div class="glass rounded-2xl border border-white/10 overflow-hidden">
          <div class="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5">
            <h3 class="font-bold text-lg flex items-center gap-2">
              <i class="fa fa-list-ul text-amber-500"></i> Daftar Chapter
              <span class="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">${res.chapters?.length || 0}</span>
            </h3>
            <div class="relative w-full sm:w-auto group">
              <i class="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs group-focus-within:text-amber-500 transition"></i>
              <input type="text" id="chapter-search" onkeyup="filterChapters()" placeholder="Cari Chapter..."
                class="w-full sm:w-64 bg-black/30 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-amber-500 transition text-white">
            </div>
          </div>

          <div id="chapter-list-container" class="max-h-[500px] overflow-y-auto chapter-list-scroll p-2 bg-black/20"></div>
        </div>
      </div>
    </div>
  `;

  renderChapterList(res.chapters || [], slug);
  checkBookmarkStatus(slug);
  saveHistory(slug, res.title, res.image);
  window.scrollTo(0, 0);
}

function toggleSynopsis() {
  const txt = document.getElementById('synopsis-text');
  const btn = document.getElementById('synopsis-btn');
  if (!txt || !btn) return;

  if (txt.classList.contains('line-clamp-4')) {
    txt.classList.remove('line-clamp-4');
    btn.innerHTML = `Tutup <i class="fa fa-chevron-up"></i>`;
  } else {
    txt.classList.add('line-clamp-4');
    btn.innerHTML = `Baca Selengkapnya <i class="fa fa-chevron-down"></i>`;
  }
}

function renderChapterList(chapters, comicSlug) {
  const container = document.getElementById('chapter-list-container');
  const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
  const comicHistory = history.find(h => h.slug === comicSlug);
  const lastReadSlug = comicHistory ? comicHistory.lastChapterSlug : '';

  if (!chapters || chapters.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm">Tidak ada chapter.</div>';
    return;
  }

  container.innerHTML = chapters.map(ch => {
    const isLastRead = ch.slug === lastReadSlug;
    return `
      <div onclick="safeReadChapter('${ch.slug}', '${comicSlug}')"
        class="chapter-item group flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer border border-transparent transition-all duration-200
        ${isLastRead ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 hover:bg-white/10 hover:border-amber-500/30'}">

        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 group-hover:text-amber-500 group-hover:bg-amber-500/10 transition shrink-0">
            <i class="fa ${isLastRead ? 'fa-history' : 'fa-hashtag'} text-xs"></i>
          </div>
          <span class="text-sm font-medium truncate group-hover:text-amber-500 transition ${isLastRead ? 'text-amber-500' : 'text-gray-300'}">
            ${ch.title}
          </span>
        </div>

        <div class="text-[10px] text-gray-500 bg-black/20 px-2 py-1 rounded group-hover:bg-amber-500 group-hover:text-black transition font-bold shrink-0">
          Baca
        </div>
      </div>
    `;
  }).join('');
}

/* wrapper supaya ga double click */
function safeReadChapter(chSlug, comicSlug) {
  if (isNavigating) return;
  readChapter(chSlug, comicSlug, true);
}

function filterChapters() {
  const input = document.getElementById('chapter-search');
  const filter = (input?.value || '').toLowerCase();
  const container = document.getElementById('chapter-list-container');
  const items = container.getElementsByClassName('chapter-item');

  for (let i = 0; i < items.length; i++) {
    const span = items[i].getElementsByTagName("span")[0];
    const txtValue = span.textContent || span.innerText;
    items[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
  }
}

/* ---------------- Reader Logic (improved) ---------------- */

function normalizeChapterLabel(text) {
  // bikin label lebih rapih: kalau sudah ada "Chapter" biarin, kalau tidak coba extract angka
  if (!text) return "Chapter";
  const t = String(text).trim();
  if (/chapter/i.test(t)) return t;

  // ambil angka terakhir
  const m = t.match(/(\d+(\.\d+)?)/);
  if (m) return `Chapter ${m[1]}`;
  return t;
}

async function readChapter(chIdOrSlug, comicSlug = null, push = true) {
  if (isNavigating) return;
  lockNav();

  // feedback instan (biar ga terasa klik berkali-kali)
  setLoading();

  try {
    let chSlug = chIdOrSlug;

    // kalau UUID, convert ke slug via backend
    if (chIdOrSlug.length === 36) {
      const mapping = await getSlugFromUuid(chIdOrSlug);
      if (mapping) chSlug = mapping.slug;
    }

    // update URL dengan pola lama (tetap pakai backend mapping, sesuai request kamu)
    if (push) {
      const uuid = await getUuidFromSlug(chSlug, 'chapter');
      updateURL(`/chapter/${uuid}`);
    }

    // hide nav
    mainNav.classList.add('-translate-y-full');
    mobileNav.classList.add('translate-y-full');

    const data = await fetchAPI(`${API_BASE}/chapter/${chSlug}`);
    if (!data || !data.data) { redirectTo404(); return; }

    const res = data.data;

    // pastiin comic slug ada
    let finalComicSlug = comicSlug;
    if (!finalComicSlug) {
      if (res.parent_slug) finalComicSlug = res.parent_slug;
      else if (res.comic_slug) finalComicSlug = res.comic_slug;
      else if (res.relation && res.relation.slug) finalComicSlug = res.relation.slug;
    }

    // ambil context title komik (kalau belum ada)
    const comicTitle = currentComicContext?.title || res.comic_title || res.parent_title || "Komik";
    const chapterLabel = normalizeChapterLabel(res.title || chSlug);

    const backAction = finalComicSlug ? `showDetail('${finalComicSlug}')` : `showHome()`;

    // dropdown
    let dropdownHTML = '';
    if (currentChapterList && currentChapterList.length > 0) {
      dropdownHTML = generateDropdownHTML(currentChapterList, chSlug, finalComicSlug);
    } else {
      dropdownHTML = `<div id="dropdown-placeholder" class="w-32"></div>`;
    }

    contentArea.innerHTML = `
      <div class="relative min-h-screen bg-[#0b0b0f] -mx-4 -mt-24">

        <!-- Top Bar -->
        <div id="reader-top" class="reader-ui fixed top-0 w-full bg-gradient-to-b from-black/90 to-transparent z-[60] p-4 flex justify-between items-center transition-all duration-300">
          <div class="flex items-center gap-3">
            <button onclick="${backAction}" class="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-amber-500 hover:text-black hover:border-amber-500 transition text-white">
              <i class="fa fa-arrow-left"></i>
            </button>

            <div class="flex flex-col drop-shadow-md min-w-0">
              <span class="text-[9px] text-amber-500 uppercase tracking-widest font-bold">Reading</span>
              <h2 class="text-xs font-bold text-white max-w-[220px] truncate">${comicTitle}</h2>
              <p class="text-[10px] text-gray-300 max-w-[220px] truncate">${chapterLabel}</p>
            </div>
          </div>

          <button onclick="toggleFullScreen()" class="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/20 transition text-white">
            <i class="fa fa-expand text-xs"></i>
          </button>
        </div>

        <!-- Image Container -->
        <div id="reader-images" class="flex flex-col items-center pt-0 pb-0 min-h-screen w-full max-w-3xl mx-auto bg-[#111]" onclick="toggleReaderUI()">
        </div>

        <!-- Bottom Bar -->
        <div id="reader-bottom" class="reader-ui fixed bottom-6 left-0 w-full z-[60] px-4 flex justify-center transition-all duration-300">
          <div class="glass p-2 rounded-2xl flex gap-1 items-center shadow-2xl border border-white/10 bg-black/80 backdrop-blur-xl">
            <button id="btn-prev"
              onclick="${res.navigation?.prev ? `readChapter('${res.navigation.prev}', '${finalComicSlug || ''}')` : ''}"
              class="w-10 h-10 flex items-center justify-center rounded-xl ${!res.navigation?.prev ? 'opacity-30 cursor-not-allowed text-gray-500' : 'hover:bg-amber-500 hover:text-black transition text-white'}">
              <i class="fa fa-chevron-left"></i>
            </button>

            <div id="chapter-dropdown-container">
              ${dropdownHTML}
            </div>

            <button id="btn-next"
              onclick="${res.navigation?.next ? `readChapter('${res.navigation.next}', '${finalComicSlug || ''}')` : ''}"
              class="w-10 h-10 flex items-center justify-center rounded-xl ${!res.navigation?.next ? 'opacity-30 cursor-not-allowed text-gray-500' : 'amber-gradient text-black hover:scale-105 transition shadow-lg shadow-amber-500/20'}">
              <i class="fa fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    // render images + progress
    const imageContainer = document.getElementById('reader-images');
    const imgs = res.images || [];

    // biar terasa cepat: progress naik sedikit saat mulai render
    setProgress(10);

    let loadedCount = 0;
    const total = Math.max(1, imgs.length);

    imgs.forEach((imgUrl) => {
      const wrapper = document.createElement('div');
      wrapper.className = "w-full relative min-h-[400px] bg-[#1a1a1a]";

      const skeleton = document.createElement('div');
      skeleton.className = "skeleton absolute inset-0 w-full h-full z-10";

      const img = new Image();
      img.src = imgUrl;
      img.className = "comic-page opacity-0 transition-opacity duration-500 relative z-20";
      img.loading = "lazy";

      img.onload = () => {
        loadedCount++;
        skeleton.remove();
        img.classList.remove('opacity-0');
        wrapper.style.minHeight = "auto";
        wrapper.style.backgroundColor = "transparent";

        // progress berdasarkan jumlah gambar loaded
        setProgress(10 + (loadedCount / total) * 70);
      };

      img.onerror = () => {
        loadedCount++;
        skeleton.remove();
        wrapper.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 bg-zinc-900 text-gray-500 gap-3 border border-red-900/30">
            <i class="fa fa-triangle-exclamation text-red-500 text-2xl"></i>
            <span class="text-xs">Gagal memuat gambar</span>
            <button onclick="this.parentElement.parentElement.querySelector('img').src='${imgUrl}'" class="text-[10px] bg-white/10 px-4 py-2 rounded hover:bg-white/20 mt-1">Coba Lagi</button>
          </div>
        `;
        wrapper.appendChild(img);
        setProgress(10 + (loadedCount / total) * 70);
      };

      wrapper.appendChild(skeleton);
      wrapper.appendChild(img);
      imageContainer.appendChild(wrapper);
    });

    // history
    if (finalComicSlug) {
      saveHistory(finalComicSlug, currentComicContext?.title, currentComicContext?.image, chSlug, chapterLabel);
    }

    // restore dropdown kalau refresh langsung di chapter
    if ((!currentChapterList || currentChapterList.length === 0) && finalComicSlug) {
      fetchAndPopulateDropdown(finalComicSlug, chSlug);
    }

    // final progress
    setProgress(100);
    window.scrollTo(0, 0);
    bindReaderProgress();
  } finally {
    unlockNav();
  }
}

function generateDropdownHTML(list, currentSlug, comicSlug) {
  return `
    <div class="relative group mx-2">
      <select onchange="safeReadChapter(this.value, '${comicSlug || ''}')"
        class="appearance-none bg-black/50 backdrop-blur text-white border border-white/10 rounded-xl text-xs py-2.5 pl-3 pr-8 focus:outline-none focus:border-amber-500 cursor-pointer hover:bg-white/10 transition w-40 md:w-auto truncate">
        ${list.map(ch => `<option value="${ch.slug}" ${ch.slug === currentSlug ? 'selected' : ''}>${ch.title}</option>`).join('')}
      </select>
      <i class="fa fa-chevron-up absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-gray-400"></i>
    </div>
  `;
}

async function fetchAndPopulateDropdown(comicSlug, currentChapterSlug) {
  const data = await fetchAPI(`${API_BASE}/detail/${comicSlug}`);
  if (data && data.data) {
    currentChapterList = data.data.chapters || [];
    // update context komik
    currentComicContext = {
      slug: comicSlug,
      title: data.data.title,
      image: data.data.image
    };

    const container = document.getElementById('chapter-dropdown-container');
    if (container) {
      container.innerHTML = generateDropdownHTML(currentChapterList, currentChapterSlug, comicSlug);
    }
    saveHistory(comicSlug, data.data.title, data.data.image, currentChapterSlug);
  }
}

function toggleReaderUI() {
  const top = document.getElementById('reader-top');
  const bottom = document.getElementById('reader-bottom');
  if (!top || !bottom) return;
  top.classList.toggle('ui-hidden-top');
  bottom.classList.toggle('ui-hidden-bottom');
}

/* ---------------- History & Bookmarks ---------------- */

function handleSearch(e) { if (e.key === 'Enter') applyAdvancedFilter(); }

function saveHistory(slug, title, image, chSlug, chTitle) {
  let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
  let existing = history.find(h => h.slug === slug);

  const data = {
    slug,
    title: title || existing?.title || 'Unknown Title',
    image: image || existing?.image || 'assets/icon.png',
    lastChapterSlug: chSlug || existing?.lastChapterSlug,
    lastChapterTitle: chTitle || existing?.lastChapterTitle || 'Chapter ?',
    timestamp: new Date().getTime()
  };

  history = history.filter(h => h.slug !== slug);
  history.unshift(data);
  if (history.length > 50) history.pop();
  localStorage.setItem('fmc_history', JSON.stringify(history));
}

function showHistory() {
  updateURL('/history'); resetNavs();
  let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
  renderGrid({ data: history }, "Riwayat Baca", null);
}

function toggleBookmark(slug, title, image) {
  let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
  const idx = bookmarks.findIndex(b => b.slug === slug);
  if (idx > -1) bookmarks.splice(idx, 1);
  else bookmarks.push({ slug, title, image });
  localStorage.setItem('fmc_bookmarks', JSON.stringify(bookmarks));
  checkBookmarkStatus(slug);
}

function checkBookmarkStatus(slug) {
  let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
  const btn = document.getElementById('btn-bookmark');
  if (!btn) return;

  if (bookmarks.some(b => b.slug === slug)) {
    btn.innerHTML = `<i class="fa fa-check text-amber-500"></i> Tersimpan`;
    btn.classList.add('border-amber-500/50', 'bg-amber-500/10');
    btn.classList.remove('glass');
  } else {
    btn.innerHTML = `<i class="fa fa-bookmark"></i> Simpan`;
    btn.classList.remove('border-amber-500/50', 'bg-amber-500/10');
    btn.classList.add('glass');
  }
}

function showBookmarks() {
  updateURL('/bookmarks'); resetNavs();
  let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
  renderGrid({ data: bookmarks }, "Koleksi Favorit", null);
}

/* ---------------- Init ---------------- */

async function handleInitialLoad() {
  const path = window.location.pathname;
  resetNavs();

  if (path === '/404.html') return;

  if (path.startsWith('/series/')) {
    const uuid = path.split('/')[2];
    if (uuid) showDetail(uuid, false);
    else showHome(false);
  }
  else if (path.startsWith('/chapter/')) {
    const uuid = path.split('/')[2];
    if (uuid) readChapter(uuid, null, false);
    else showHome(false);
  }
  else if (path === '/ongoing') showOngoing(1);
  else if (path === '/completed') showCompleted(1);
  else if (path === '/history') showHistory();
  else if (path === '/bookmarks') showBookmarks();
  else showHome(false);
}

window.addEventListener('popstate', () => handleInitialLoad());

document.addEventListener('DOMContentLoaded', () => {
  loadGenres();
  handleInitialLoad();
});
