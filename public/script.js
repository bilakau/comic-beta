/*
  FmcComic Ultra v2.1 - OPTIMIZED VERSION
  Fitur Perbaikan: Parallel Loading, Advanced Caching, Image Lazy Load
*/

const API_PROXY = "https://rynekoo-api.hf.space/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

// ===============================
// OPTIMASI #1: Advanced State & Cache Management
// ===============================
let appState = {
    isNavigating: false,
    currentChapterList: [],
    comicData: null,
    settings: JSON.parse(localStorage.getItem('fmc_settings') || '{"fitMode": "contain", "brightness": 100}'),
    debounceTimer: null,
    requestQueue: new Map() // Request deduplication
};

// Cache dengan TTL
const API_CACHE = {
    data: new Map(),
    TTL: 10 * 60 * 1000, // 10 menit
    
    set(key, value) {
        this.data.set(key, {
            value,
            expiry: Date.now() + this.TTL
        });
    },
    
    get(key) {
        const item = this.data.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.data.delete(key);
            return null;
        }
        
        return item.value;
    },
    
    clear() {
        this.data.clear();
    }
};

// Elements
const dom = {
    content: document.getElementById('content-area'),
    progressBar: document.getElementById('progress-bar'),
    filterPanel: document.getElementById('filter-panel'),
    toastContainer: document.getElementById('toast-container'),
    navs: {
        main: document.getElementById('main-nav'),
        mobile: document.getElementById('mobile-nav')
    },
    overlay: document.getElementById('brightness-overlay')
};

/* --- SYSTEM --- */

// Initializer
document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    applySettings();
    handleRouting();
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#filter-panel') && !e.target.closest('[onclick="toggleFilter()"]')) {
            dom.filterPanel.classList.add('hidden');
        }
    });
});

window.addEventListener('popstate', handleRouting);

// Global Scroll Logic
window.onscroll = () => {
    const scrollBtn = document.getElementById('scroll-top');
    const scrolled = window.scrollY;
    
    if (scrolled > 400) {
        scrollBtn?.classList.remove('opacity-0', 'translate-y-24');
        scrollBtn?.classList.add('translate-y-0', 'opacity-100');
    } else {
        scrollBtn?.classList.add('opacity-0', 'translate-y-24');
        scrollBtn?.classList.remove('translate-y-0', 'opacity-100');
    }

    if(scrolled > 50) dom.navs.main.classList.add('shadow-xl', 'bg-[#0a0a0c]/95');
    else dom.navs.main.classList.remove('shadow-xl', 'bg-[#0a0a0c]/95');
};

/* --- HELPER --- */

function setSEO(title) {
    document.title = title ? `${title} - FmcComic` : 'FmcComic - Baca Komik Gratis Tanpa Iklan';
}

function updateURL(path) {
    if (window.location.pathname !== path) history.pushState(null, null, path);
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    const color = type === 'error' ? 'bg-red-500' : (type === 'success' ? 'bg-green-500' : 'bg-blue-600');
    const icon = type === 'error' ? 'fa-triangle-exclamation' : (type === 'success' ? 'fa-check' : 'fa-info');
    
    toast.className = "flex items-center gap-3 bg-[#1e1e24] border border-white/5 shadow-2xl rounded-xl p-4 min-w-[300px] animate-fade-in backdrop-blur-md transform transition-all hover:scale-[1.02] cursor-pointer pointer-events-auto";
    toast.onclick = () => toast.remove();
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0 text-white shadow-lg"><i class="fa ${icon}"></i></div>
        <p class="text-sm font-medium text-white/90">${msg}</p>
    `;
    
    dom.toastContainer.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

// ===============================
// OPTIMASI #2: API dengan Cache & Retry Logic
// ===============================
async function api(endpoint, useCache = true) {
    const cacheKey = `api:${endpoint}`;
    
    // Cek cache dulu
    if (useCache) {
        const cached = API_CACHE.get(cacheKey);
        if (cached) {
            console.log('📦 Cache hit:', endpoint);
            return cached;
        }
    }
    
    // Request deduplication - kalau sudah ada request yang sama, tunggu saja
    if (appState.requestQueue.has(cacheKey)) {
        console.log('⏳ Waiting for existing request:', endpoint);
        return appState.requestQueue.get(cacheKey);
    }
    
    // Buat request baru
    const requestPromise = (async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
            
            const res = await fetch(
                API_PROXY + encodeURIComponent(`${API_BASE}${endpoint}`),
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const json = await res.json();
            const data = json.success ? (json.result?.content || json.result || json.data) : null;
            
            if (data && useCache) {
                API_CACHE.set(cacheKey, data);
            }
            
            return data;
            
        } catch (err) {
            console.error('API Error:', endpoint, err.message);
            
            if (err.name === 'AbortError') {
                showToast('Koneksi timeout, coba lagi', 'error');
            } else {
                showToast('Gagal memuat data', 'error');
            }
            
            return null;
        } finally {
            appState.requestQueue.delete(cacheKey);
        }
    })();
    
    appState.requestQueue.set(cacheKey, requestPromise);
    return requestPromise;
}

// ===============================
// OPTIMASI #3: UUID dengan Fallback & Parallel Request
// ===============================
async function getUuid(slug, type) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout untuk UUID
        
        const res = await fetch(`${BACKEND_URL}/api/get-id`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({slug, type}),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) return slug; // Fallback ke slug
        
        const data = await res.json();
        return data.uuid || slug;
        
    } catch (err) {
        console.warn('UUID fetch failed, using slug:', err.message);
        return slug; // Fallback
    }
}

async function getSlug(uuid) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`${BACKEND_URL}/api/get-slug/${uuid}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) return { slug: uuid, type: 'series' };
        
        return await res.json();
    } catch {
        return { slug: uuid, type: 'series' };
    }
}

/* --- RENDERER PAGES --- */

function renderLoading() {
    dom.content.innerHTML = `
        <div class="container mx-auto px-4 py-20 min-h-[60vh] flex flex-col items-center justify-center gap-6">
            <div class="relative w-16 h-16">
                <div class="absolute inset-0 border-4 border-amber-500/30 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-t-amber-500 border-l-transparent border-r-transparent border-b-transparent rounded-full animate-spin"></div>
            </div>
            <p class="text-gray-500 text-sm font-medium animate-pulse">Memuat konten...</p>
        </div>
    `;
}

async function handleRouting() {
    const path = window.location.pathname;
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('text-amber-500', 'active'));
    
    if (path.startsWith('/chapter')) {
        const id = path.split('/')[2];
        readChapter(id, null, false);
    } 
    else if (path.startsWith('/series')) {
        const id = path.split('/')[2];
        showDetail(id, false);
    }
    else {
        dom.navs.main.classList.remove('-translate-y-full');
        dom.navs.mobile.classList.remove('translate-y-full');
        
        if (path === '/ongoing') showOngoing(1, false);
        else if (path === '/completed') showCompleted(1, false);
        else if (path === '/history') showHistory();
        else if (path === '/bookmarks') showBookmarks();
        else showHome(false);
    }
}

/* --- PAGE: HOME --- */

async function showHome(push = true) {
    if (push) updateURL('/');
    renderLoading();
    setSEO();
    
    const data = await api('/home');
    if (!data) {
        dom.content.innerHTML = `<div class="text-center py-20 text-gray-500">Gagal memuat home. <button onclick="showHome()" class="text-amber-500 underline ml-2">Coba lagi</button></div>`;
        return;
    }

    const heroSlides = data.hotUpdates.slice(0, 6);
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');

    let html = `
    <!-- HERO SLIDER -->
    <div class="swiper mySwiper w-full h-[55vh] md:h-[65vh] relative group bg-black">
        <div class="swiper-wrapper">
            ${heroSlides.map(slide => `
                <div class="swiper-slide relative w-full h-full cursor-pointer" onclick="showDetail('${slide.slug}')">
                    <img src="${slide.image}" loading="lazy" class="absolute inset-0 w-full h-full object-cover opacity-60">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 w-full p-6 md:p-12 z-20 flex flex-col justify-end h-full">
                        <div class="container mx-auto">
                            <span class="inline-block px-3 py-1 rounded-md bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest mb-3">
                                ${slide.type || 'TRENDING'}
                            </span>
                            <h2 class="text-2xl md:text-5xl font-black text-white leading-tight mb-2 md:max-w-2xl line-clamp-2">
                                ${slide.title}
                            </h2>
                            <p class="text-gray-300 text-sm mb-4 flex items-center gap-2">
                                <span class="bg-white/10 px-2 py-1 rounded border border-white/10 text-amber-400">
                                    <i class="fa fa-book-open mr-1"></i> ${slide.chapter || slide.latestChapter}
                                </span>
                            </p>
                            <button class="bg-white text-black px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-amber-500 transition">
                                <i class="fa fa-play"></i> Baca Sekarang
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="swiper-pagination !bottom-6 md:!bottom-10 md:!left-12 container mx-auto"></div>
    </div>

    <div class="container mx-auto px-4 -mt-10 relative z-30 pb-20">
    `;

    // History Strip
    if (history.length > 0) {
        html += `
        <div class="mb-10">
            <h3 class="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
               <i class="fa fa-clock-rotate-left text-amber-500"></i> Lanjutkan Baca
            </h3>
            <div class="flex overflow-x-auto gap-4 hide-scroll pb-2">
                ${history.slice(0,8).map(h => `
                    <div onclick="readChapter('${h.lastChapterSlug}', '${h.slug}')" 
                        class="min-w-[200px] bg-[#1a1a1d] p-3 rounded-xl flex gap-3 cursor-pointer hover:bg-[#25252b] border border-white/5 hover:border-amber-500/30 transition group">
                        <img src="${h.image}" loading="lazy" class="w-12 h-16 rounded object-cover shadow bg-gray-800">
                        <div class="flex flex-col justify-center min-w-0">
                            <h4 class="text-xs font-bold text-white truncate mb-1 group-hover:text-amber-500">${h.title}</h4>
                            <span class="text-[10px] text-gray-400 bg-black/30 w-max px-2 py-0.5 rounded">${h.lastChapterTitle || 'Lanjut'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // Latest Grid
    html += `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-white border-l-4 border-amber-500 pl-4">Rilis Terbaru</h2>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 gap-y-8">
            ${data.latestReleases.map(item => cardTemplate(item)).join('')}
        </div>
        
        <div class="mt-8 flex justify-center">
             <button onclick="showOngoing()" class="px-8 py-3 rounded-full border border-white/10 hover:bg-amber-500 hover:text-black transition font-bold text-sm">
                Lihat Semua Update
             </button>
        </div>
    </div>`;

    dom.content.innerHTML = html;

    // Initialize Swiper
    new Swiper(".mySwiper", {
        loop: true,
        effect: "fade",
        autoplay: { delay: 4000, disableOnInteraction: false },
        pagination: { el: ".swiper-pagination", clickable: true },
        allowTouchMove: true
    });
}

/* --- COMPONENTS: CARD --- */
function cardTemplate(item) {
    const ch = item.chapters?.[0]?.title || item.latestChapter || 'Unknown';
    const type = (item.type || '').toLowerCase();
    
    let typeClass = 'border-gray-600 bg-gray-600/20 text-gray-300';
    if(type.includes('manga')) typeClass = 'type-manga';
    else if(type.includes('manhwa')) typeClass = 'type-manhwa';
    else if(type.includes('manhua')) typeClass = 'type-manhua';

    return `
    <div class="group relative cursor-pointer" onclick="showDetail('${item.slug}')">
        <div class="relative rounded-2xl overflow-hidden aspect-[2/3] mb-3 border border-white/10">
            <span class="type-badge absolute top-2 right-2 z-10 ${typeClass}">${item.type || 'UP'}</span>
            <div class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/90 to-transparent z-10"></div>
            
            <img src="${item.image}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
            
            <div class="absolute bottom-3 left-3 z-20">
                 <div class="text-[10px] bg-amber-500 text-black font-extrabold px-2 py-1 rounded w-max shadow-lg">
                    ${ch}
                 </div>
            </div>
        </div>
        <h3 class="font-bold text-sm text-gray-200 line-clamp-2 leading-tight group-hover:text-amber-500 transition">${item.title}</h3>
    </div>`;
}

/* --- LIST PAGES --- */

async function showOngoing(page=1, push=true) {
    if(push) updateURL('/ongoing');
    genericListLoad(`/list?status=Ongoing&orderby=popular&page=${page}`, `Komik Ongoing - Hal ${page}`, 'showOngoing', page);
}

async function showCompleted(page=1, push=true) {
    if(push) updateURL('/completed');
    genericListLoad(`/list?status=Completed&orderby=popular&page=${page}`, `Komik Tamat - Hal ${page}`, 'showCompleted', page);
}

async function applyAdvancedFilter() {
    const q = document.getElementById('search-input').value.trim();
    const g = document.getElementById('filter-genre').value;
    dom.filterPanel.classList.add('hidden');
    
    if(q) {
        genericListLoad(`/search/${encodeURIComponent(q)}/1`, `Pencarian: "${q}"`, null);
    } else {
        const type = document.getElementById('filter-type').value;
        const status = document.getElementById('filter-status').value;
        let url = `/list?orderby=popular&page=1`;
        if(type) url += `&type=${type}`;
        if(status) url += `&status=${status}`;
        if(g) { showGenre(g); return; }
        
        genericListLoad(url, 'Hasil Filter', null);
    }
}

async function genericListLoad(endpoint, titleStr, funcName, currentPage=1) {
    renderLoading();
    setSEO(titleStr);
    
    const data = await api(endpoint);
    
    if(!data || !data.data || data.data.length === 0) {
        dom.content.innerHTML = `
            <div class="h-screen flex flex-col items-center justify-center text-gray-500">
                <i class="fa fa-ghost text-4xl mb-4"></i>
                <p>Tidak ada hasil.</p>
                <button onclick="showHome()" class="mt-4 text-amber-500 font-bold underline">Kembali ke Home</button>
            </div>`;
        return;
    }

    const items = data.data;
    const pagination = data.pagination || {};

    let navHtml = '';
    if (funcName && pagination) {
        navHtml = `
        <div class="col-span-full flex justify-center gap-4 py-8">
            ${currentPage > 1 ? `<button onclick="${funcName}(${currentPage - 1})" class="bg-white/10 px-6 py-2 rounded-xl hover:bg-amber-500 hover:text-black font-bold text-sm transition">◀ Prev</button>` : ''}
            <span class="px-4 py-2 text-gray-500 font-mono">Page ${currentPage}</span>
            ${pagination.hasNextPage ? `<button onclick="${funcName}(${currentPage + 1})" class="bg-white/10 px-6 py-2 rounded-xl hover:bg-amber-500 hover:text-black font-bold text-sm transition">Next ▶</button>` : ''}
        </div>`;
    }

    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-3">
           <span class="w-1 h-8 bg-amber-500 rounded-full"></span> ${titleStr}
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 gap-y-8 animate-fade-in">
            ${items.map(item => cardTemplate(item)).join('')}
        </div>
        ${navHtml}
    </div>`;
}

async function showBookmarks(push=true) {
    if(push) updateURL('/bookmarks');
    const b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    setSEO("Bookmarks");
    
    if(b.length === 0) {
        dom.content.innerHTML = `
        <div class="h-[70vh] flex flex-col items-center justify-center gap-4 text-gray-500">
            <i class="fa fa-bookmark text-6xl text-amber-900/50"></i>
            <p>Belum ada bookmark.</p>
            <button onclick="showHome()" class="text-amber-500 font-bold hover:underline">Cari komik dulu</button>
        </div>`;
        return;
    }
    
    const formatted = b.map(x => ({
        slug: x.slug, title: x.title, image: x.image, 
        type: 'Disimpan', latestChapter: 'Akses Cepat'
    }));
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-3">
            <span class="w-1 h-8 bg-amber-500 rounded-full"></span> Koleksi Favorit (${formatted.length})
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 animate-fade-in">
            ${formatted.map(item => cardTemplate(item)).join('')}
        </div>
    </div>`;
}

async function showHistory(push=true) {
    if(push) updateURL('/history');
    setSEO("Riwayat");
    const h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    
    if(h.length === 0) {
        dom.content.innerHTML = '<div class="h-[70vh] flex justify-center items-center text-gray-500">Kosong.</div>';
        return;
    }
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold border-l-4 border-amber-500 pl-3">Riwayat Baca</h2>
            <button onclick="if(confirm('Hapus semua riwayat?')){localStorage.removeItem('fmc_history');showHistory()}" 
                class="text-xs text-red-400 border border-red-500/30 px-3 py-1 rounded-lg hover:bg-red-500 hover:text-white transition">
                Hapus Data
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${h.map(item => `
                <div class="flex gap-4 p-4 bg-[#1a1a1d] rounded-2xl border border-white/5 cursor-pointer hover:border-amber-500/30 transition group" 
                    onclick="readChapter('${item.lastChapterSlug}', '${item.slug}')">
                    <img src="${item.image}" loading="lazy" class="w-20 h-28 object-cover rounded-xl shadow-lg">
                    <div class="flex-1 flex flex-col justify-center min-w-0">
                        <h3 class="font-bold text-white mb-2 truncate group-hover:text-amber-500">${item.title}</h3>
                        <div class="flex flex-col gap-2">
                             <div class="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Terakhir dibaca:</div>
                             <div class="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg text-xs font-bold w-max">
                                ${item.lastChapterTitle || 'Lanjut'}
                             </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

/* --- DETAIL PAGE --- */

async function showDetail(idOrSlug, push=true) {
    let slug = idOrSlug;
    
    // Jika UUID (36 karakter), convert ke slug
    if (slug.length === 36) {
        const m = await getSlug(slug);
        if(m && m.slug) slug = m.slug;
    }
    
    renderLoading();
    
    // === OPTIMASI: Parallel request untuk UUID dan data detail ===
    const [uuid, data] = await Promise.all([
        getUuid(slug, 'series'),
        api(`/detail/${slug}`)
    ]);
    
    if (push) updateURL(`/series/${uuid}`);
    
    if (!data) {
        dom.content.innerHTML = `
            <div class="h-screen flex flex-col items-center justify-center text-gray-500">
                <i class="fa fa-exclamation-triangle text-4xl mb-4"></i>
                <p>Komik tidak ditemukan</p>
                <button onclick="showHome()" class="mt-4 text-amber-500 font-bold underline">Kembali</button>
            </div>`;
        return;
    }

    const info = data;
    appState.comicData = info;
    appState.currentChapterList = info.chapters;
    setSEO(info.title);

    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const saved = history.find(h => h.slug === slug);
    
    const btnText = saved ? "Lanjut Baca" : "Mulai Baca";
    const btnSlug = saved ? saved.lastChapterSlug : (info.chapters.length > 0 ? info.chapters[info.chapters.length - 1].slug : null);
    
    const bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const isBookmarked = bookmarks.some(b => b.slug === slug);

    dom.content.innerHTML = `
    <!-- Header BG -->
    <div class="relative h-[50vh] overflow-hidden">
        <div class="absolute inset-0 bg-[#0a0a0c]"></div>
        <img src="${info.image}" loading="lazy" class="w-full h-full object-cover opacity-20 blur-3xl scale-110">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent"></div>
    </div>

    <div class="container mx-auto px-4 -mt-64 relative z-10 pb-20">
        <div class="flex flex-col md:flex-row gap-10">
            <!-- Cover -->
            <div class="w-[200px] md:w-[280px] shrink-0 mx-auto md:mx-0 flex flex-col gap-4">
                <img src="${info.image}" loading="lazy" class="w-full rounded-xl shadow-2xl border-4 border-white/5 object-cover aspect-[2/3]">
                
                ${btnSlug ? `
                <button onclick="readChapter('${btnSlug}', '${slug}')" 
                    class="w-full bg-amber-500 hover:bg-amber-400 text-black py-3.5 rounded-xl font-bold shadow-lg hover:scale-[1.02] transition flex justify-center gap-2 items-center">
                    <i class="fa fa-book-open"></i> ${btnText}
                </button>` : ''}
                
                <button id="btn-bookmark" onclick="toggleBookmark('${slug}', '${info.title}', '${info.image}')" 
                    class="w-full py-3 rounded-xl font-bold border ${isBookmarked ? 'bg-amber-500 text-black border-amber-500' : 'border-white/10 text-gray-300 hover:border-amber-500'} transition">
                    <i class="fa fa-bookmark mr-2"></i> ${isBookmarked ? 'Tersimpan' : 'Simpan'}
                </button>
            </div>

            <!-- Info -->
            <div class="flex-1 space-y-6">
                <div>
                    <h1 class="text-3xl md:text-4xl font-black text-white mb-3">${info.title}</h1>
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${info.type ? `<span class="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">${info.type}</span>` : ''}
                        ${info.status ? `<span class="px-3 py-1 rounded-lg text-xs font-bold ${info.status === 'Ongoing' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'} border">${info.status}</span>` : ''}
                    </div>
                </div>

                ${info.synopsis ? `
                <div class="bg-[#1a1a1d] p-6 rounded-2xl border border-white/5">
                    <h3 class="text-sm font-bold text-amber-500 mb-3 uppercase tracking-wider">Sinopsis</h3>
                    <p class="text-gray-300 text-sm leading-relaxed">${info.synopsis}</p>
                </div>` : ''}

                ${info.genres && info.genres.length > 0 ? `
                <div>
                    <h3 class="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Genre</h3>
                    <div class="flex flex-wrap gap-2">
                        ${info.genres.map(g => `
                            <button onclick="showGenre('${g.slug || g}')" 
                                class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500 hover:text-amber-500 text-xs font-semibold transition">
                                ${g.name || g}
                            </button>
                        `).join('')}
                    </div>
                </div>` : ''}

                <!-- Chapter List -->
                <div>
                    <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i class="fa fa-list text-amber-500"></i> Daftar Chapter (${info.chapters.length})
                    </h3>
                    <div class="max-h-[500px] overflow-y-auto space-y-2 pr-2 hide-scroll">
                        ${info.chapters.map(ch => `
                            <button onclick="readChapter('${ch.slug}', '${slug}')" 
                                class="w-full p-4 rounded-xl bg-[#1a1a1d] border border-white/5 hover:border-amber-500 hover:bg-[#25252b] transition text-left group flex justify-between items-center">
                                <span class="font-semibold text-white group-hover:text-amber-500 transition">${ch.title}</span>
                                <i class="fa fa-chevron-right text-gray-600 group-hover:text-amber-500 transition"></i>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

/* --- READER PAGE --- */

async function readChapter(chIdOrSlug, comicSlug = null, push = true) {
    let chSlug = chIdOrSlug;
    
    // Convert UUID ke slug jika perlu
    if (chSlug.length === 36) {
        const m = await getSlug(chSlug);
        if(m && m.slug) chSlug = m.slug;
    }
    
    renderLoading();
    
    // Hide navbar untuk reader mode
    dom.navs.main.classList.add('-translate-y-full');
    dom.navs.mobile.classList.add('translate-y-full');
    
    // === OPTIMASI: Parallel request ===
    const [uuid, data] = await Promise.all([
        getUuid(chSlug, 'chapter'),
        api(`/chapter/${chSlug}`, false) // Jangan cache chapter (selalu fresh)
    ]);
    
    if (push) updateURL(`/chapter/${uuid}`);
    
    if (!data || !data.images || data.images.length === 0) {
        dom.content.innerHTML = `
            <div class="h-screen flex flex-col items-center justify-center text-gray-500">
                <i class="fa fa-exclamation-triangle text-4xl mb-4"></i>
                <p>Chapter tidak ditemukan atau kosong</p>
                ${comicSlug ? `<button onclick="showDetail('${comicSlug}')" class="mt-4 text-amber-500 font-bold underline">Kembali</button>` : ''}
            </div>`;
        return;
    }

    const chapter = data;
    setSEO(chapter.title);

    // Save history
    if (chapter.comicSlug || comicSlug) {
        saveReaderHistory(chapter.comicSlug || comicSlug, chapter.title, chSlug, chapter.comicTitle, chapter.comicImage);
    }

    // Render reader UI
    const prevBtn = chapter.prevSlug ? `<button onclick="readChapter('${chapter.prevSlug}', '${chapter.comicSlug}')" class="px-6 py-3 bg-white/10 hover:bg-amber-500 hover:text-black rounded-xl font-bold transition flex items-center gap-2"><i class="fa fa-chevron-left"></i> Prev</button>` : '';
    const nextBtn = chapter.nextSlug ? `<button onclick="readChapter('${chapter.nextSlug}', '${chapter.comicSlug}')" class="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold transition flex items-center gap-2">Next <i class="fa fa-chevron-right"></i></button>` : '';

    dom.content.innerHTML = `
    <!-- Reader Header -->
    <div id="reader-header" class="fixed top-0 left-0 w-full bg-[#0a0a0c]/95 backdrop-blur-xl border-b border-white/10 z-50 transition-all duration-300">
        <div class="container mx-auto px-4 py-4 flex items-center justify-between">
            <button onclick="${chapter.comicSlug ? `showDetail('${chapter.comicSlug}')` : 'history.back()'}" 
                class="text-gray-300 hover:text-white flex items-center gap-2 font-semibold transition">
                <i class="fa fa-arrow-left"></i> <span class="hidden md:inline">Kembali</span>
            </button>
            <div class="flex-1 mx-4 text-center min-w-0">
                <h1 class="font-bold text-white truncate text-sm md:text-base">${chapter.title}</h1>
                <p class="text-xs text-gray-500 truncate">${chapter.comicTitle || ''}</p>
            </div>
            <button onclick="toggleReaderSettings()" class="text-gray-300 hover:text-amber-500 transition">
                <i class="fa fa-gear text-xl"></i>
            </button>
        </div>
    </div>

    <!-- Reader Content -->
    <div class="pt-24 pb-32 min-h-screen bg-black">
        <div id="reader-container" class="reader-max-width mx-auto">
            ${chapter.images.map((img, idx) => `
                <img src="${img}" 
                     alt="Page ${idx + 1}" 
                     loading="${idx < 3 ? 'eager' : 'lazy'}"
                     class="comic-page mb-1 w-full h-auto" 
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'1200\'%3E%3Crect fill=\'%231a1a1d\' width=\'800\' height=\'1200\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'20\' font-family=\'Arial\'%3EGagal memuat gambar%3C/text%3E%3C/svg%3E'" />
            `).join('')}
        </div>
    </div>

    <!-- Reader Footer Nav -->
    <div id="reader-footer" class="fixed bottom-0 left-0 w-full bg-[#0a0a0c]/95 backdrop-blur-xl border-t border-white/10 z-50 transition-all duration-300">
        <div class="container mx-auto px-4 py-4 flex justify-between items-center gap-4">
            ${prevBtn}
            <span class="text-sm text-gray-500 font-mono flex-1 text-center">${chapter.images.length} Halaman</span>
            ${nextBtn}
        </div>
    </div>
    `;

    // Auto-hide UI on scroll
    let scrollTimeout;
    window.onscroll = () => {
        const header = document.getElementById('reader-header');
        const footer = document.getElementById('reader-footer');
        
        header?.classList.add('ui-hidden-top');
        footer?.classList.add('ui-hidden-bottom');
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            header?.classList.remove('ui-hidden-top');
            footer?.classList.remove('ui-hidden-bottom');
        }, 150);
    };
}

function saveReaderHistory(slug, chapterTitle, chapterSlug, comicTitle, comicImage) {
    let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    
    // Hapus duplikat
    history = history.filter(h => h.slug !== slug);
    
    // Tambahkan di depan
    history.unshift({
        slug,
        title: comicTitle,
        image: comicImage,
        lastChapterSlug: chapterSlug,
        lastChapterTitle: chapterTitle,
        timestamp: Date.now()
    });
    
    // Limit 50 riwayat
    if (history.length > 50) history = history.slice(0, 50);
    
    localStorage.setItem('fmc_history', JSON.stringify(history));
}

/* --- BOOKMARKS --- */

function toggleBookmark(slug, title, image) {
    let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const exists = bookmarks.findIndex(b => b.slug === slug);
    
    if (exists >= 0) {
        bookmarks.splice(exists, 1);
        showToast('Dihapus dari bookmark', 'info');
    } else {
        bookmarks.unshift({ slug, title, image, timestamp: Date.now() });
        showToast('Ditambahkan ke bookmark', 'success');
    }
    
    localStorage.setItem('fmc_bookmarks', JSON.stringify(bookmarks));
    
    // Update button
    const btn = document.getElementById('btn-bookmark');
    if (btn) {
        const isBookmarked = exists < 0;
        btn.className = `w-full py-3 rounded-xl font-bold border ${isBookmarked ? 'bg-amber-500 text-black border-amber-500' : 'border-white/10 text-gray-300 hover:border-amber-500'} transition`;
        btn.innerHTML = `<i class="fa fa-bookmark mr-2"></i> ${isBookmarked ? 'Tersimpan' : 'Simpan'}`;
    }
}

/* --- GENRES --- */

async function loadGenres() {
    const data = await api('/genres');
    if (!data || !data.genres) return;
    
    const select = document.getElementById('filter-genre');
    if (!select) return;
    
    select.innerHTML = '<option value="">Semua Genre</option>' + 
        data.genres.map(g => `<option value="${g.slug}">${g.name}</option>`).join('');
}

async function showGenre(slug) {
    genericListLoad(`/genre/${slug}/1`, `Genre: ${slug}`, null);
}

/* --- SEARCH --- */

function handleSearchInput(e) {
    clearTimeout(appState.debounceTimer);
    
    const query = e.target.value.trim();
    if (query.length < 2) return;
    
    appState.debounceTimer = setTimeout(() => {
        // Auto-search on typing (optional, bisa di-disable)
        // applyAdvancedFilter();
    }, 800);
}

/* --- SETTINGS --- */

function toggleFilter() {
    dom.filterPanel.classList.toggle('hidden');
}

function toggleReaderSettings() {
    const panel = document.getElementById('reader-settings');
    if (!panel) return;
    
    panel.classList.toggle('hidden');
    
    if (!panel.classList.contains('hidden')) {
        setTimeout(() => {
            panel.style.transform = 'scale(1)';
            panel.style.opacity = '1';
        }, 10);
    } else {
        panel.style.transform = 'scale(0.9)';
        panel.style.opacity = '0';
    }
}

function toggleImageFit() {
    const container = document.getElementById('reader-container');
    const btn = document.getElementById('btn-fit-toggle');
    if (!container || !btn) return;
    
    if (container.classList.contains('reader-max-width')) {
        container.classList.remove('reader-max-width');
        container.classList.add('reader-full-width');
        btn.textContent = 'Full Width';
        appState.settings.fitMode = 'cover';
    } else {
        container.classList.add('reader-max-width');
        container.classList.remove('reader-full-width');
        btn.textContent = 'Fit Width';
        appState.settings.fitMode = 'contain';
    }
    
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
}

function changeBrightness(val) {
    document.getElementById('bright-val').textContent = val + '%';
    const overlay = dom.overlay;
    const opacity = (100 - val) / 100;
    overlay.style.opacity = opacity;
    
    appState.settings.brightness = val;
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
}

function applySettings() {
    const s = appState.settings;
    
    // Apply brightness
    if (s.brightness) {
        const slider = document.getElementById('brightness-slider');
        if (slider) slider.value = s.brightness;
        changeBrightness(s.brightness);
    }
}

console.log('🚀 FmcComic v2.1 - Optimized & Ready!');
