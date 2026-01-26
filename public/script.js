/*
  FmcComic System V4.0 (Final Complete)
  - Fitur: Swiper Hero, Reader Settings (Fit/Brightness), History, Bookmark, Search, UUID
  - Stability: Proxy Anti-Blokir, Error Handling, Fallback Data
*/

// --- KONFIGURASI ---
const API_PROXY = "https://api.nekolabs.web.id/px?url="; // Proxy paling stabil saat ini
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

// --- STATE MANAGEMENT ---
let appState = {
    isNavigating: false,
    comicData: null,
    settings: JSON.parse(localStorage.getItem('fmc_settings') || '{"fitMode": "contain", "brightness": 100}')
};

// --- DOM ELEMENTS ---
const dom = {
    content: document.getElementById('content-area'),
    progressBar: document.getElementById('progress-bar'),
    filterPanel: document.getElementById('filter-panel'),
    toastContainer: document.getElementById('toast-container'),
    overlay: document.getElementById('brightness-overlay'),
    settingsModal: document.getElementById('reader-settings'),
    navs: { 
        main: document.getElementById('main-nav'), 
        mobile: document.getElementById('mobile-nav') 
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    applyReaderSettings(); 
    handleRouting();

    // Event Listener Global untuk menutup modal jika klik di luar
    document.addEventListener('click', (e) => {
        // Tutup Filter
        if (!e.target.closest('#filter-panel') && !e.target.closest('[onclick="toggleFilter()"]')) {
            if(dom.filterPanel) dom.filterPanel.classList.add('hidden');
        }
        // Tutup Settings Reader (Jika sedang terbuka & bukan klik di dalam modal)
        if (dom.settingsModal && !dom.settingsModal.classList.contains('hidden')) {
            if (!e.target.closest('#reader-settings') && !e.target.closest('[onclick="toggleReaderSettings()"]')) {
                toggleReaderSettings(); // Tutup
            }
        }
    });
});

window.addEventListener('popstate', handleRouting);
window.onscroll = handleScrollEffect;

/* --- CORE SYSTEM FUNCTIONS --- */

// 1. API Fetcher dengan Anti-Crash
async function api(endpoint) {
    const targetUrl = endpoint.startsWith('http') ? endpoint : API_BASE + endpoint;
    const finalUrl = API_PROXY + encodeURIComponent(targetUrl);
    
    try {
        const res = await fetch(finalUrl);
        if(!res.ok) throw new Error("Server Response Error");
        
        const json = await res.json();
        
        // Normalize Data (Karena struktur API bisa berubah-ubah)
        if (json.data) return json.data;
        if (json.success && json.result) return json.result;
        if (Array.isArray(json)) return json;
        return json; // Return raw jika format tidak dikenal
        
    } catch (e) {
        console.error("API Error:", e);
        showToast("Koneksi bermasalah, coba refresh.", "error");
        return null; // Return null biar logic halaman bisa handle fallback
    }
}

// 2. Routing System
async function handleRouting() {
    const path = window.location.pathname;
    resetUI();
    
    // UUID Router Handler
    if (path.startsWith('/chapter')) {
        const id = path.split('/')[2];
        readChapter(id, null, false);
    } 
    else if (path.startsWith('/series')) {
        const id = path.split('/')[2];
        showDetail(id, false);
    }
    // Static Pages
    else if (path === '/ongoing') showList('/list?status=Ongoing&orderby=popular', 'Komik Ongoing');
    else if (path === '/completed') showList('/list?status=Completed&orderby=popular', 'Komik Tamat');
    else if (path === '/history') showHistory();
    else if (path === '/bookmarks') showBookmarks();
    else showHome(false);
}

// 3. UUID Resolver (Komunikasi dengan Backend Anda)
async function resolveSlug(input) {
    if(input && input.length === 36) { // Jika UUID
        try {
            const res = await fetch(`${BACKEND_URL}/api/get-slug/${input}`);
            if(res.ok) return (await res.json()).slug;
        } catch(e) {} 
    }
    return input; // Jika bukan UUID, return as is
}

function registerUuid(slug, type) {
    fetch(`${BACKEND_URL}/api/get-id`, {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, type})
    }).then(r=>r.json()).then(d=>{
        if(d.uuid) history.replaceState(null,null,`/${type}/${d.uuid}`);
    }).catch(()=>{});
}


/* --- HALAMAN: HOME --- */

async function showHome(push = true) {
    if(push) updateURL('/');
    renderLoading("Menyiapkan Komik Terbaik...");
    document.title = "FmcComic - Baca Komik Gratis";

    const data = await api('/home');
    if (!data) return renderError("Gagal Memuat Home", "Cek koneksi internet anda atau coba refresh.");

    // Data Safeguard
    const slides = (data.hotUpdates || []).slice(0, 8); // Ambil 8 hot untuk slider
    const latest = data.latestReleases || [];
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');

    let html = '';

    // A. HERO SLIDER
    if (slides.length > 0) {
        html += `
        <div class="swiper mySwiper w-full h-[55vh] md:h-[65vh] bg-[#050505] group">
            <div class="swiper-wrapper">
                ${slides.map(item => `
                    <div class="swiper-slide relative w-full h-full cursor-pointer overflow-hidden" onclick="showDetail('${item.slug}')">
                        <img src="${item.image}" class="absolute inset-0 w-full h-full object-cover opacity-60 transition duration-[10s] group-hover:scale-105">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent"></div>
                        <div class="absolute bottom-0 left-0 w-full p-6 md:p-12 z-20 flex flex-col justify-end h-full">
                            <div class="container mx-auto">
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shadow-lg shadow-amber-500/20">Hot</span>
                                    <span class="text-gray-300 text-xs font-bold border border-white/20 px-2 py-0.5 rounded bg-black/30 backdrop-blur">${item.type||'Manga'}</span>
                                </div>
                                <h2 class="text-3xl md:text-5xl font-black text-white leading-tight mb-2 drop-shadow-xl line-clamp-2">${item.title}</h2>
                                <div class="flex items-center gap-4 text-xs font-bold text-gray-300">
                                    <span class="text-amber-400 flex items-center gap-1"><i class="fa fa-book-open"></i> ${item.chapter || item.latestChapter}</span>
                                    <span>•</span>
                                    <span>Updated Today</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="swiper-pagination !bottom-6 md:!bottom-12 md:!left-12 md:!w-auto container mx-auto px-4"></div>
        </div>
        `;
    }

    // B. CONTAINER START
    html += `<div class="container mx-auto px-4 -mt-8 relative z-30 pb-24 space-y-10">`;

    // C. HISTORY STRIP (Jika ada)
    if (history.length > 0) {
        html += `
        <div class="animate-fade-in">
            <div class="flex items-center gap-2 mb-3 text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                <i class="fa fa-clock-rotate-left text-amber-500"></i> Lanjutkan Baca
            </div>
            <div class="flex overflow-x-auto gap-3 hide-scroll pb-2">
                ${history.slice(0, 10).map(h => `
                    <div onclick="readChapter('${h.lastChapterSlug}', '${h.slug}')" 
                        class="min-w-[220px] bg-[#1a1a1d] p-2.5 rounded-xl border border-white/5 flex gap-3 cursor-pointer hover:border-amber-500/50 hover:bg-[#202024] transition group">
                        <img src="${h.image}" class="w-10 h-14 rounded object-cover shadow-sm bg-gray-800">
                        <div class="flex flex-col justify-center overflow-hidden">
                            <h4 class="text-xs font-bold text-gray-200 truncate group-hover:text-amber-500 transition mb-1">${h.title}</h4>
                            <span class="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded w-max border border-amber-500/10">${h.lastChapterTitle || 'Lanjut'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // D. LATEST UPDATE GRID
    html += `
        <div class="animate-fade-in">
            <div class="flex items-center justify-between mb-6 border-l-4 border-amber-500 pl-4">
                <h2 class="text-xl font-bold text-white">Rilis Terbaru</h2>
                <button onclick="showOngoing()" class="text-xs text-gray-400 hover:text-white transition">Lihat Semua</button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                ${latest.map(item => renderCard(item)).join('')}
            </div>
            
            <div class="mt-10 flex justify-center">
                 <button onclick="showList('/list?orderby=popular','Semua Komik')" class="group relative px-8 py-3 rounded-full bg-white/5 border border-white/10 overflow-hidden transition-all hover:border-amber-500/50">
                    <span class="relative z-10 text-xs font-bold group-hover:text-amber-500 transition">Lihat Lebih Banyak</span>
                 </button>
            </div>
        </div>
    </div>`;

    dom.content.innerHTML = html;

    // Init Slider
    if (slides.length > 0) {
        new Swiper(".mySwiper", {
            loop: true,
            effect: 'fade',
            speed: 1000,
            autoplay: { delay: 5000, disableOnInteraction: false },
            pagination: { el: ".swiper-pagination", clickable: true },
        });
    }
}


/* --- HALAMAN: DETAIL KOMIK --- */

async function showDetail(idOrSlug, push = true) {
    renderLoading();
    
    // Resolve Slug jika UUID
    let slug = await resolveSlug(idOrSlug);
    
    if (push) {
        updateURL(`/series/${slug}`);
        registerUuid(slug, 'series'); // Async backend sync
    }

    const data = await api(`/detail/${slug}`);
    if (!data) return renderError("Data Tidak Ditemukan", "Komik ini mungkin sudah dihapus atau error dari sumber.");

    // Update App State
    appState.comicData = data;
    document.title = `${data.title} - FmcComic`;
    setMetaColor('#f59e0b');

    // Local Data Checks
    const savedBookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const isBookmarked = savedBookmarks.some(b => b.slug === slug);
    
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const historyItem = history.find(h => h.slug === slug);
    
    // Logic Chapter Start
    const chapters = data.chapters || [];
    const hasChapters = chapters.length > 0;
    
    // Logic Tombol Baca: Jika pernah baca, lanjut. Jika tidak, chapter 1.
    const lastChSlug = historyItem ? historyItem.lastChapterSlug : null;
    const firstChSlug = hasChapters ? chapters[chapters.length - 1].slug : null; // Biasanya array desc
    
    let btnAction = `showToast('Chapter Kosong', 'error')`;
    let btnText = "Belum Ada Chapter";

    if (lastChSlug) {
        btnAction = `readChapter('${lastChSlug}', '${slug}')`;
        btnText = "Lanjut Baca";
    } else if (firstChSlug) {
        btnAction = `readChapter('${firstChSlug}', '${slug}')`;
        btnText = "Mulai Baca Ch. 1";
    }

    // RENDER HTML
    dom.content.innerHTML = `
    <!-- Cinematic Header Background -->
    <div class="relative h-[45vh] w-full overflow-hidden">
        <div class="absolute inset-0 bg-[#0a0a0c]"></div>
        <img src="${data.image}" class="w-full h-full object-cover opacity-20 blur-xl scale-110">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent"></div>
    </div>

    <div class="container mx-auto px-4 -mt-40 relative z-10 pb-20">
        <div class="flex flex-col md:flex-row gap-8 lg:gap-12">
            
            <!-- Left: Poster & Action Buttons -->
            <div class="w-[240px] md:w-[280px] shrink-0 mx-auto md:mx-0 flex flex-col gap-4">
                <div class="relative rounded-xl overflow-hidden shadow-2xl border-4 border-[#161619] group">
                    <img src="${data.image}" class="w-full h-auto object-cover aspect-[2/3] group-hover:scale-105 transition duration-500">
                    <span class="absolute top-3 left-3 bg-black/80 backdrop-blur border border-white/10 text-amber-500 text-xs font-bold px-2 py-1 rounded">
                        <i class="fa fa-star"></i> ${data.rating}
                    </span>
                </div>
                
                <button onclick="${btnAction}" class="amber-gradient w-full py-4 rounded-xl font-bold text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-95 transition flex justify-center items-center gap-2">
                    <i class="fa fa-book-open"></i> ${btnText}
                </button>
                
                <button id="bookmark-btn" onclick="toggleBookmark('${slug}', \`${data.title.replace(/'/g, "")}\`, '${data.image}')" 
                    class="w-full py-3.5 rounded-xl font-bold border transition flex justify-center items-center gap-2 ${isBookmarked ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-[#1a1a1d] border-white/10 text-gray-400 hover:text-white hover:bg-white/5'}">
                    <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                    <span>${isBookmarked ? 'Tersimpan' : 'Bookmark'}</span>
                </button>
            </div>

            <!-- Right: Info & Chapter List -->
            <div class="flex-1 min-w-0">
                <h1 class="text-3xl md:text-5xl font-black text-white leading-tight mb-4 text-center md:text-left">${data.title}</h1>
                
                <div class="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                    <span class="px-3 py-1 bg-[#1a1a1d] border border-white/10 rounded-lg text-xs font-bold text-blue-400 uppercase tracking-wider">${data.type}</span>
                    <span class="px-3 py-1 bg-[#1a1a1d] border border-white/10 rounded-lg text-xs font-bold ${data.status.toLowerCase()==='ongoing'?'text-green-500':'text-red-500'} uppercase tracking-wider">${data.status}</span>
                </div>

                <div class="bg-[#1a1a1d] rounded-2xl p-6 border border-white/5 mb-8">
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sinopsis</h3>
                    <p class="text-gray-300 text-sm leading-relaxed text-justify md:text-left font-light">
                        ${data.synopsis || "Tidak ada deskripsi tersedia."}
                    </p>
                    <div class="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/5">
                        ${(data.genres || []).map(g => `<span class="text-[10px] bg-black/30 text-gray-400 border border-white/10 px-2 py-1 rounded hover:text-white transition cursor-default">${g.title}</span>`).join('')}
                    </div>
                </div>

                <div class="bg-[#1a1a1d] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[600px]">
                    <div class="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0">
                        <div class="flex items-center gap-2">
                             <h3 class="font-bold text-white">List Chapter</h3>
                             <span class="text-xs bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded">${chapters.length}</span>
                        </div>
                        <input type="text" onkeyup="filterChapterList(this.value)" placeholder="Cari Ch..." class="w-32 md:w-48 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 transition text-white">
                    </div>
                    
                    <div class="overflow-y-auto p-2 space-y-1 flex-1 custom-scrollbar">
                        ${chapters.length > 0 ? chapters.map(c => `
                            <div class="chapter-row flex justify-between items-center p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 transition group ${lastChSlug === c.slug ? 'bg-amber-500/10 border-amber-500/20' : ''}"
                                 onclick="readChapter('${c.slug}', '${slug}')">
                                <span class="text-sm font-semibold text-gray-300 group-hover:text-amber-500 ${lastChSlug === c.slug ? 'text-amber-500' : ''} truncate max-w-[70%]">
                                    ${c.title}
                                </span>
                                <span class="text-[10px] text-gray-600 font-medium">${c.time || ''}</span>
                            </div>
                        `).join('') : '<div class="p-10 text-center text-gray-500">Belum ada chapter.</div>'}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}


/* --- HALAMAN: READER (BACA KOMIK) --- */

async function readChapter(idOrSlug, comicSlug, push = true) {
    if (appState.isNavigating) return;
    appState.isNavigating = true;

    // Loading Fullscreen Clean
    dom.content.innerHTML = `
    <div class="fixed inset-0 bg-[#0a0a0c] z-[55] flex flex-col items-center justify-center gap-4">
        <div class="w-12 h-12 border-4 border-[#202020] border-t-amber-500 rounded-full animate-spin"></div>
        <p class="text-amber-500 text-xs font-bold animate-pulse tracking-widest">MEMUAT GAMBAR...</p>
    </div>`;
    dom.navs.main.classList.add('-translate-y-full'); // Sembunyikan Nav Utama

    try {
        let slug = await resolveSlug(idOrSlug);

        if (push) {
            updateURL(`/chapter/${slug}`);
            registerUuid(slug, 'chapter');
        }

        const data = await api(`/chapter/${slug}`);
        if (!data || !data.images) throw new Error("Gagal memuat gambar chapter.");

        const parentSlug = comicSlug || data.comic_slug || (data.relation?.slug) || 'home';
        const comicTitle = appState.comicData ? appState.comicData.title : (data.comic_title || 'Komik');
        const chapterTitle = data.title || "Chapter";

        // Update History (Mencegah Duplicate)
        let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
        history = history.filter(h => h.slug !== parentSlug); // Hapus entri lama untuk komik ini
        history.unshift({
            slug: parentSlug,
            title: comicTitle,
            image: appState.comicData ? appState.comicData.image : 'assets/icon.png',
            lastChapterSlug: slug,
            lastChapterTitle: chapterTitle,
            timestamp: Date.now()
        });
        localStorage.setItem('fmc_history', JSON.stringify(history.slice(0, 50)));

        // RENDER READER UI
        dom.content.innerHTML = `
        <div id="reader-wrapper" class="min-h-screen bg-[#0a0a0c] pb-24 relative select-none">
            
            <!-- A. Top Bar -->
            <div id="reader-header" class="fixed top-0 w-full z-[60] bg-[#0a0a0c]/90 backdrop-blur border-b border-white/5 p-3 flex justify-between items-center transition-transform duration-300">
                <div class="flex items-center gap-3 overflow-hidden">
                    <button onclick="showDetail('${parentSlug}')" class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-amber-500 hover:text-black transition text-white">
                        <i class="fa fa-arrow-left"></i>
                    </button>
                    <div class="flex flex-col truncate">
                        <h3 class="text-[10px] text-amber-500 font-bold uppercase truncate max-w-[200px]">${comicTitle}</h3>
                        <span class="text-xs font-bold text-gray-200 truncate">${chapterTitle}</span>
                    </div>
                </div>
                <button onclick="toggleReaderSettings()" class="w-10 h-10 text-gray-400 hover:text-white flex items-center justify-center">
                    <i class="fa fa-gear"></i>
                </button>
            </div>

            <!-- B. Canvas Images -->
            <div id="image-container" class="pt-16 min-h-screen flex flex-col items-center cursor-pointer" onclick="toggleReaderUI()">
                ${data.images.map(url => `
                    <div class="relative w-full min-h-[300px] bg-[#111] mb-0.5">
                        <img src="${url}" loading="lazy" 
                             class="relative z-10 w-full h-auto opacity-0 transition-opacity duration-300" 
                             onload="this.classList.remove('opacity-0');this.parentElement.style.minHeight='auto'">
                        <div class="absolute inset-0 flex items-center justify-center z-0 text-gray-700">
                            <i class="fa fa-spinner fa-spin"></i>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- C. Bottom Nav -->
            <div id="reader-footer" class="fixed bottom-0 w-full z-[60] p-5 flex justify-center transition-transform duration-300">
                <div class="glass px-2 py-2 rounded-2xl flex items-center gap-2 shadow-2xl bg-[#0a0a0c]/90 border border-white/10">
                    <button ${data.navigation?.prev ? `onclick="readChapter('${data.navigation.prev}', '${parentSlug}')"` : 'disabled class="opacity-20 cursor-not-allowed"'} 
                        class="w-12 h-11 flex items-center justify-center hover:bg-white/10 rounded-xl text-white transition">
                        <i class="fa fa-chevron-left"></i>
                    </button>
                    
                    <button onclick="showDetail('${parentSlug}')" class="px-4 flex flex-col items-center">
                        <i class="fa fa-list text-xs mb-1 text-gray-400"></i>
                        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Detail</span>
                    </button>

                    <button ${data.navigation?.next ? `onclick="readChapter('${data.navigation.next}', '${parentSlug}')"` : `onclick="showDetail('${parentSlug}')"`} 
                        class="w-12 h-11 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black rounded-xl shadow-lg transition">
                        <i class="fa ${data.navigation?.next ? 'fa-chevron-right' : 'fa-check'}"></i>
                    </button>
                </div>
            </div>

        </div>`;

        // Apply saved settings (Fit Mode)
        applyReaderSettings(); 
        window.scrollTo(0,0);
        appState.isNavigating = false;

    } catch (error) {
        console.error(error);
        renderError("Gagal Memuat Chapter", "Terjadi kesalahan saat mengambil gambar. Silakan kembali.");
        dom.navs.main.classList.remove('-translate-y-full'); // Munculkan nav lagi
        appState.isNavigating = false;
    }
}


/* --- LIST & FILTER SYSTEM --- */

async function showList(urlEndpoint, titlePage) {
    if(window.location.pathname !== urlEndpoint.split('?')[0]) {
        if(urlEndpoint.includes('Ongoing')) updateURL('/ongoing');
        else if(urlEndpoint.includes('Completed')) updateURL('/completed');
    }

    renderLoading(`Memuat ${titlePage}...`);

    const data = await api(urlEndpoint);
    const list = Array.isArray(data) ? data : (data?.data || []);
    
    if (list.length === 0) return renderError(titlePage, "Tidak ada komik ditemukan.");

    // Simple Pagination extraction
    const currentUrl = new URL(API_BASE + urlEndpoint);
    const page = parseInt(currentUrl.searchParams.get('page')) || 1;
    // URL dasar tanpa page
    const baseUrl = urlEndpoint.replace(/&page=\d+/, '').replace(/\/page\/\d+/, '');
    
    // Nav Handler (Next only/Prev Logic simpel)
    // Asumsi endpoint standar nekolabs
    const prevFunc = page > 1 ? `showList('${baseUrl}&page=${page-1}', '${titlePage}')` : '';
    const nextFunc = `showList('${baseUrl}&page=${page+1}', '${titlePage}')`;

    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8 pt-20">
        <h2 class="text-2xl font-bold text-white mb-8 border-l-4 border-amber-500 pl-4">${titlePage}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5 animate-fade-in">
            ${list.map(item => renderCard(item)).join('')}
        </div>
        
        <div class="mt-12 flex justify-center items-center gap-4">
            <button onclick="${prevFunc}" ${page===1 ? 'disabled class="opacity-0 pointer-events-none"' : 'class="px-5 py-2 bg-[#1a1a1d] border border-white/10 rounded-lg font-bold text-xs hover:text-amber-500"'}>Prev</button>
            <span class="text-sm font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded">Page ${page}</span>
            <button onclick="${nextFunc}" class="px-5 py-2 bg-[#1a1a1d] border border-white/10 rounded-lg font-bold text-xs hover:bg-amber-500 hover:text-black hover:border-transparent transition">Next</button>
        </div>
    </div>`;
}

function renderCard(item) {
    // Styling label berdasarkan tipe
    let typeClass = "text-gray-400 bg-gray-500/20 border-gray-500/30";
    const type = (item.type || '').toLowerCase();
    if(type.includes('manga')) typeClass = "text-blue-400 bg-blue-500/10 border-blue-500/30";
    if(type.includes('manhwa')) typeClass = "text-green-400 bg-green-500/10 border-green-500/30";
    if(type.includes('manhua')) typeClass = "text-pink-400 bg-pink-500/10 border-pink-500/30";

    const ch = item.chapter || item.latestChapter || (item.chapters?.[0]?.title) || 'Up';

    return `
    <div class="group cursor-pointer relative" onclick="showDetail('${item.slug}')">
        <div class="relative aspect-[3/4] bg-[#161619] rounded-xl overflow-hidden border border-white/5 mb-3 group-hover:border-amber-500/40 transition">
            <img src="${item.image}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
            <span class="absolute top-2 right-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded border backdrop-blur ${typeClass} z-10">${item.type||'Comic'}</span>
            
            <div class="absolute bottom-2 left-2 max-w-full z-10">
                <span class="text-[9px] font-bold text-black bg-amber-500 px-2 py-0.5 rounded shadow-lg truncate block">${ch}</span>
            </div>
            
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
        </div>
        <h3 class="font-bold text-sm text-gray-200 leading-tight group-hover:text-amber-500 transition line-clamp-2">${item.title}</h3>
    </div>`;
}

// Handler Search
function applyAdvancedFilter() {
    const q = document.getElementById('search-input').value;
    const g = document.getElementById('filter-genre').value;
    
    dom.filterPanel.classList.add('hidden');
    if (q) showList(`/search/${encodeURIComponent(q)}/1`, `Pencarian "${q}"`);
    else if(g) showList(`/genre/${g}/1`, `Genre: ${g}`);
    else {
        // Build URL Filter
        const type = document.getElementById('filter-type').value;
        const status = document.getElementById('filter-status').value;
        let p = `/list?orderby=popular&page=1`;
        if(type) p+=`&type=${type}`;
        if(status) p+=`&status=${status}`;
        showList(p, "Hasil Filter");
    }
}

/* --- FITUR: HISTORY & BOOKMARKS --- */

async function showBookmarks(push=true) {
    if(push) updateURL('/bookmarks');
    const b = JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]');
    if(b.length === 0) return renderError("Bookmark Kosong", "Tandai komik favoritmu agar muncul disini.");

    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-20">
        <h2 class="text-xl font-bold mb-8 text-white flex items-center gap-2"><i class="fa fa-bookmark text-amber-500"></i> Bookmark Anda</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            ${b.map(i => renderCard({...i, type:'Saved', chapter:'Baca'})).join('')}
        </div>
    </div>`;
}

async function showHistory(push=true) {
    if(push) updateURL('/history');
    const h = JSON.parse(localStorage.getItem('fmc_history')||'[]');
    if(h.length === 0) return renderError("Riwayat Kosong", "Ayo mulai baca komik dulu!");

    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-20">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold flex items-center gap-2"><i class="fa fa-history text-amber-500"></i> Riwayat Baca</h2>
            <button onclick="localStorage.removeItem('fmc_history');showHistory()" class="text-xs text-red-500 border border-red-500/30 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition">Hapus Semua</button>
        </div>
        <div class="grid gap-3">
            ${h.map(i => `
                <div class="bg-[#161619] p-3 rounded-xl flex gap-4 cursor-pointer hover:bg-white/5 border border-white/5" onclick="readChapter('${i.lastChapterSlug}','${i.slug}')">
                    <img src="${i.image}" class="w-16 h-24 object-cover rounded bg-black">
                    <div class="flex flex-col justify-center">
                        <h3 class="font-bold text-gray-200 text-sm md:text-base">${i.title}</h3>
                        <p class="text-xs text-gray-500 mt-1">Lanjut: <span class="text-amber-500">${i.lastChapterTitle}</span></p>
                        <span class="text-[10px] text-gray-600 mt-2">${new Date(i.timestamp || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

function toggleBookmark(slug, title, image) {
    let b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const index = b.findIndex(x => x.slug === slug);
    const btn = document.getElementById('bookmark-btn'); // For detail page

    if (index !== -1) {
        b.splice(index, 1);
        if (btn) {
            btn.classList.remove('bg-amber-500/10', 'border-amber-500', 'text-amber-500');
            btn.classList.add('bg-[#1a1a1d]', 'border-white/10', 'text-gray-400');
            btn.innerHTML = `<i class="fa-regular fa-bookmark"></i><span>Bookmark</span>`;
        }
        showToast("Dihapus dari bookmark");
    } else {
        b.push({ slug, title, image, addedAt: Date.now() });
        if (btn) {
            btn.classList.add('bg-amber-500/10', 'border-amber-500', 'text-amber-500');
            btn.classList.remove('bg-[#1a1a1d]', 'border-white/10', 'text-gray-400');
            btn.innerHTML = `<i class="fa-solid fa-bookmark"></i><span>Tersimpan</span>`;
        }
        showToast("Tersimpan di bookmark!", "success");
    }
    localStorage.setItem('fmc_bookmarks', JSON.stringify(b));
}

/* --- UTILITIES & HELPER --- */

// Toggle Element Helpers
function updateURL(path) { if (window.location.pathname !== path) history.pushState(null, null, path); }
function toggleFilter() { dom.filterPanel.classList.toggle('hidden'); }
function filterChapterList(v) { document.querySelectorAll('.chapter-row').forEach(e => e.style.display = e.textContent.toLowerCase().includes(v.toLowerCase()) ? "flex" : "none"); }

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    const color = type === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black';
    toast.className = `p-4 rounded-xl shadow-2xl backdrop-blur font-bold text-xs flex items-center gap-2 animate-fade-in ${color} min-w-[200px] pointer-events-auto`;
    toast.innerHTML = `<i class="fa ${type==='error'?'fa-times-circle':'fa-check-circle'}"></i> ${msg}`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = 0; 
        setTimeout(() => toast.remove(), 500); 
    }, 3000);
}

// Reset scroll & state UI when route change
function resetUI() {
    dom.navs.main.classList.remove('-translate-y-full');
    dom.navs.mobile.classList.remove('translate-y-full');
    dom.overlay.style.opacity = (100 - appState.settings.brightness) / 100;
}

function handleScrollEffect() {
    const scrollBtn = document.getElementById('scroll-top');
    const s = window.scrollY;
    
    if (s > 400) {
        scrollBtn.classList.remove('opacity-0', 'translate-y-24');
        scrollBtn.classList.add('translate-y-0', 'opacity-100');
    } else {
        scrollBtn.classList.add('opacity-0', 'translate-y-24');
        scrollBtn.classList.remove('translate-y-0', 'opacity-100');
    }
    
    if(dom.navs.main) {
        if(s > 20) dom.navs.main.classList.add('bg-[#0a0a0c]/90', 'shadow-md', 'backdrop-blur-md');
        else dom.navs.main.classList.remove('bg-[#0a0a0c]/90', 'shadow-md', 'backdrop-blur-md');
    }
}

function loadGenres() {
    api('/genres').then(data => {
        if(data && Array.isArray(data)){
            const el = document.getElementById('filter-genre');
            data.sort((a,b)=>a.title.localeCompare(b.title)).forEach(g=>{
                const opt=document.createElement('option'); opt.value=g.slug; opt.text=g.title; el.appendChild(opt);
            });
        }
    });
}

// Render Utils
function renderLoading(text = "Memuat...") {
    dom.content.innerHTML = `
    <div class="h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div class="w-10 h-10 border-4 border-amber-900 border-t-amber-500 rounded-full animate-spin"></div>
        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest animate-pulse">${text}</p>
    </div>`;
}

function renderError(title, desc) {
    dom.content.innerHTML = `
    <div class="h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <i class="fa fa-triangle-exclamation text-3xl text-red-500 mb-2"></i>
        <h3 class="text-xl font-bold text-white">${title}</h3>
        <p class="text-gray-500 text-sm max-w-sm mb-6">${desc}</p>
        <button onclick="showHome()" class="px-6 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-xs font-bold transition">Ke Beranda</button>
    </div>`;
}

// Set Theme/Meta for Mobile Chrome
function setMetaColor(c) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if(!meta){ meta=document.createElement('meta'); meta.name="theme-color"; document.head.appendChild(meta); }
    meta.content = c;
}

/* --- READER SETTINGS: FIT WIDTH & BRIGHTNESS --- */

// Fungsi untuk membuka/menutup modal
function toggleReaderSettings() {
    dom.settingsModal.classList.toggle('hidden');
    // Jika terbuka, animasikan
    if (!dom.settingsModal.classList.contains('hidden')) {
        dom.settingsModal.classList.remove('scale-90', 'opacity-0');
        dom.settingsModal.classList.add('scale-100', 'opacity-100');
    } else {
        dom.settingsModal.classList.add('scale-90', 'opacity-0');
        dom.settingsModal.classList.remove('scale-100', 'opacity-100');
    }
}

// Toggle Fit Width vs Original
function toggleImageFit() {
    appState.settings.fitMode = appState.settings.fitMode === 'contain' ? 'original' : 'contain';
    saveSettings();
    applyReaderSettings();
}

// Update Slider Value
function changeBrightness(val) {
    appState.settings.brightness = val;
    const txt = document.getElementById('bright-val');
    if (txt) txt.innerText = val + "%";
    saveSettings();
    applyReaderSettings();
}

function saveSettings() {
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
}

// Aplikasi setting ke UI DOM yang sebenarnya
function applyReaderSettings() {
    const container = document.getElementById('image-container');
    const overlay = document.getElementById('brightness-overlay');
    const btn = document.getElementById('btn-fit-toggle');
    const slider = document.getElementById('brightness-slider');
    
    // 1. Terapkan Mode Fit
    if (container) {
        if (appState.settings.fitMode === 'original') {
            container.classList.remove('max-w-4xl', 'mx-auto', 'px-4'); // Original full width
            if(btn) {
                btn.innerText = "Original";
                btn.classList.add('bg-amber-500', 'text-black');
            }
        } else {
            container.classList.add('max-w-4xl', 'mx-auto', 'px-0'); // Fit container
            if(btn) {
                btn.innerText = "Fit Width";
                btn.classList.remove('bg-amber-500', 'text-black');
            }
        }
    }

    // 2. Terapkan Brightness Overlay
    if (overlay) {
        const opacity = (100 - appState.settings.brightness) / 100;
        overlay.style.opacity = opacity;
        // Agar overlay tidak mengganggu klik jika 100% (transparent), set pointer events
        overlay.style.pointerEvents = opacity > 0 ? 'auto' : 'none'; 
    }

    // 3. Update UI Slider (jika sedang dibuka)
    if (slider) {
        slider.value = appState.settings.brightness;
        document.getElementById('bright-val').innerText = appState.settings.brightness + '%';
    }
}

function toggleReaderUI() {
    const h = document.getElementById('reader-header');
    const f = document.getElementById('reader-footer');
    if(h) h.classList.toggle('-translate-y-full');
    if(f) f.classList.toggle('translate-y-[150%]');
}
