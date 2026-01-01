/* script.js - Webtoon Style Remastered */

const API_PROXY = "https://api.nekolabs.web.id/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

const contentArea = document.getElementById('content-area');
const filterPanel = document.getElementById('filter-panel');
const mainNav = document.getElementById('main-nav');
const mobileNav = document.getElementById('mobile-nav');

let currentChapterList = [];
let heroInterval = null; // Variable untuk menyimpan interval slider

// --- Helpers ---
async function getUuidFromSlug(slug, type) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/get-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, type })
        });
        const data = await res.json();
        return data.uuid;
    } catch (e) { return slug; }
}

async function getSlugFromUuid(uuid) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/get-slug/${uuid}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) { return null; }
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
    } catch (e) { return null; }
}

function toggleFilter() {
    filterPanel.classList.toggle('hidden');
    if (document.getElementById('filter-genre').options.length <= 1) loadGenres();
}

function resetNavs() {
    mainNav.classList.remove('-translate-y-full');
    mobileNav.classList.remove('translate-y-full');
    mainNav.classList.remove('opacity-0'); // Pastikan nav terlihat
    filterPanel.classList.add('hidden');
    clearInterval(heroInterval); // Stop slider jika pindah halaman
}

function setLoading() {
    contentArea.innerHTML = `<div class="flex flex-col h-screen items-center justify-center"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
}

// --- HOME PAGE (WEBTOON STYLE) ---

async function showHome(push = true) {
    if (push) updateURL('/'); 
    resetNavs();
    
    // Skeleton Loading Keren untuk Home
    contentArea.innerHTML = `
        <div class="animate-pulse">
            <div class="h-[50vh] bg-zinc-800 w-full mb-8"></div>
            <div class="container mx-auto px-4">
                <div class="h-8 bg-zinc-800 w-48 rounded mb-4"></div>
                <div class="flex gap-4 overflow-hidden mb-8">
                    <div class="h-64 w-40 bg-zinc-800 rounded-xl shrink-0"></div>
                    <div class="h-64 w-40 bg-zinc-800 rounded-xl shrink-0"></div>
                    <div class="h-64 w-40 bg-zinc-800 rounded-xl shrink-0"></div>
                </div>
            </div>
        </div>
    `;
    
    const data = await fetchAPI(`${API_BASE}/home`);
    if(!data || !data.data) { redirectTo404(); return; }

    const hot = data.data.hotUpdates || [];
    const latest = data.data.latestReleases || [];
    const projects = data.data.projectUpdates || [];

    // 1. Logic Hero Slider (Ambil 5 komik trending teratas)
    const heroes = hot.slice(0, 5); 
    const heroHTML = `
        <div class="hero-wrapper mb-8">
            ${heroes.map((item, index) => `
                <div class="hero-slide ${index === 0 ? 'active' : ''}" id="slide-${index}">
                    <!-- Background Blur -->
                    <div class="absolute inset-0 bg-cover bg-center blur-2xl opacity-50 scale-110" style="background-image: url('${item.image}');"></div>
                    <div class="absolute inset-0 bg-black/40"></div>
                    
                    <!-- Main Image (Centered & Contain) -->
                    <div class="absolute inset-0 flex items-center justify-center md:justify-end md:pr-20 pointer-events-none">
                         <img src="${item.image}" class="h-full w-full object-cover md:object-contain md:w-auto opacity-60 md:opacity-100 mask-image-b md:mask-none">
                    </div>

                    <!-- Content Text -->
                    <div class="hero-content container mx-auto px-4 pb-12 md:pb-20">
                        <span class="inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-wider text-black bg-amber-500 rounded-full w-fit uppercase shadow-lg shadow-amber-500/50">
                            Featured #${index + 1}
                        </span>
                        <h1 class="text-3xl md:text-6xl font-extrabold mb-2 leading-tight drop-shadow-lg max-w-2xl line-clamp-2">${item.title}</h1>
                        <div class="flex items-center gap-4 text-sm font-medium text-gray-300 mb-6">
                            <span class="flex items-center gap-1"><i class="fa fa-layer-group text-amber-500"></i> ${item.type || 'Manhwa'}</span>
                            <span class="flex items-center gap-1"><i class="fa fa-star text-yellow-500"></i> Popular</span>
                        </div>
                        <div class="flex gap-3 pointer-events-auto">
                            <button onclick="showDetail('${item.slug}')" class="amber-gradient text-black px-8 py-3 rounded-xl font-bold hover:scale-105 transition shadow-lg shadow-amber-500/20">
                                Baca Sekarang
                            </button>
                            <button onclick="showDetail('${item.slug}')" class="glass px-4 py-3 rounded-xl hover:bg-white/10 transition">
                                <i class="fa fa-info-circle text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
            
            <!-- Indicators -->
            <div class="absolute bottom-6 right-6 md:right-20 flex gap-2 z-20">
                ${heroes.map((_, i) => `
                    <div class="w-2 h-2 md:w-3 md:h-1 rounded-full bg-white/30 cursor-pointer transition-all duration-300 slider-dot ${i===0?'bg-amber-500 w-6 md:w-8':''}" onclick="changeSlide(${i})"></div>
                `).join('')}
            </div>
        </div>
    `;

    // 2. Logic Top Ranking (Hot Updates sisa)
    const rankingItems = hot.slice(0, 10);
    const rankingHTML = `
        <section class="container mx-auto px-4 mb-12">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold flex items-center gap-2"><i class="fa fa-crown text-amber-500"></i> Top Ranking</h2>
                <button onclick="showOngoing()" class="text-xs text-gray-400 hover:text-white transition">Lihat Semua <i class="fa fa-chevron-right text-[10px]"></i></button>
            </div>
            <div class="flex overflow-x-auto gap-5 hide-scroll pb-6 pt-2 snap-x">
                ${rankingItems.map((item, i) => `
                    <div class="snap-start min-w-[140px] md:min-w-[160px] cursor-pointer relative group" onclick="showDetail('${item.slug}')">
                        <div class="relative rounded-xl overflow-hidden aspect-[3/4] card-hover border border-white/5">
                            <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Comic'}</span>
                            <img src="${item.image}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60"></div>
                        </div>
                        <!-- Ranking Number -->
                        <div class="rank-number">${i + 1}</div>
                        
                        <div class="mt-3 pl-1">
                            <h3 class="text-sm font-bold truncate group-hover:text-amber-500 transition">${item.title}</h3>
                            <p class="text-[10px] text-gray-500">${item.chapter || item.latestChapter}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;

    // 3. Logic Projects (Widescreen Cards)
    const projectHTML = projects.length > 0 ? `
        <section class="container mx-auto px-4 mb-12">
            <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Proyek Eksklusif</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${projects.slice(0,6).map(item => `
                    <div onclick="showDetail('${item.slug}')" class="bg-zinc-900/50 border border-white/5 rounded-2xl p-3 flex gap-4 cursor-pointer hover:bg-white/5 hover:border-amber-500/30 transition group">
                        <img src="${item.image}" class="w-20 h-28 object-cover rounded-xl shadow-lg group-hover:scale-105 transition">
                        <div class="flex-1 flex flex-col justify-center">
                            <span class="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Exclusive</span>
                            <h3 class="font-bold text-sm line-clamp-2 leading-tight mb-2 group-hover:text-amber-500 transition">${item.title}</h3>
                            <span class="text-[10px] bg-white/10 px-2 py-1 rounded w-fit text-gray-300">${item.chapters[0]?.title}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    ` : '';

    // 4. Logic Latest Update (Grid Bersih)
    const latestHTML = `
        <section class="container mx-auto px-4">
            <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Rilis Terbaru</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
                ${latest.map(item => `
                    <div class="cursor-pointer group" onclick="showDetail('${item.slug}')">
                        <div class="relative rounded-xl overflow-hidden aspect-[3/4] mb-3 border border-white/5 card-hover">
                            <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'UP'}</span>
                            <img src="${item.image}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                            <!-- Overlay Time -->
                            <div class="absolute bottom-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
                                <p class="text-[10px] text-gray-300 text-right"><i class="fa fa-clock text-[8px] mr-1"></i>${item.chapters[0]?.time || 'Baru'}</p>
                            </div>
                        </div>
                        <h3 class="text-xs font-bold line-clamp-2 leading-relaxed group-hover:text-amber-500 transition h-8">${item.title}</h3>
                        <div class="flex justify-between items-center mt-2">
                             <span class="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">${item.chapters[0]?.title || 'Ch.?'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-10 flex justify-center">
                <button onclick="showOngoing(1)" class="glass px-8 py-3 rounded-full text-sm font-bold hover:bg-amber-500 hover:text-black transition">Lihat Semua Update</button>
            </div>
        </section>
    `;

    // Gabungkan Semua Layout
    contentArea.innerHTML = `
        <div class="-mt-24 md:-mt-24"> <!-- Mengkompensasi margin top main container agar Hero full ke atas -->
            ${heroHTML}
            ${rankingHTML}
            ${projectHTML}
            ${latestHTML}
        </div>
    `;

    // Start Auto Slider
    initSlider(heroes.length);
    window.scrollTo(0,0);
}

// Logic untuk Slider
let slideIndex = 0;
function initSlider(total) {
    if (total <= 1) return;
    clearInterval(heroInterval);
    
    const showSlide = (n) => {
        const slides = document.querySelectorAll('.hero-slide');
        const dots = document.querySelectorAll('.slider-dot');
        
        slideIndex = (n + total) % total; // Cycle logic
        
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => {
            d.classList.remove('bg-amber-500', 'w-6', 'md:w-8');
            d.classList.add('bg-white/30');
        });

        if(slides[slideIndex]) slides[slideIndex].classList.add('active');
        if(dots[slideIndex]) {
            dots[slideIndex].classList.remove('bg-white/30');
            dots[slideIndex].classList.add('bg-amber-500', 'w-6', 'md:w-8');
        }
    };

    window.changeSlide = (n) => {
        clearInterval(heroInterval); // Reset timer jika user klik manual
        showSlide(n);
        startTimer();
    };

    const startTimer = () => {
        heroInterval = setInterval(() => {
            showSlide(slideIndex + 1);
        }, 5000); // Ganti slide setiap 5 detik
    };

    startTimer();
}


// --- Functions Lainnya (Tetap Sama/Optimized) ---

async function loadGenres() {
    const data = await fetchAPI(`${API_BASE}/genres`);
    if(data && data.data) {
        const select = document.getElementById('filter-genre');
        const sorted = data.data.sort((a, b) => a.title.localeCompare(b.title));
        select.innerHTML = '<option value="">Pilih Genre</option>';
        sorted.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.slug; opt.text = g.title; select.appendChild(opt);
        });
    }
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
        renderGrid(data, `Hasil Pencarian: "${query}"`, null); return;
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
    if(list.length === 0) {
        contentArea.innerHTML = `<div class="text-center py-40 text-gray-500">Tidak ada komik ditemukan.</div>`; return;
    }
    
    let paginationHTML = '';
    if (data.pagination && funcName) {
        const current = data.pagination.currentPage;
        const argStr = extraArg ? `'${extraArg}', ` : '';
        paginationHTML = `
            <div class="mt-14 flex justify-center items-center gap-4">
                ${current > 1 ? `<button onclick="${funcName}(${argStr}${current - 1})" class="glass px-5 py-2 rounded-lg text-xs font-bold hover:bg-amber-500 hover:text-black transition">Prev</button>` : ''}
                <span class="bg-amber-500 text-black px-4 py-2 rounded-lg text-xs font-extrabold shadow-lg">${current}</span>
                ${data.pagination.hasNextPage ? `<button onclick="${funcName}(${argStr}${current + 1})" class="glass px-5 py-2 rounded-lg text-xs font-bold hover:bg-amber-500 hover:text-black transition">Next</button>` : ''}
            </div>
        `;
    }

    contentArea.innerHTML = `
        <div class="container mx-auto px-4 pt-4">
            <h2 class="text-2xl font-bold mb-8 border-l-4 border-amber-500 pl-4">${title}</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                ${list.map(item => `
                    <div class="bg-zinc-900/40 rounded-xl overflow-hidden border border-white/5 card-hover cursor-pointer relative group" onclick="showDetail('${item.slug}')">
                        <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Comic'}</span>
                        <div class="relative overflow-hidden aspect-[3/4]">
                            <img src="${item.image}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                        </div>
                        <div class="p-3 text-center">
                            <h3 class="text-xs font-bold truncate group-hover:text-amber-500 transition">${item.title}</h3>
                            <p class="text-[10px] text-amber-500 mt-1 font-medium">${item.latestChapter || item.chapter || 'Baca'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${paginationHTML}
        </div>
    `;
    window.scrollTo(0,0);
}

async function showOngoing(page = 1) {
    updateURL('/ongoing'); resetNavs(); setLoading();
    const data = await fetchAPI(`${API_BASE}/list?status=Ongoing&orderby=popular&page=${page}`);
    renderGrid(data, "Komik Ongoing Terpopuler", "showOngoing");
}

async function showCompleted(page = 1) {
    updateURL('/completed'); resetNavs(); setLoading();
    const data = await fetchAPI(`${API_BASE}/list?status=Completed&orderby=popular&page=${page}`);
    renderGrid(data, "Komik Tamat (Selesai)", "showCompleted");
}

async function showGenre(slug, page = 1) {
    resetNavs(); setLoading();
    const data = await fetchAPI(`${API_BASE}/genre/${slug}/${page}`);
    if(!data || !data.data || data.data.length === 0) { redirectTo404(); return; }
    renderGrid(data, `Genre: ${slug.toUpperCase()}`, "showGenre", slug);
}

// --- Detail & Reader (Versi Bagus dari sebelumnya) ---

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
    if(!data || !data.data) { redirectTo404(); return; }

    const res = data.data;
    currentChapterList = res.chapters;

    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const savedItem = history.find(h => h.slug === slug);
    const lastCh = savedItem ? savedItem.lastChapterSlug : null;
    const startBtnText = lastCh ? "Lanjut Baca" : "Mulai Baca";
    const startBtnAction = lastCh ? `readChapter('${lastCh}', '${slug}')` : (res.chapters.length > 0 ? `readChapter('${res.chapters[res.chapters.length-1].slug}', '${slug}')` : "");

    const backdropHTML = `
        <div class="fixed top-0 left-0 w-full h-[60vh] -z-10 pointer-events-none overflow-hidden">
            <img src="${res.image}" class="w-full h-full object-cover blur-2xl opacity-20 backdrop-banner">
            <div class="absolute inset-0 bg-gradient-to-b from-[#0b0b0f]/40 via-[#0b0b0f]/80 to-[#0b0b0f]"></div>
        </div>
    `;

    contentArea.innerHTML = `
        ${backdropHTML}
        <div class="container mx-auto px-4 pt-10 pb-20">
            <div class="flex flex-col md:flex-row gap-8 lg:gap-12 animate-fade-in">
                <div class="md:w-[260px] flex-shrink-0 mx-auto w-full max-w-[260px]">
                    <div class="relative group">
                        <span class="type-badge ${getTypeClass(res.type)} scale-110 top-4 left-4 shadow-lg">${res.type || 'Comic'}</span>
                        <img src="${res.image}" class="w-full rounded-2xl shadow-2xl border border-white/10 group-hover:border-amber-500/30 transition">
                    </div>
                    <div class="flex flex-col gap-3 mt-6">
                        <button onclick="${startBtnAction}" class="amber-gradient w-full py-3.5 rounded-xl font-bold text-black flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-amber-500/20">
                            <i class="fa fa-book-open"></i> ${startBtnText}
                        </button>
                        <button onclick="toggleBookmark('${slug}', '${res.title.replace(/'/g, "")}', '${res.image}')" id="btn-bookmark" class="w-full py-3.5 rounded-xl glass font-semibold hover:bg-white/10 transition flex items-center justify-center gap-2"><i class="fa fa-bookmark"></i> Simpan</button>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h1 class="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">${res.title}</h1>
                    <div class="flex gap-3 mb-6">
                        <span class="glass px-3 py-1 rounded text-xs font-bold text-amber-400">⭐ ${res.rating}</span>
                        <span class="glass px-3 py-1 rounded text-xs font-bold text-green-400">● ${res.status}</span>
                    </div>
                    <p class="text-gray-300 text-sm leading-relaxed text-justify mb-8 line-clamp-6 hover:line-clamp-none cursor-pointer">${res.synopsis || "..."}</p>
                    
                    <div class="glass rounded-2xl border border-white/10 overflow-hidden">
                        <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 class="font-bold flex items-center gap-2"><i class="fa fa-list"></i> Chapter <span class="bg-amber-500 text-black text-[10px] px-2 rounded-full">${res.chapters.length}</span></h3>
                            <input type="text" id="chapter-search" onkeyup="filterChapters()" placeholder="Cari..." class="bg-black/30 border border-white/10 rounded px-3 py-1 text-xs w-32 focus:border-amber-500 focus:outline-none">
                        </div>
                        <div id="chapter-list-container" class="max-h-[500px] overflow-y-auto p-2 bg-black/20 chapter-list-scroll"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    renderChapterList(res.chapters, slug);
    checkBookmarkStatus(slug);
    saveHistory(slug, res.title, res.image);
    window.scrollTo(0,0);
}

function renderChapterList(chapters, comicSlug) {
    const container = document.getElementById('chapter-list-container');
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const comicHistory = history.find(h => h.slug === comicSlug);
    const lastReadSlug = comicHistory ? comicHistory.lastChapterSlug : '';

    container.innerHTML = chapters.map(ch => {
        const isLastRead = ch.slug === lastReadSlug;
        return `
            <div onclick="readChapter('${ch.slug}', '${comicSlug}')" class="chapter-item flex justify-between p-3 mb-1 rounded-xl cursor-pointer border border-transparent transition ${isLastRead ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 hover:bg-white/10'}">
                <span class="text-sm font-medium ${isLastRead ? 'text-amber-500' : 'text-gray-300'}">${ch.title}</span>
                <span class="text-[10px] text-gray-500">${ch.time || ''}</span>
            </div>
        `;
    }).join('');
}

function filterChapters() {
    const input = document.getElementById('chapter-search').value.toLowerCase();
    const items = document.getElementsByClassName('chapter-item');
    for (let item of items) {
        item.style.display = item.innerText.toLowerCase().includes(input) ? "" : "none";
    }
}

// --- Reader (Full Screen Logic) ---

async function readChapter(chIdOrSlug, comicSlug = null, push = true) {
    let chSlug = chIdOrSlug;
    contentArea.innerHTML = `<div class="flex flex-col h-screen items-center justify-center gap-4"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div><p class="text-xs animate-pulse">Memuat Chapter...</p></div>`;

    if (idOrSlug.length === 36) {
        const mapping = await getSlugFromUuid(idOrSlug);
        if (mapping) chSlug = mapping.slug;
    }

    if (push) {
        const uuid = await getUuidFromSlug(chSlug, 'chapter');
        updateURL(`/chapter/${uuid}`);
    }

    mainNav.classList.add('-translate-y-full');
    mobileNav.classList.add('translate-y-full');
    
    const data = await fetchAPI(`${API_BASE}/chapter/${chSlug}`);
    if(!data || !data.data) { redirectTo404(); return; }
    const res = data.data;

    let dropdownHTML = `<select onchange="readChapter(this.value, '${comicSlug}')" class="bg-black/50 text-white border border-white/10 rounded-lg text-xs py-2 px-2 outline-none w-32 truncate">
        ${currentChapterList.map(ch => `<option value="${ch.slug}" ${ch.slug === chSlug ? 'selected' : ''}>${ch.title}</option>`).join('')}
    </select>`;

    contentArea.innerHTML = `
        <div class="relative min-h-screen bg-[#0b0b0f] -mx-4 -mt-24">
            <div id="reader-top" class="fixed top-0 w-full bg-gradient-to-b from-black/90 to-transparent z-[60] p-4 flex justify-between items-center transition-transform duration-300">
                <button onclick="${comicSlug ? `showDetail('${comicSlug}')` : `showHome()`}" class="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-amber-500 hover:text-black transition"><i class="fa fa-arrow-left"></i></button>
                <h2 class="text-xs font-bold truncate max-w-[200px] shadow-black drop-shadow-md">${res.title || chSlug}</h2>
                <button onclick="toggleFullScreen()" class="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center"><i class="fa fa-expand"></i></button>
            </div>

            <div id="reader-images" class="flex flex-col items-center min-h-screen w-full max-w-3xl mx-auto bg-[#111]" onclick="toggleReaderUI()"></div>

            <div id="reader-bottom" class="fixed bottom-6 left-0 w-full z-[60] px-4 flex justify-center pointer-events-none transition-transform duration-300">
                <div class="glass p-2 rounded-2xl flex gap-2 items-center shadow-2xl pointer-events-auto bg-black/80 backdrop-blur-xl">
                    <button onclick="${res.navigation.prev ? `readChapter('${res.navigation.prev}', '${comicSlug}')` : ''}" class="w-10 h-10 rounded-xl flex items-center justify-center ${!res.navigation.prev ? 'opacity-30' : 'hover:bg-amber-500 hover:text-black transition'}"><i class="fa fa-chevron-left"></i></button>
                    ${dropdownHTML}
                    <button onclick="${res.navigation.next ? `readChapter('${res.navigation.next}', '${comicSlug}')` : ''}" class="w-10 h-10 rounded-xl amber-gradient text-black flex items-center justify-center ${!res.navigation.next ? 'opacity-30' : 'hover:scale-105 transition'}"><i class="fa fa-chevron-right"></i></button>
                </div>
            </div>
        </div>
    `;

    const imgContainer = document.getElementById('reader-images');
    res.images.forEach(url => {
        const wrap = document.createElement('div');
        wrap.className = "w-full relative min-h-[300px] bg-[#1a1a1a]";
        
        const skel = document.createElement('div');
        skel.className = "skeleton absolute inset-0 z-10";
        
        const img = new Image();
        img.src = url;
        img.className = "comic-page opacity-0 transition-opacity duration-500 relative z-20";
        img.loading = "lazy";
        
        img.onload = () => { skel.remove(); img.classList.remove('opacity-0'); wrap.style.minHeight = 'auto'; };
        img.onerror = () => { skel.remove(); wrap.innerHTML = `<div class="py-10 text-center text-xs text-gray-500 flex flex-col items-center gap-2"><i class="fa fa-triangle-exclamation text-red-500 text-xl"></i> Gagal Load <button onclick="this.parentElement.parentElement.querySelector('img').src='${url}'" class="bg-white/10 px-3 py-1 rounded">Reload</button></div>`; wrap.appendChild(img); };

        wrap.appendChild(skel);
        wrap.appendChild(img);
        imgContainer.appendChild(wrap);
    });
    
    if(comicSlug) saveHistory(comicSlug, null, null, chSlug, res.title);
    window.scrollTo(0,0);
}

function toggleReaderUI() {
    document.getElementById('reader-top').classList.toggle('ui-hidden-top');
    document.getElementById('reader-bottom').classList.toggle('ui-hidden-bottom');
}

// --- History & Bookmarks ---
function handleSearch(e) { if(e.key === 'Enter') applyAdvancedFilter(); }
function saveHistory(slug, title, image, chSlug, chTitle) {
    let h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    h = h.filter(x => x.slug !== slug);
    h.unshift({ slug, title, image, lastChapterSlug: chSlug, lastChapterTitle: chTitle });
    if(h.length > 50) h.pop();
    localStorage.setItem('fmc_history', JSON.stringify(h));
}
function showHistory() {
    updateURL('/history'); resetNavs();
    renderGrid({ data: JSON.parse(localStorage.getItem('fmc_history')||'[]') }, "Riwayat Baca", null);
}
function toggleBookmark(slug, title, image) {
    let b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const i = b.findIndex(x => x.slug === slug);
    if(i > -1) b.splice(i, 1); else b.push({ slug, title, image });
    localStorage.setItem('fmc_bookmarks', JSON.stringify(b));
    checkBookmarkStatus(slug);
}
function checkBookmarkStatus(slug) {
    const btn = document.getElementById('btn-bookmark');
    if(!btn) return;
    const exists = JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]').some(x => x.slug === slug);
    btn.innerHTML = exists ? `<i class="fa fa-check text-amber-500"></i> Tersimpan` : `<i class="fa fa-bookmark"></i> Simpan`;
    if(exists) { btn.classList.add('border-amber-500/50', 'bg-amber-500/10'); btn.classList.remove('glass'); }
    else { btn.classList.remove('border-amber-500/50', 'bg-amber-500/10'); btn.classList.add('glass'); }
}
function showBookmarks() {
    updateURL('/bookmarks'); resetNavs();
    renderGrid({ data: JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]') }, "Koleksi Favorit", null);
}

// --- Init ---
async function handleInitialLoad() {
    const p = window.location.pathname;
    resetNavs();
    if(p === '/404.html') return;
    if(p.startsWith('/series/')) showDetail(p.split('/')[2], false);
    else if(p.startsWith('/chapter/')) readChapter(p.split('/')[2], null, false);
    else if(p === '/ongoing') showOngoing(1);
    else if(p === '/completed') showCompleted(1);
    else if(p === '/history') showHistory();
    else if(p === '/bookmarks') showBookmarks();
    else showHome(false);
}

window.addEventListener('popstate', handleInitialLoad);
document.addEventListener('DOMContentLoaded', () => { loadGenres(); handleInitialLoad(); });
