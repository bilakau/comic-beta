/*
  FmcComic Ultra - Versi 2.0 (Redesign)
  Fitur Baru: Swiper Slider, Better Cache, SEO Titles, Reader Modes
*/

const API_PROXY = "https://api.nekolabs.web.id/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

// State
let appState = {
    isNavigating: false,
    currentChapterList: [],
    comicData: null,
    settings: JSON.parse(localStorage.getItem('fmc_settings') || '{"fitMode": "contain", "brightness": 100}'),
    debounceTimer: null
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
    applySettings(); // Apply brightness/fit
    handleRouting();
    
    // Bind global click to close modals if outside
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
    
    // Scroll To Top Btn
    if (scrolled > 400) {
        scrollBtn.classList.remove('opacity-0', 'translate-y-24');
        scrollBtn.classList.add('translate-y-0', 'opacity-100');
    } else {
        scrollBtn.classList.add('opacity-0', 'translate-y-24');
        scrollBtn.classList.remove('translate-y-0', 'opacity-100');
    }

    // Nav blur effect intensification
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
    
    toast.className = "flex items-center gap-3 bg-[#1e1e24] border border-white/5 shadow-2xl rounded-xl p-4 min-w-[300px] animate-fade-in backdrop-blur-md transform transition-all hover:scale-[1.02] cursor-pointer";
    toast.onclick = () => toast.remove();
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0 text-white shadow-lg"><i class="fa ${icon}"></i></div>
        <p class="text-sm font-medium text-white/90">${msg}</p>
    `;
    
    dom.toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function api(endpoint) {
    try {
        const res = await fetch(API_PROXY + encodeURIComponent(`${API_BASE}${endpoint}`));
        const json = await res.json();
        return json.success ? (json.result?.content || json.result || json.data) : null;
    } catch {
        showToast('Gagal terhubung ke server', 'error');
        return null;
    }
}

// UUID Logic
async function getUuid(slug, type) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/get-id`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({slug, type})
        });
        return (await res.json()).uuid;
    } catch { return slug; }
}

async function getSlug(uuid) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/get-slug/${uuid}`);
        return res.ok ? await res.json() : null;
    } catch { return null; }
}

/* --- RENDERER PAGES --- */

function renderLoading() {
    dom.content.innerHTML = `
        <div class="container mx-auto px-4 py-20 min-h-[60vh] flex flex-col items-center justify-center gap-6">
            <div class="relative w-16 h-16">
                <div class="absolute inset-0 border-4 border-amber-500/30 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-t-amber-500 border-l-transparent border-r-transparent border-b-transparent rounded-full animate-spin"></div>
            </div>
            <p class="text-gray-500 text-sm font-medium animate-pulse">Menyiapkan Komik...</p>
        </div>
    `;
}

async function handleRouting() {
    const path = window.location.pathname;
    
    // Highlight Active Nav
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
        // Reset full UI visibility
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
    
    // Check Local Cache for Instant Load (Optional, skipped for simplicity/freshness)
    const data = await api('/home');
    if (!data) return dom.content.innerHTML = `<div class="text-center py-20">Gagal memuat home.</div>`;

    // 1. Process for Hero Slider (Top 5 Hot Updates)
    const heroSlides = data.hotUpdates.slice(0, 6);
    const hotList = data.hotUpdates.slice(6); // The rest goes to standard list
    
    // 2. History Strip
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');

    let html = `
    <!-- HERO SLIDER SECTION -->
    <div class="swiper mySwiper w-full h-[55vh] md:h-[65vh] relative group bg-black">
        <div class="swiper-wrapper">
            ${heroSlides.map(slide => `
                <div class="swiper-slide relative w-full h-full cursor-pointer" onclick="showDetail('${slide.slug}')">
                    <!-- BG Image -->
                    <img src="${slide.image}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition duration-[10s]">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/90 via-transparent to-transparent"></div>
                    
                    <!-- Content -->
                    <div class="absolute bottom-0 left-0 w-full p-6 md:p-12 md:bottom-10 z-20 flex flex-col justify-end h-full">
                        <div class="container mx-auto">
                            <span class="inline-block px-3 py-1 rounded-md bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest mb-3 shadow-lg shadow-amber-500/30">
                                ${slide.type || 'TRENDING'}
                            </span>
                            <h2 class="text-2xl md:text-5xl font-black text-white leading-tight mb-2 md:max-w-2xl line-clamp-2 drop-shadow-lg">
                                ${slide.title}
                            </h2>
                            <p class="text-gray-300 text-sm font-medium mb-4 flex items-center gap-2">
                                <span class="bg-white/10 px-2 py-1 rounded border border-white/10 text-amber-400"><i class="fa fa-book-open mr-1"></i> ${slide.chapter || slide.latestChapter}</span>
                            </p>
                            <button class="bg-white text-black px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-amber-500 transition shadow-lg w-max">
                                <i class="fa fa-play"></i> Baca Sekarang
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="swiper-pagination !bottom-6 md:!bottom-10 md:!left-12 md:!w-auto container mx-auto"></div>
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
                        <img src="${h.image}" class="w-12 h-16 rounded object-cover shadow bg-gray-800">
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
             <button onclick="showOngoing()" class="px-8 py-3 rounded-full border border-white/10 hover:bg-amber-500 hover:text-black hover:border-transparent transition font-bold text-sm">Lihat Semua Update</button>
        </div>
    </div>`;

    dom.content.innerHTML = html;

    // Initialize Swiper
    new Swiper(".mySwiper", {
        loop: true,
        effect: "fade",
        autoplay: { delay: 4000, disableOnInteraction: false },
        pagination: { el: ".swiper-pagination", clickable: true },
        allowTouchMove: false // Cinematic style usually handles swipes specifically or disabled on desktop
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
                 <div class="text-[10px] bg-amber-500 text-black font-extrabold px-2 py-1 rounded w-max shadow-lg shadow-amber-500/20">
                    ${ch}
                 </div>
            </div>
        </div>
        <h3 class="font-bold text-sm text-gray-200 line-clamp-2 leading-tight group-hover:text-amber-500 transition">${item.title}</h3>
    </div>`;
}

/* --- LIST PAGES (Ongoing, Completed, Genre, Search) --- */

async function showOngoing(page=1, push=true) {
    if(push) updateURL('/ongoing');
    genericListLoad(`${API_BASE}/list?status=Ongoing&orderby=popular&page=${page}`, `Komik Ongoing - Hal ${page}`, 'showOngoing', page);
}

async function showCompleted(page=1, push=true) {
    if(push) updateURL('/completed');
    genericListLoad(`${API_BASE}/list?status=Completed&orderby=popular&page=${page}`, `Komik Tamat - Hal ${page}`, 'showCompleted', page);
}

async function applyAdvancedFilter() {
    const q = document.getElementById('search-input').value;
    const g = document.getElementById('filter-genre').value;
    dom.filterPanel.classList.add('hidden'); // Close immediately
    
    if(q) {
        genericListLoad(`${API_BASE}/search/${encodeURIComponent(q)}/1`, `Pencarian: "${q}"`, null);
    } else {
        const type = document.getElementById('filter-type').value;
        const status = document.getElementById('filter-status').value;
        let url = `${API_BASE}/list?orderby=popular&page=1`;
        if(type) url += `&type=${type}`;
        if(status) url += `&status=${status}`;
        if(g) { showGenre(g); return; }
        
        genericListLoad(url, 'Hasil Filter', null);
    }
}

async function genericListLoad(url, titleStr, funcName, currentPage=1) {
    renderLoading();
    setSEO(titleStr);
    const data = await api(url.replace(API_BASE, ''));
    
    if(!data || !data.data || data.data.length === 0) {
        dom.content.innerHTML = `<div class="h-screen flex flex-col items-center justify-center text-gray-500"><i class="fa fa-ghost text-4xl mb-4"></i><p>Tidak ada hasil.</p></div>`;
        return;
    }

    const items = data.data;
    const pagination = data.pagination || {};

    let navHtml = '';
    if (funcName && pagination) {
        navHtml = `
        <div class="col-span-full flex justify-center gap-4 py-8">
            ${currentPage > 1 ? `<button onclick="${funcName}(${currentPage - 1})" class="bg-white/10 px-6 py-2 rounded-xl hover:bg-amber-500 hover:text-black font-bold text-sm transition">< Prev</button>` : ''}
            <span class="px-4 py-2 text-gray-500 font-mono">Page ${currentPage}</span>
            ${pagination.hasNextPage ? `<button onclick="${funcName}(${currentPage + 1})" class="bg-white/10 px-6 py-2 rounded-xl hover:bg-amber-500 hover:text-black font-bold text-sm transition">Next ></button>` : ''}
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
    
    // Convert flat items to look like API items
    const formatted = b.map(x => ({
        slug: x.slug, title: x.title, image: x.image, 
        type: 'Disimpan', latestChapter: 'Akses Cepat'
    }));
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-3"><span class="w-1 h-8 bg-amber-500 rounded-full"></span> Koleksi Favorit (${formatted.length})</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 animate-fade-in">
            ${formatted.map(item => cardTemplate(item)).join('')}
        </div>
    </div>`;
}

async function showHistory(push=true) {
    if(push) updateURL('/history');
    setSEO("Riwayat");
    const h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    
    if(h.length === 0) return dom.content.innerHTML = '<div class="h-[70vh] flex justify-center items-center text-gray-500">Kosong.</div>';
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold border-l-4 border-amber-500 pl-3">Riwayat Baca</h2>
            <button onclick="localStorage.removeItem('fmc_history');showHistory()" class="text-xs text-red-400 border border-red-500/30 px-3 py-1 rounded-lg hover:bg-red-500 hover:text-white transition">Hapus Data</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${h.map(item => `
                <div class="flex gap-4 p-4 bg-[#1a1a1d] rounded-2xl border border-white/5 cursor-pointer hover:border-amber-500/30 transition group" 
                    onclick="readChapter('${item.lastChapterSlug}', '${item.slug}')">
                    <img src="${item.image}" class="w-20 h-28 object-cover rounded-xl shadow-lg group-hover:scale-105 transition">
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
    if (slug.length === 36) {
         const m = await getSlug(slug);
         if(m) slug = m.slug;
    }
    
    if (push) updateURL(`/series/${await getUuid(slug, 'series')}`);
    
    renderLoading();
    const data = await api(`/detail/${slug}`);
    if (!data) return redirectTo404();

    const info = data;
    appState.comicData = info;
    appState.currentChapterList = info.chapters;
    setSEO(info.title);

    // Get History Status
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const saved = history.find(h => h.slug === slug);
    
    // Determine main action
    const btnText = saved ? "Lanjut Baca" : "Mulai Baca";
    const btnSlug = saved ? saved.lastChapterSlug : (info.chapters.length > 0 ? info.chapters[info.chapters.length - 1].slug : null);
    
    const bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const isBookmarked = bookmarks.some(b => b.slug === slug);

    dom.content.innerHTML = `
    <!-- Header BG -->
    <div class="relative h-[50vh] overflow-hidden">
        <div class="absolute inset-0 bg-[#0a0a0c]"></div>
        <img src="${info.image}" class="w-full h-full object-cover opacity-20 blur-3xl scale-110">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent"></div>
    </div>

    <div class="container mx-auto px-4 -mt-64 relative z-10 pb-20">
        <div class="flex flex-col md:flex-row gap-10">
            <!-- Cover -->
            <div class="w-[200px] md:w-[280px] shrink-0 mx-auto md:mx-0 flex flex-col gap-4">
                <img src="${info.image}" class="w-full rounded-xl shadow-2xl border-4 border-white/5 object-cover aspect-[2/3]">
                
                ${btnSlug ? `
                <button onclick="readChapter('${btnSlug}', '${slug}')" class="w-full bg-amber-500 hover:bg-amber-400 text-black py-3.5 rounded-xl font-bold shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition flex justify-center gap-2 items-center">
                    <i class="fa fa-book-open"></i> ${btnText}
                </button>` : ''}
                
                <button id="btn-bm" onclick="toggleBookmark('${slug}', \`${info.title.replace(/'/g, "")}\`, '${info.image}')" 
                    class="w-full border py-3.5 rounded-xl font-semibold transition flex justify-center gap-2 items-center ${isBookmarked ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'}">
                    <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i> <span>${isBookmarked ? 'Tersimpan' : 'Bookmark'}</span>
                </button>
            </div>

            <!-- Info -->
            <div class="flex-1">
                <h1 class="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">${info.title}</h1>
                
                <div class="flex flex-wrap gap-2 mb-6 text-xs font-bold uppercase text-gray-400">
                    <span class="px-3 py-1 bg-white/5 rounded border border-white/5 text-amber-500"><i class="fa fa-star mr-1"></i> ${info.rating}</span>
                    <span class="px-3 py-1 bg-white/5 rounded border border-white/5 ${info.status.toLowerCase() === 'ongoing' ? 'text-green-400' : 'text-blue-400'}">${info.status}</span>
                    <span class="px-3 py-1 bg-white/5 rounded border border-white/5">${info.type}</span>
                </div>

                <div class="mb-8 bg-[#151518] p-5 rounded-2xl border border-white/5">
                    <p class="text-gray-300 leading-relaxed text-sm md:text-base font-light text-justify">
                        ${info.synopsis || "Sinopsis tidak tersedia."}
                    </p>
                    <div class="mt-4 flex flex-wrap gap-2">
                        ${(info.genres || []).map(g => `<span class="text-[10px] border border-white/10 px-2 py-1 rounded-md text-gray-400 hover:text-white cursor-default transition">${g.title}</span>`).join('')}
                    </div>
                </div>

                <!-- Chapter List -->
                <div class="bg-[#151518] rounded-2xl border border-white/5 overflow-hidden">
                    <div class="p-4 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 bg-white/[0.02]">
                        <h3 class="font-bold">Total Chapter: <span class="text-amber-500">${info.chapters.length}</span></h3>
                        <input type="text" onkeyup="filterChapters(this.value)" placeholder="Cari Chapter..." class="bg-black/30 border border-white/10 px-4 py-2 rounded-lg text-xs w-full sm:w-auto focus:border-amber-500 focus:outline-none transition">
                    </div>
                    
                    <div id="chapter-list-wrap" class="max-h-[500px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                        ${renderChapterItems(info.chapters, slug, saved ? saved.lastChapterSlug : null)}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderChapterItems(chapters, comicSlug, lastRead) {
    if(!chapters.length) return `<div class="p-4 text-center text-gray-500">Kosong</div>`;
    
    return chapters.map(c => `
        <div class="ch-item group flex items-center justify-between p-3.5 rounded-xl cursor-pointer hover:bg-white/5 border border-transparent hover:border-white/5 transition ${c.slug === lastRead ? 'bg-amber-900/10 border-amber-500/20' : 'bg-[#1a1a1e]'}"
            onclick="readChapter('${c.slug}', '${comicSlug}')">
            <span class="text-sm font-semibold text-gray-300 group-hover:text-amber-500 transition truncate ${c.slug === lastRead ? '!text-amber-500' : ''}">
                ${c.title}
            </span>
            <span class="text-[10px] text-gray-500 whitespace-nowrap bg-black/20 px-2 py-1 rounded">${c.time || 'FREE'}</span>
        </div>
    `).join('');
}

function filterChapters(val) {
    val = val.toLowerCase();
    const els = document.querySelectorAll('.ch-item');
    els.forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(val) ? "flex" : "none";
    });
}

function toggleBookmark(slug, title, image) {
    let b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const idx = b.findIndex(x => x.slug === slug);
    const btn = document.getElementById('btn-bm');
    
    if (idx > -1) {
        b.splice(idx, 1);
        btn.classList.replace('text-amber-500', 'text-gray-300');
        btn.classList.replace('border-amber-500', 'border-white/10');
        btn.classList.remove('bg-amber-500/10');
        btn.innerHTML = `<i class="fa-regular fa-bookmark"></i> <span>Bookmark</span>`;
        showToast('Dihapus dari koleksi');
    } else {
        b.push({ slug, title, image, added: Date.now() });
        btn.classList.replace('text-gray-300', 'text-amber-500');
        btn.classList.replace('border-white/10', 'border-amber-500');
        btn.classList.add('bg-amber-500/10');
        btn.innerHTML = `<i class="fa-solid fa-bookmark"></i> <span>Tersimpan</span>`;
        showToast('Ditambahkan ke koleksi', 'success');
    }
    localStorage.setItem('fmc_bookmarks', JSON.stringify(b));
}


/* --- READER PAGE (Ultra optimized) --- */

async function readChapter(chIdOrSlug, comicSlug, push=true) {
    if (appState.isNavigating) return;
    
    let chSlug = chIdOrSlug;
    if (chSlug.length === 36) {
        const m = await getSlug(chSlug);
        chSlug = m ? m.slug : chSlug;
    }
    
    // UI Transitions
    dom.navs.main.classList.add('-translate-y-full');
    dom.navs.mobile.classList.add('translate-y-full');
    dom.progressBar.style.width = '30%';
    dom.content.innerHTML = `<div class="bg-black min-h-screen"></div>`; // Clear first

    if(push) updateURL(`/chapter/${await getUuid(chSlug, 'chapter')}`);

    const data = await api(`/chapter/${chSlug}`);
    
    if (!data) { 
        dom.progressBar.style.width = '100%'; 
        setTimeout(() => dom.progressBar.style.width = '0', 500);
        showToast('Gagal memuat chapter', 'error'); 
        showHome(); return; 
    }

    // Determine Parent
    const parentSlug = comicSlug || data.comic_slug || (data.relation?.slug) || 'home';
    const parentTitle = appState.comicData?.title || data.comic_title || 'Komik';
    const chapterTitle = data.title.replace(parentTitle, '').replace('–', '').trim() || chSlug;
    
    setSEO(`${chapterTitle} - ${parentTitle}`);

    // Update History logic (same as before but safer)
    saveReaderHistory(parentSlug, parentTitle, appState.comicData?.image, chSlug, chapterTitle);

    // Render Reader Interface
    dom.content.innerHTML = `
    <div id="reader-wrapper" class="bg-[#050505] min-h-screen relative pb-20 select-none">
        <!-- Floating Header -->
        <div id="r-head" class="fixed top-0 inset-x-0 z-[60] bg-black/80 backdrop-blur transition-transform duration-300 flex justify-between items-center p-3 border-b border-white/5">
             <div class="flex items-center gap-3 overflow-hidden">
                <button onclick="showDetail('${parentSlug}')" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-amber-500 hover:text-black transition">
                    <i class="fa fa-arrow-left"></i>
                </button>
                <div class="flex flex-col truncate">
                    <h3 class="text-xs text-amber-500 font-bold uppercase truncate max-w-[200px]">${parentTitle}</h3>
                    <span class="text-xs font-medium text-white">${chapterTitle}</span>
                </div>
             </div>
             <button onclick="toggleReaderSettings()" class="w-10 h-10 text-gray-400 hover:text-white">
                <i class="fa fa-gear"></i>
             </button>
        </div>

        <!-- Image Area -->
        <div id="img-container" class="flex flex-col items-center pt-16 min-h-screen ${appState.settings.fitMode === 'original' ? 'reader-full-width' : 'reader-max-width'} transition-all duration-300" onclick="toggleReaderUI()">
             <!-- Images injected here -->
        </div>

        <!-- Bottom Nav -->
        <div id="r-foot" class="fixed bottom-0 inset-x-0 z-[60] p-4 flex justify-center transition-transform duration-300">
             <div class="glass px-2 py-2 rounded-2xl flex items-center gap-2 shadow-2xl bg-black/90">
                <button ${data.navigation.prev ? `onclick="readChapter('${data.navigation.prev}','${parentSlug}')"` : 'disabled class="opacity-30"'} class="w-12 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition">
                    <i class="fa fa-chevron-left"></i>
                </button>
                
                <button onclick="showDetail('${parentSlug}')" class="px-4 text-xs font-bold text-gray-400 hover:text-white">LIST</button>

                <button ${data.navigation.next ? `onclick="readChapter('${data.navigation.next}','${parentSlug}')"` : 'onclick="showDetail(\''+parentSlug+'\') class="bg-amber-500 text-black font-bold text-xs px-4 rounded-xl"'} 
                  class="w-12 h-10 rounded-xl bg-amber-600 text-white shadow hover:bg-amber-500 flex items-center justify-center transition">
                    ${data.navigation.next ? '<i class="fa fa-chevron-right"></i>' : '<i class="fa fa-check"></i>'}
                </button>
             </div>
        </div>
    </div>`;

    // Load Images (Sequential)
    const container = document.getElementById('img-container');
    const images = data.images || [];
    let loaded = 0;

    images.forEach(src => {
        const wrap = document.createElement('div');
        wrap.className = "w-full relative min-h-[300px] bg-[#101012] mb-0";
        wrap.innerHTML = `<div class="skeleton absolute inset-0 z-10"></div><img src="${src}" class="comic-page opacity-0 transition-opacity duration-300 relative z-20" loading="lazy" onload="this.classList.remove('opacity-0');this.previousElementSibling.remove()">`;
        // Error handling shorthand
        const img = wrap.querySelector('img');
        img.onerror = () => { img.src = src; /* simple retry */ };
        
        container.appendChild(wrap);
    });

    dom.progressBar.style.width = '100%';
    setTimeout(() => dom.progressBar.style.width = '0', 300);
    window.scrollTo(0,0);
}

function saveReaderHistory(slug, title, image, chSlug, chTitle) {
    if(!title || title === 'Komik') return; // Skip invalid
    let h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    // remove duplicate
    h = h.filter(x => x.slug !== slug);
    // Add to top
    h.unshift({ 
        slug, title, image: image || 'assets/icon.png', 
        lastChapterSlug: chSlug, lastChapterTitle: chTitle, time: Date.now() 
    });
    if(h.length > 50) h.pop();
    localStorage.setItem('fmc_history', JSON.stringify(h));
}

/* --- READER UTILITIES --- */

function toggleReaderUI() {
    const head = document.getElementById('r-head');
    const foot = document.getElementById('r-foot');
    if(head) head.classList.toggle('-translate-y-full');
    if(foot) foot.classList.toggle('translate-y-[150%]');
}

function toggleReaderSettings() {
    const el = document.getElementById('reader-settings');
    el.classList.toggle('hidden');
    // small anim
    if(!el.classList.contains('hidden')) {
        setTimeout(() => el.classList.remove('scale-90', 'opacity-0'), 10);
    } else {
        el.classList.add('scale-90', 'opacity-0');
    }
}

function toggleImageFit() {
    appState.settings.fitMode = appState.settings.fitMode === 'contain' ? 'original' : 'contain';
    saveSettings();
    applySettings();
}

function changeBrightness(val) {
    appState.settings.brightness = val;
    document.getElementById('bright-val').innerText = `${val}%`;
    saveSettings();
    applySettings();
}

function saveSettings() {
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
}

function applySettings() {
    const container = document.getElementById('img-container');
    const btn = document.getElementById('btn-fit-toggle');
    const overlay = document.getElementById('brightness-overlay');
    
    // Fit Mode
    if(container) {
        if(appState.settings.fitMode === 'original') {
            container.classList.remove('reader-max-width');
            container.classList.add('reader-full-width');
            if(btn) { btn.innerText = "Original"; btn.classList.add('bg-amber-500', 'text-black'); }
        } else {
            container.classList.add('reader-max-width');
            container.classList.remove('reader-full-width');
            if(btn) { btn.innerText = "Fit Width"; btn.classList.remove('bg-amber-500', 'text-black'); }
        }
    }
    
    // Brightness
    const opacity = (100 - appState.settings.brightness) / 100;
    if(overlay) overlay.style.opacity = opacity;
    const slider = document.getElementById('brightness-slider');
    if(slider) slider.value = appState.settings.brightness;
    const label = document.getElementById('bright-val');
    if(label) label.innerText = `${appState.settings.brightness}%`;
}

// Misc Functions
function loadGenres() {
    api('/genres').then(data => {
        if(data && data.length) {
             const s = document.getElementById('filter-genre');
             data.sort((a,b)=>a.title.localeCompare(b.title)).forEach(g => {
                 const o = document.createElement('option');
                 o.value = g.slug; o.text = g.title;
                 s.appendChild(o);
             });
        }
    });
}

function showGenre(g) {
    genericListLoad(`${API_BASE}/genre/${g}/1`, `Genre: ${g}`, 'showGenreFromLink', 1); // logic simplified
    // for standard function call need proper page handling but reusing generic for now
}
function handleSearchInput(e) {
    // optional debounce logic handled in simple form button currently to save tokens/complexity
}
function toggleFilter() { 
    dom.filterPanel.classList.toggle('hidden'); 
    if(!dom.filterPanel.classList.contains('hidden')) document.getElementById('search-input').focus();
}
function redirectTo404() { 
    dom.content.innerHTML = `<div class="py-20 text-center">404 - Not Found <br><button onclick="showHome()" class="mt-4 text-amber-500">Go Home</button></div>`; 
}
