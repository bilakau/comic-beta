/*
  FmcComic Ultra - Fixed Structure & Logic v3
  Fixes: Empty Home, "Tanpa Judul" Detail, API Response handling
*/

// Jika NekoLabs sering down/limit, ganti URL proxy ini
const API_PROXY = "https://api.nekolabs.web.id/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

// State
let appState = {
    isNavigating: false,
    currentChapterList: [],
    comicData: null,
    settings: JSON.parse(localStorage.getItem('fmc_settings') || '{"fitMode": "contain", "brightness": 100}'),
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

document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    applySettings();
    handleRouting();
    
    // Close modal if clicked outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#filter-panel') && !e.target.closest('[onclick="toggleFilter()"]')) {
            dom.filterPanel.classList.add('hidden');
        }
    });
});

window.addEventListener('popstate', handleRouting);

window.onscroll = () => {
    const scrollBtn = document.getElementById('scroll-top');
    const scrolled = window.scrollY;
    
    if (scrolled > 400) {
        scrollBtn.classList.remove('opacity-0', 'translate-y-24');
        scrollBtn.classList.add('translate-y-0', 'opacity-100');
    } else {
        scrollBtn.classList.add('opacity-0', 'translate-y-24');
        scrollBtn.classList.remove('translate-y-0', 'opacity-100');
    }
    
    if(dom.navs.main) {
        if(scrolled > 50) dom.navs.main.classList.add('shadow-xl', 'bg-[#0a0a0c]/95');
        else dom.navs.main.classList.remove('shadow-xl', 'bg-[#0a0a0c]/95');
    }
};

/* --- HELPER --- */

function setSEO(title) {
    document.title = title ? `${title} - FmcComic` : 'FmcComic - Baca Komik Gratis Tanpa Iklan';
}

function updateURL(path) {
    if (window.location.pathname !== path) history.pushState(null, null, path);
}

function showToast(msg, type = 'info') {
    if(!dom.toastContainer) return;
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

// -------------------------------------------------------------
// BAGIAN PENTING 1: FETCHING LEBIH PINTAR
// Fungsi ini akan mencari data di berbagai kemungkinan struktur JSON
// -------------------------------------------------------------
async function api(endpoint) {
    // Controller timeout untuk membatalkan request lama yang stuck
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 detik max

    try {
        const fullUrl = API_PROXY + encodeURIComponent(`${API_BASE}${endpoint}`);
        console.log(`[API Calling] -> ${endpoint}`);

        const res = await fetch(fullUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const json = await res.json();
        
        // Logika untuk menemukan data "Daging" nya
        // Beberapa endpoint mengembalikan json.data, ada yg json.result
        if (json.data) return json.data; 
        if (json.result) return json.result; 
        if (json.success === true && json.content) return json.content;
        
        // Jika struktur flat
        return json;
    } catch (err) {
        console.error(`[API Fail] ${endpoint}`, err);
        return null; // Return null biar bisa di handle fungsi lain
    } finally {
        clearTimeout(timeoutId);
    }
}

async function getUuid(slug, type) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/get-id`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({slug, type})
        });
        const d = await res.json();
        return d.uuid || slug;
    } catch { return slug; }
}

async function getSlug(uuid) {
    // Validasi format UUID sederhana (36 karakter)
    if (!uuid || uuid.length !== 36) return { slug: uuid }; 
    try {
        const res = await fetch(`${BACKEND_URL}/api/get-slug/${uuid}`);
        return res.ok ? await res.json() : { slug: uuid };
    } catch { return { slug: uuid }; }
}


/* --- RENDERER UI --- */

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

function renderError(title, msg, retryFn) {
    dom.content.innerHTML = `
        <div class="container mx-auto px-4 py-32 flex flex-col items-center justify-center text-center">
            <i class="fa fa-triangle-exclamation text-4xl text-amber-500 mb-4"></i>
            <h2 class="text-xl font-bold mb-2">${title}</h2>
            <p class="text-gray-500 text-sm max-w-md mb-6">${msg}</p>
            <button onclick="${retryFn}" class="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/5 rounded-xl transition text-sm font-bold">Coba Lagi</button>
        </div>
    `;
}

async function handleRouting() {
    appState.isNavigating = false;
    const path = window.location.pathname;
    
    // Highlight Navbar
    if(document.querySelectorAll('.nav-btn')) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('text-amber-500', 'active'));
    }

    // Routing Logic
    if (path.startsWith('/chapter')) {
        const id = path.split('/')[2];
        if(id) readChapter(id, null, false);
    } 
    else if (path.startsWith('/series')) {
        const id = path.split('/')[2];
        if(id) showDetail(id, false);
    }
    else {
        // Show Navs
        dom.navs.main.classList.remove('-translate-y-full');
        dom.navs.mobile.classList.remove('translate-y-full');
        
        if (path === '/ongoing') showOngoing(1, false);
        else if (path === '/completed') showCompleted(1, false);
        else if (path === '/history') showHistory();
        else if (path === '/bookmarks') showBookmarks();
        else showHome(false);
    }
}


/* --- PAGE: HOME (Fixed Empty Bug) --- */
// Jika 'hotUpdates' tidak ada, kode ini akan otomatis mencari kunci lain agar tidak kosong

async function showHome(push = true) {
    if (push) updateURL('/');
    renderLoading();
    setSEO();
    
    const raw = await api('/home');

    // Analisa struktur data untuk Home
    // Kadang 'raw' itu object yang isinya { popular: [...], latest: [...] }
    // Kadang array flat
    let popularList = [];
    let latestList = [];

    if (raw) {
        // Cek struktur umum API Sanka
        if (Array.isArray(raw)) {
            // Kalau data langsung array, kemungkinan hanya latest update
            latestList = raw;
        } else {
            // Ambil dari berbagai kemungkinan nama kunci
            popularList = raw.hotUpdates || raw.popular || raw.popular_comics || raw.project || [];
            latestList = raw.latestReleases || raw.latest || raw.update || raw.data || [];
        }
    } else {
        return renderError('Koneksi Gagal', 'Gagal terhubung ke sumber komik.', 'showHome()');
    }

    // Ambil slice untuk hero
    const heroSlides = popularList.slice(0, 5);
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');

    let html = '';

    // -- HERO SECTION --
    if (heroSlides.length > 0) {
        html += `
        <div class="swiper mySwiper w-full h-[55vh] md:h-[65vh] relative group bg-black">
            <div class="swiper-wrapper">
                ${heroSlides.map(slide => `
                    <div class="swiper-slide relative w-full h-full cursor-pointer" onclick="showDetail('${slide.slug}')">
                        <img src="${slide.image}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition duration-[10s]">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/90 via-transparent to-transparent"></div>
                        
                        <div class="absolute bottom-0 left-0 w-full p-6 md:p-12 md:bottom-10 z-20 flex flex-col justify-end h-full">
                            <div class="container mx-auto">
                                <span class="inline-block px-3 py-1 rounded-md bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest mb-3 shadow-lg shadow-amber-500/30">
                                    TRENDING
                                </span>
                                <h2 class="text-2xl md:text-5xl font-black text-white leading-tight mb-2 md:max-w-2xl line-clamp-2 drop-shadow-lg">
                                    ${slide.title}
                                </h2>
                                <p class="text-gray-300 text-sm font-medium mb-4 flex items-center gap-2">
                                    <span class="bg-white/10 px-2 py-1 rounded border border-white/10 text-amber-400">
                                        ${slide.chapter || slide.latestChapter || 'Baca Sekarang'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="swiper-pagination !bottom-6 md:!bottom-10 md:!left-12 md:!w-auto container mx-auto"></div>
        </div>
        `;
    }

    html += `<div class="container mx-auto px-4 ${heroSlides.length > 0 ? '-mt-10 relative z-30' : 'mt-24'} pb-24">`;

    // -- HISTORY STRIP --
    if (history.length > 0) {
        html += `
        <div class="mb-10">
            <h3 class="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wide">
               <i class="fa fa-clock-rotate-left text-amber-500"></i> Lanjutkan Baca
            </h3>
            <div class="flex overflow-x-auto gap-4 hide-scroll pb-2">
                ${history.slice(0,6).map(h => `
                    <div onclick="readChapter('${h.lastChapterSlug}', '${h.slug}')" 
                        class="min-w-[220px] bg-[#1a1a1d] p-3 rounded-xl flex gap-3 cursor-pointer hover:bg-[#25252b] border border-white/5 hover:border-amber-500/30 transition">
                        <img src="${h.image}" onerror="this.src='assets/icon.png'" class="w-10 h-14 rounded object-cover shadow bg-gray-800">
                        <div class="flex flex-col justify-center min-w-0">
                            <h4 class="text-xs font-bold text-white truncate mb-1">${h.title}</h4>
                            <span class="text-[10px] text-amber-500 bg-amber-500/10 w-max px-2 py-0.5 rounded border border-amber-500/20">${h.lastChapterTitle || 'Lanjut'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // -- LATEST RELEASES --
    html += `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-white border-l-4 border-amber-500 pl-4">Update Terbaru</h2>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 gap-y-6">
            ${latestList.length > 0 ? latestList.map(item => cardTemplate(item)).join('') : `
            <div class="col-span-full text-center py-10 border border-dashed border-white/10 rounded-xl">
                <p class="text-gray-500 text-sm">Data Latest Update belum tersedia dari API.</p>
                <button onclick="showOngoing()" class="mt-4 text-amber-500 text-sm underline">Coba Cek Tab Ongoing</button>
            </div>`}
        </div>
        
        <div class="mt-10 flex justify-center">
             <button onclick="showOngoing()" class="px-8 py-3 rounded-full border border-white/10 bg-white/5 hover:bg-amber-500 hover:text-black hover:border-transparent transition font-bold text-sm shadow-xl">Lihat Komik Lainnya</button>
        </div>
    </div>`;

    dom.content.innerHTML = html;

    if (heroSlides.length > 0) {
        new Swiper(".mySwiper", {
            loop: true,
            effect: "fade",
            autoplay: { delay: 4000, disableOnInteraction: false },
            pagination: { el: ".swiper-pagination", clickable: true },
        });
    }
}


/* --- COMPONENT: CARD --- */

function cardTemplate(item) {
    if(!item) return '';
    // Menangani variasi penamaan variabel di API yang berbeda-beda
    const title = item.title || "No Title";
    const slug = item.slug || item.endpoint;
    const img = item.image || item.thumb || "https://ui-avatars.com/api/?background=333&color=fff&name=Manga";
    const ch = item.chapters?.[0]?.title || item.chapter || item.latestChapter || 'Read';
    const type = (item.type || '').toLowerCase();

    // Style Badge Type
    let typeClass = 'border-gray-600 bg-gray-600/20 text-gray-300';
    if(type.includes('manga')) typeClass = 'border-blue-500 bg-blue-500/20 text-blue-300';
    else if(type.includes('manhwa')) typeClass = 'border-green-500 bg-green-500/20 text-green-300';
    else if(type.includes('manhua')) typeClass = 'border-pink-500 bg-pink-500/20 text-pink-300';

    return `
    <div class="group relative cursor-pointer active:scale-95 transition-transform" onclick="showDetail('${slug}')">
        <div class="relative rounded-xl overflow-hidden aspect-[3/4] mb-3 border border-white/10 bg-[#151518]">
            ${type ? `<span class="absolute top-2 right-2 z-10 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border backdrop-blur-md ${typeClass}">${type}</span>` : ''}
            
            <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            
            <div class="absolute bottom-2 left-2 z-20">
                 <div class="text-[9px] font-bold text-black bg-amber-500 px-2 py-0.5 rounded shadow-lg">
                    ${ch}
                 </div>
            </div>
        </div>
        <h3 class="font-bold text-xs sm:text-sm text-gray-200 line-clamp-2 leading-snug group-hover:text-amber-500 transition">${title}</h3>
    </div>`;
}


/* --- PAGE: LIST (Ongoing/Completed) --- */

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
    dom.filterPanel.classList.add('hidden');
    
    if(q) genericListLoad(`${API_BASE}/search/${encodeURIComponent(q)}/1`, `Hasil: "${q}"`, null);
    else if (g) showGenre(g);
    else genericListLoad(`${API_BASE}/list?orderby=popular&page=1`, 'Filter Result', null);
}

async function genericListLoad(url, titleStr, funcName, currentPage=1) {
    renderLoading();
    setSEO(titleStr);
    
    // API logic dipisah
    const raw = await api(url.replace(API_BASE, ''));
    let items = [];
    let pagination = {};

    // Menangani struktur { data: [...], pagination: {...} } vs flat array [...]
    if (raw) {
        if(Array.isArray(raw)) items = raw;
        else if(raw.data) {
            items = raw.data;
            pagination = raw.pagination || {};
        }
    }

    if(items.length === 0) {
        return renderError('Kosong', 'Tidak ada komik yang ditemukan.', 'showHome()');
    }

    // Pagination Logic (Basic)
    let navHtml = '';
    if (funcName) {
        navHtml = `
        <div class="col-span-full flex justify-center gap-4 py-8">
            ${currentPage > 1 ? `<button onclick="${funcName}(${currentPage - 1})" class="bg-white/10 px-5 py-2 rounded-lg hover:bg-amber-500 hover:text-black font-bold text-xs transition">PREV</button>` : ''}
            <span class="px-3 py-2 text-gray-600 font-mono text-xs">Page ${currentPage}</span>
            ${pagination.hasNextPage !== false ? `<button onclick="${funcName}(${currentPage + 1})" class="bg-white/10 px-5 py-2 rounded-lg hover:bg-amber-500 hover:text-black font-bold text-xs transition">NEXT</button>` : ''}
        </div>`;
    }

    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8 pb-24">
        <h2 class="text-xl font-bold mb-6 flex items-center gap-3">
           <span class="w-1 h-6 bg-amber-500 rounded-full"></span> ${titleStr}
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 gap-y-6 animate-fade-in">
            ${items.map(item => cardTemplate(item)).join('')}
        </div>
        ${navHtml}
    </div>`;
}


/* --- PAGE: DETAIL (FIX "Tanpa Judul") --- */
// -------------------------------------------------------------
// MASALAH "Tanpa Judul" diatasi di sini dengan memastikan
// Slug yang dikirim ke API itu Benar (Bukan UUID/undefined)
// -------------------------------------------------------------
async function showDetail(idOrSlug, push=true) {
    let slug = idOrSlug;

    // 1. Resolve UUID jika string panjang
    if (slug.length === 36) {
         const m = await getSlug(slug);
         // Kalau server UUID gagal resolve, m.slug mungkin masih uuid, 
         // Tapi kita coba request dulu siapa tau hoki, 
         // ATAU lebih baik kita error kan kalau resolve gagal supaya gak ngerusak UI.
         if (m) slug = m.slug;
    }
    
    // Setup URL agar bersih
    const newUuid = await getUuid(slug, 'series');
    if (push) updateURL(`/series/${newUuid}`);
    
    renderLoading();

    // 2. Fetch Detail dengan slug asli
    const data = await api(`/detail/${slug}`);
    
    // 3. VALIDASI EKSTRA: Jika Data Balik tapi Title nya kosong, artinya SLUG Salah atau API Error parsial
    if (!data || !data.title || data.title === "") {
        console.error("Failed Data Detail:", data); // Log untuk debug
        return renderError(
            'Komik Tidak Ditemukan', 
            `Gagal mengambil data untuk ID: <b>${slug}</b>.<br>Mungkin broken link dari sumbernya.`, 
            'showHome()'
        );
    }

    const info = data;
    const chapters = info.chapters || [];
    
    // Save info
    appState.comicData = info;
    appState.currentChapterList = chapters;
    setSEO(info.title);

    // Bookmarks & History logic
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const saved = history.find(h => h.slug === slug);
    const btnText = saved ? "Lanjut Baca" : "Mulai Baca";
    const btnSlug = saved ? saved.lastChapterSlug : (chapters.length > 0 ? chapters[chapters.length - 1].slug : null);
    
    const bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const isBookmarked = bookmarks.some(b => b.slug === slug);

    dom.content.innerHTML = `
    <!-- Backdrop Header -->
    <div class="relative h-[45vh] overflow-hidden">
        <div class="absolute inset-0 bg-[#0a0a0c]"></div>
        <img src="${info.image}" class="w-full h-full object-cover opacity-20 blur-2xl scale-110">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent"></div>
    </div>

    <div class="container mx-auto px-4 -mt-56 relative z-10 pb-20">
        <div class="flex flex-col md:flex-row gap-8">
            <!-- Cover & Actions -->
            <div class="w-[180px] md:w-[260px] shrink-0 mx-auto md:mx-0 flex flex-col gap-4">
                <div class="rounded-xl p-1 bg-white/5 border border-white/5 shadow-2xl">
                    <img src="${info.image}" class="w-full rounded-lg object-cover aspect-[2/3] bg-black">
                </div>
                
                ${btnSlug ? `
                <button onclick="readChapter('${btnSlug}', '${slug}')" class="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition flex justify-center gap-2 items-center">
                    <i class="fa fa-book-open"></i> ${btnText}
                </button>` : 
                '<div class="py-2 text-center text-xs text-red-400 bg-red-900/10 rounded-lg border border-red-500/20">Chapter Kosong</div>'}
                
                <button id="btn-bm" onclick="toggleBookmark('${slug}', \`${(info.title||'').replace(/'/g, "")}\`, '${info.image}')" 
                    class="w-full border py-3 rounded-xl font-semibold transition flex justify-center gap-2 items-center ${isBookmarked ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'}">
                    <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i> <span>${isBookmarked ? 'Saved' : 'Bookmark'}</span>
                </button>
            </div>

            <!-- Detail Text -->
            <div class="flex-1 text-center md:text-left">
                <h1 class="text-2xl md:text-5xl font-black text-white mb-4 leading-tight">${info.title}</h1>
                
                <div class="flex flex-wrap justify-center md:justify-start gap-2 mb-6 text-xs font-bold uppercase text-gray-400">
                    <span class="px-2 py-1 bg-white/5 rounded border border-white/5 text-amber-500"><i class="fa fa-star mr-1"></i> ${info.rating || '0'}</span>
                    <span class="px-2 py-1 bg-white/5 rounded border border-white/5 ${String(info.status).toLowerCase() === 'ongoing' ? 'text-green-400' : 'text-blue-400'}">${info.status}</span>
                    <span class="px-2 py-1 bg-white/5 rounded border border-white/5">${info.type}</span>
                </div>

                <div class="mb-8 bg-[#151518] p-5 rounded-2xl border border-white/5 text-left">
                    <p class="text-gray-300 leading-relaxed text-sm md:text-base font-light text-justify max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        ${info.synopsis || "Deskripsi tidak tersedia."}
                    </p>
                    <div class="mt-4 flex flex-wrap gap-1.5">
                        ${(info.genres || []).map(g => `<span class="text-[10px] border border-white/10 px-2 py-1 rounded text-gray-400">${g.title}</span>`).join('')}
                    </div>
                </div>

                <!-- Chapter List -->
                <div class="bg-[#151518] rounded-2xl border border-white/5 overflow-hidden text-left">
                    <div class="p-4 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 bg-white/[0.02]">
                        <h3 class="font-bold text-sm">List Chapter (${chapters.length})</h3>
                        <input type="text" onkeyup="filterChapters(this.value)" placeholder="Cari No. Chapter..." class="bg-black/30 border border-white/10 px-3 py-1.5 rounded text-xs w-full sm:w-auto focus:border-amber-500 focus:outline-none">
                    </div>
                    
                    <div id="chapter-list-wrap" class="max-h-[500px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                        ${chapters.length > 0 ? chapters.map(c => `
                            <div class="ch-item group flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-white/5 border border-transparent hover:border-white/5 transition ${c.slug === saved?.lastChapterSlug ? 'bg-amber-900/10 border-amber-500/20' : ''}"
                                onclick="readChapter('${c.slug}', '${slug}')">
                                <span class="text-xs md:text-sm font-semibold text-gray-300 group-hover:text-amber-500 transition truncate ${c.slug === saved?.lastChapterSlug ? '!text-amber-500' : ''}">
                                    ${c.title}
                                </span>
                                <span class="text-[9px] text-gray-500 whitespace-nowrap bg-black/20 px-2 py-0.5 rounded">${c.time || '-'}</span>
                            </div>
                        `).join('') : '<div class="p-10 text-center text-gray-500 text-xs italic">Belum ada chapter yang dirilis.</div>'}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function filterChapters(val) {
    val = val.toLowerCase();
    document.querySelectorAll('.ch-item').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(val) ? "flex" : "none";
    });
}

function toggleBookmark(slug, title, image) {
    let b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const idx = b.findIndex(x => x.slug === slug);
    const btn = document.getElementById('btn-bm');
    
    if (idx > -1) {
        b.splice(idx, 1);
        if(btn) {
            btn.className = "w-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 py-3 rounded-xl font-semibold transition flex justify-center gap-2 items-center";
            btn.innerHTML = `<i class="fa-regular fa-bookmark"></i> <span>Bookmark</span>`;
        }
        showToast('Dihapus dari Library');
    } else {
        b.push({ slug, title, image, added: Date.now() });
        if(btn) {
            btn.className = "w-full border border-amber-500 text-amber-500 bg-amber-500/10 py-3 rounded-xl font-semibold transition flex justify-center gap-2 items-center";
            btn.innerHTML = `<i class="fa-solid fa-bookmark"></i> <span>Saved</span>`;
        }
        showToast('Tersimpan di Library', 'success');
    }
    localStorage.setItem('fmc_bookmarks', JSON.stringify(b));
}


/* --- PAGE: READER --- */

async function readChapter(chIdOrSlug, comicSlug, push=true) {
    if (appState.isNavigating) return;
    appState.isNavigating = true; // Lock ui

    // Resolve slug
    let chSlug = chIdOrSlug;
    if (chSlug.length === 36) {
        const m = await getSlug(chSlug);
        chSlug = m ? m.slug : chSlug;
    }

    // UI Loading state
    dom.navs.main.classList.add('-translate-y-full');
    dom.navs.mobile.classList.add('translate-y-full');
    const oldContent = dom.content.innerHTML;
    
    dom.content.innerHTML = `<div class="bg-[#050505] min-h-screen flex items-center justify-center gap-3">
        <div class="w-8 h-8 border-4 border-amber-600 border-b-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-gray-500 font-mono animate-pulse">Load Chapter...</span>
    </div>`;

    // Fetch API
    const data = await api(`/chapter/${chSlug}`);
    appState.isNavigating = false; // unlock

    // Jika gagal
    if (!data) {
        showToast('Gagal memuat chapter.', 'error');
        dom.content.innerHTML = oldContent; // Restore previous page
        dom.navs.main.classList.remove('-translate-y-full');
        dom.navs.mobile.classList.remove('translate-y-full');
        return;
    }

    // Update URL
    if(push) {
        const u = await getUuid(chSlug, 'chapter');
        updateURL(`/chapter/${u}`);
    }

    // Parse Metadata
    const parentSlug = comicSlug || data.comic_slug || 'home';
    const parentTitle = appState.comicData?.title || data.comic_title || 'Comic Reader';
    // Membersihkan judul chapter (e.g "One Piece Chapter 100" -> "Chapter 100")
    const displayTitle = (data.title || '').replace(parentTitle, '').trim(); 

    // Update History
    saveReaderHistory(parentSlug, parentTitle, appState.comicData?.image, chSlug, displayTitle || 'Reading');
    setSEO(`${displayTitle} - ${parentTitle}`);

    const images = data.images || [];

    dom.content.innerHTML = `
    <div id="reader-wrapper" class="bg-[#050505] min-h-screen relative pb-20 select-none">
        <!-- Floating Header -->
        <div id="r-head" class="fixed top-0 inset-x-0 z-[60] bg-black/90 backdrop-blur transition-transform duration-300 flex justify-between items-center p-3 border-b border-white/5">
             <div class="flex items-center gap-3 overflow-hidden">
                <button onclick="showDetail('${parentSlug}')" class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-amber-500 hover:text-black transition text-gray-400">
                    <i class="fa fa-arrow-left"></i>
                </button>
                <div class="flex flex-col truncate">
                    <h3 class="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[200px]">${parentTitle}</h3>
                    <span class="text-xs font-bold text-white truncate">${displayTitle}</span>
                </div>
             </div>
             <button onclick="toggleReaderSettings()" class="w-9 h-9 text-gray-400 hover:text-white"><i class="fa fa-gear"></i></button>
        </div>

        <!-- Image Area -->
        <div id="img-container" class="flex flex-col items-center pt-14 min-h-screen ${appState.settings.fitMode === 'original' ? 'reader-full-width' : 'reader-max-width'}" onclick="toggleReaderUI()">
            ${images.length === 0 ? '<p class="text-gray-500 my-40">Tidak ada gambar (Broken Source)</p>' : ''}
        </div>

        <!-- Footer Nav -->
        <div id="r-foot" class="fixed bottom-6 inset-x-0 z-[60] flex justify-center pointer-events-none transition-transform duration-300">
             <div class="pointer-events-auto bg-[#1a1a1d]/90 backdrop-blur border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-4 shadow-2xl">
                <button ${data.navigation?.prev ? `onclick="readChapter('${data.navigation.prev}','${parentSlug}')"` : 'disabled class="opacity-30"'} class="text-2xl text-amber-500 hover:scale-110 transition">
                    <i class="fa fa-circle-chevron-left"></i>
                </button>
                
                <span class="text-xs font-bold text-gray-400 px-2">NAVIGASI</span>

                <button ${data.navigation?.next ? `onclick="readChapter('${data.navigation.next}','${parentSlug}')"` : 'onclick="showDetail(\''+parentSlug+'\') class="text-green-500"'} class="text-2xl text-amber-500 hover:scale-110 transition">
                    ${data.navigation?.next ? '<i class="fa fa-circle-chevron-right"></i>' : '<i class="fa fa-check-circle"></i>'}
                </button>
             </div>
        </div>
    </div>`;

    // Render Images one by one logic (Better than loop)
    const container = document.getElementById('img-container');
    if (images.length > 0) {
        images.forEach(src => {
            const wrap = document.createElement('div');
            // Hack for full width fit
            wrap.className = "w-full relative min-h-[40vh] bg-[#111] mb-0 flex items-center justify-center";
            wrap.innerHTML = `<p class="absolute text-[10px] text-gray-700 font-mono">Loading...</p><img src="${src}" class="relative z-10 w-full h-auto opacity-0 transition-opacity duration-300" loading="lazy">`;
            
            const img = wrap.querySelector('img');
            img.onload = () => { img.classList.remove('opacity-0'); wrap.querySelector('p')?.remove(); };
            img.onerror = () => { wrap.innerHTML = `<div class="py-20 w-full text-center text-xs text-red-500 bg-red-900/10">Image Error<br><span class="text-[9px] text-gray-600 truncate max-w-xs block mx-auto">${src}</span></div>`; };
            
            container.appendChild(wrap);
        });
    }
    
    window.scrollTo(0,0);
}

// History & Utils (No Change needed, standard storage logic)
function saveReaderHistory(slug, title, image, chSlug, chTitle) {
    if(!title || !slug) return;
    let h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    h = h.filter(x => x.slug !== slug);
    h.unshift({ slug, title, image: image || 'assets/icon.png', lastChapterSlug: chSlug, lastChapterTitle: chTitle, time: Date.now() });
    if(h.length > 50) h.pop();
    localStorage.setItem('fmc_history', JSON.stringify(h));
}

function showBookmarks(push=true) {
    if(push) updateURL('/bookmarks');
    const b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    setSEO("Bookmarks");
    
    if(b.length === 0) return dom.content.innerHTML = `<div class="h-[70vh] flex flex-col items-center justify-center gap-4 text-gray-500"><i class="fa fa-bookmark text-6xl opacity-20"></i><p>Library Kosong</p><button onclick="showHome()" class="text-amber-500">Mulai Baca</button></div>`;
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Library Saya</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 animate-fade-in">
            ${b.map(x => cardTemplate({ title: x.title, slug: x.slug, image: x.image, latestChapter: 'Disimpan' })).join('')}
        </div>
    </div>`;
}

function showHistory(push=true) {
    if(push) updateURL('/history');
    setSEO("Riwayat");
    const h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    if(h.length===0) return dom.content.innerHTML = '<div class="h-[70vh] flex justify-center items-center text-gray-500">Belum ada riwayat baca.</div>';
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-6"><h2 class="text-xl font-bold">Riwayat</h2><button onclick="localStorage.removeItem('fmc_history');showHistory()" class="text-red-500 text-xs">Clear All</button></div>
        <div class="flex flex-col gap-3">
             ${h.map(i => `<div class="flex gap-4 p-3 bg-[#151518] rounded-xl cursor-pointer hover:bg-white/5" onclick="readChapter('${i.lastChapterSlug}','${i.slug}')"><img src="${i.image}" class="w-16 h-20 rounded object-cover"><div class="flex-1 my-auto"><h4 class="font-bold text-sm text-white">${i.title}</h4><p class="text-xs text-amber-500 mt-1">Lanjut: ${i.lastChapterTitle}</p></div></div>`).join('')}
        </div>
    </div>`;
}

// Toggle UI Readers
function toggleReaderUI() {
    const head = document.getElementById('r-head');
    const foot = document.getElementById('r-foot');
    if(head) head.classList.toggle('-translate-y-full');
    if(foot) foot.classList.toggle('translate-y-[200%]');
}
function toggleReaderSettings() { document.getElementById('reader-settings').classList.toggle('hidden'); }
function changeBrightness(val) { 
    appState.settings.brightness = val; 
    document.getElementById('bright-val').innerText = val + '%';
    document.getElementById('brightness-overlay').style.opacity = (100-val)/100;
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
}
function toggleImageFit() {
    const c = document.getElementById('img-container');
    const isOrig = appState.settings.fitMode === 'original';
    appState.settings.fitMode = isOrig ? 'contain' : 'original';
    if(isOrig) { c.classList.add('reader-max-width'); c.classList.remove('reader-full-width'); }
    else { c.classList.remove('reader-max-width'); c.classList.add('reader-full-width'); }
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
}
function applySettings() {
    changeBrightness(appState.settings.brightness);
    if(document.getElementById('brightness-slider')) document.getElementById('brightness-slider').value = appState.settings.brightness;
}

// Misc
function loadGenres() {
    api('/genres').then(d => {
        if(d && Array.isArray(d)) {
             const s = document.getElementById('filter-genre');
             d.sort((a,b)=>a.title.localeCompare(b.title)).forEach(g => {
                 const o = document.createElement('option'); o.value = g.slug; o.text = g.title; s.appendChild(o);
             });
        }
    });
}
function showGenre(g) { genericListLoad(`${API_BASE}/genre/${g}/1`, `Genre: ${g}`, 'showGenreFromLink', 1); }
function toggleFilter() { dom.filterPanel.classList.toggle('hidden'); }
function handleSearchInput() {}
