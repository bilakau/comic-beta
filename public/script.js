/*
  FmcComic Final Stable - v3.0
  Fix: Infinite Loading pada Home & Detail
  Fix: Logic Data Null Check
*/

// Opsi Proxy (Gunakan backup jika utama gagal)
const PROXY_MAIN = "https://corsproxy.io/?";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

let appState = {
    isNavigating: false,
    comicData: null,
    settings: JSON.parse(localStorage.getItem('fmc_settings') || '{"fitMode": "contain", "brightness": 100}')
};

const dom = {
    content: document.getElementById('content-area'),
    progressBar: document.getElementById('progress-bar'),
    filterPanel: document.getElementById('filter-panel'),
    toastContainer: document.getElementById('toast-container'),
    navs: { main: document.getElementById('main-nav'), mobile: document.getElementById('mobile-nav') }
};

/* --- SYSTEM --- */

document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    applySettings(); // Load brightness settings
    handleRouting();
    
    // Close filter on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#filter-panel') && !e.target.closest('[onclick="toggleFilter()"]')) {
            dom.filterPanel.classList.add('hidden');
        }
    });
});

window.addEventListener('popstate', handleRouting);

/* --- CORE FUNCTIONS --- */

// Fungsi API yang Jauh Lebih Aman (Error Handling)
async function api(endpoint) {
    // 1. Cek apakah Endpoint sudah full URL atau path
    const urlTarget = endpoint.startsWith('http') ? endpoint : (API_BASE + endpoint);
    const finalUrl = PROXY_MAIN + encodeURIComponent(urlTarget);

    try {
        console.log(`[API] Fetching: ${endpoint}`);
        const res = await fetch(finalUrl);
        if(!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const json = await res.json();
        
        // Logika Ekstraksi Data yang Fleksibel (Penyebab Loading Terus biasanya disini)
        if (json.data) return json.data;
        if (json.success && json.result) return json.result;
        if (json.content) return json.content;
        return json; // Fallback return raw
        
    } catch (e) {
        console.error("[API Fail]", e);
        showToast("Gagal memuat data server.", "error");
        return null;
    }
}

// Update URL tanpa reload
function updateURL(path) {
    if (window.location.pathname !== path) history.pushState(null, null, path);
}

// Logic UUID Backend
async function resolveSlug(input) {
    if (input.length === 36) { // Kalau format UUID
        try {
            const res = await fetch(`${BACKEND_URL}/api/get-slug/${input}`);
            if(res.ok) {
                const json = await res.json();
                return json.slug;
            }
        } catch(e) { console.error(e); }
    }
    return input; // Kalau bukan UUID atau gagal, return as-is
}

async function registerUuid(slug, type) {
    // Jalankan di background, jangan await/blocking UI
    fetch(`${BACKEND_URL}/api/get-id`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, type})
    }).then(res => res.json())
      .then(data => {
          if(data.uuid) history.replaceState(null, null, (type === 'series' ? '/series/' : '/chapter/') + data.uuid);
      })
      .catch(() => {}); // Silent fail is fine, URL stays slug
}


/* --- PAGE ROUTING --- */

async function handleRouting() {
    const path = window.location.pathname;
    
    // Reset UI State
    dom.navs.main.classList.remove('-translate-y-full');
    dom.navs.mobile.classList.remove('translate-y-full');
    
    if (path.startsWith('/chapter')) {
        const id = path.split('/')[2];
        readChapter(id, null, false);
    } 
    else if (path.startsWith('/series')) {
        const id = path.split('/')[2];
        showDetail(id, false);
    }
    else if (path === '/ongoing') showList('/list?status=Ongoing&orderby=popular', 'Komik Ongoing');
    else if (path === '/completed') showList('/list?status=Completed&orderby=popular', 'Komik Tamat');
    else if (path === '/history') showHistory();
    else if (path === '/bookmarks') showBookmarks();
    else showHome(false);
}


/* --- HOME PAGE --- */

async function showHome(push = true) {
    if(push) updateURL('/');
    renderLoading();
    document.title = "FmcComic - Home";

    try {
        const data = await api('/home');
        
        // PENTING: Cek Data valid tidak
        if (!data || (!data.hotUpdates && !data.latestReleases)) {
            throw new Error("Data home kosong/struktur berubah");
        }

        // Ambil data dengan fallback array kosong biar gak crash
        const slides = (data.hotUpdates || []).slice(0, 6);
        const latest = data.latestReleases || [];
        const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');

        // 1. Build Hero HTML
        let sliderHTML = '';
        if(slides.length > 0) {
            sliderHTML = `
            <div class="swiper mySwiper w-full h-[50vh] md:h-[60vh] bg-black">
                <div class="swiper-wrapper">
                    ${slides.map(item => `
                        <div class="swiper-slide relative cursor-pointer group" onclick="showDetail('${item.slug}')">
                            <img src="${item.image}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition duration-700">
                            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-black/40 to-transparent"></div>
                            <div class="absolute bottom-10 left-0 w-full px-4 md:px-10 z-20">
                                <span class="text-[10px] bg-amber-500 text-black px-2 py-1 rounded font-bold uppercase mb-2 inline-block shadow">Trending</span>
                                <h2 class="text-2xl md:text-4xl font-black text-white leading-tight line-clamp-2 drop-shadow-md mb-2">${item.title}</h2>
                                <p class="text-amber-400 text-xs font-bold"><i class="fa fa-book-open"></i> ${item.chapter || item.latestChapter}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="swiper-pagination"></div>
            </div>`;
        }

        // 2. Build History HTML
        let historyHTML = '';
        if(history.length > 0) {
            historyHTML = `
            <div class="mb-10 px-4">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i class="fa fa-clock text-amber-500"></i> Lanjut Baca
                </h3>
                <div class="flex overflow-x-auto gap-3 hide-scroll pb-2">
                    ${history.slice(0,8).map(h => `
                        <div class="min-w-[150px] bg-[#161619] border border-white/5 rounded-xl p-2 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition"
                             onclick="readChapter('${h.lastChapterSlug}', '${h.slug}')">
                            <img src="${h.image}" class="w-10 h-14 rounded bg-gray-800 object-cover">
                            <div class="overflow-hidden">
                                <h4 class="text-[10px] font-bold text-gray-300 truncate">${h.title}</h4>
                                <span class="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold">${h.lastChapterTitle || 'Lanjut'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        // 3. Build Latest HTML
        dom.content.innerHTML = `
            ${sliderHTML}
            <div class="container mx-auto pb-20 relative z-10 ${slides.length ? '-mt-6' : 'mt-20'}">
                ${historyHTML}
                <div class="px-4">
                    <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4 text-white">Rilis Terbaru</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5">
                        ${latest.map(item => cardTemplate(item)).join('')}
                    </div>
                    <div class="mt-8 text-center">
                        <button onclick="showList('/list?orderby=popular','All Comics')" class="px-6 py-2 border border-white/10 rounded-full hover:bg-amber-500 hover:text-black hover:border-transparent transition text-xs font-bold">Lihat Semua</button>
                    </div>
                </div>
            </div>
        `;

        // Init Swiper jika ada slide
        if(slides.length > 0) {
            setTimeout(() => {
                new Swiper(".mySwiper", {
                    loop: true,
                    effect: 'fade',
                    autoplay: { delay: 4000 },
                    pagination: { el: ".swiper-pagination", clickable: true }
                });
            }, 50);
        }

    } catch(err) {
        renderError("Gagal memuat Home", err.message);
    }
}


/* --- DETAIL PAGE --- */

async function showDetail(idOrSlug, push=true) {
    renderLoading();
    try {
        const slug = await resolveSlug(idOrSlug);
        
        // PUSH STATE DULU biar gak aneh, nanti diganti UUID di background
        if(push) updateURL(`/series/${slug}`);

        const data = await api(`/detail/${slug}`);
        if (!data) throw new Error("Data detail kosong");

        // Backend Sync (Background Process)
        if(push) registerUuid(slug, 'series');

        // Logic History/Bookmark
        appState.comicData = data;
        const bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
        const isSaved = bookmarks.some(b => b.slug === slug);
        const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
        const lastRead = history.find(h => h.slug === slug);

        // Logic Tombol Baca
        // Data chapters seringkali terbalik [Ch terbaru .... Ch 1], jadi ambil array terakhir utk Chapter 1
        // TAPI cek dulu arraynya ada gak.
        const chapters = data.chapters || [];
        const firstCh = chapters.length > 0 ? chapters[chapters.length-1].slug : null;
        const targetCh = lastRead ? lastRead.lastChapterSlug : firstCh;
        const btnText = lastRead ? `Lanjut: ${lastRead.lastChapterTitle}` : "Mulai Baca Chapter 1";
        const btnAction = targetCh ? `readChapter('${targetCh}', '${slug}')` : `showToast('Belum ada chapter', 'error')`;

        // RENDER
        dom.content.innerHTML = `
        <div class="relative h-[45vh] bg-black">
            <img src="${data.image}" class="w-full h-full object-cover opacity-30 blur-xl">
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent"></div>
        </div>

        <div class="container mx-auto px-4 -mt-32 pb-20 relative z-10">
            <div class="flex flex-col md:flex-row gap-8">
                <!-- Sisi Kiri: Gambar & Aksi -->
                <div class="w-full md:w-[260px] shrink-0 flex flex-col gap-3">
                    <img src="${data.image}" class="w-[200px] md:w-full mx-auto rounded-xl shadow-2xl border-4 border-[#161619]" />
                    
                    <button onclick="${btnAction}" class="amber-btn w-full py-3 rounded-xl font-bold text-black bg-amber-500 hover:bg-amber-400 shadow-lg flex justify-center items-center gap-2 hover:scale-[1.02] transition">
                        <i class="fa fa-book-open"></i> <span class="truncate max-w-[150px]">${btnText}</span>
                    </button>

                    <button id="bm-btn" onclick="toggleBookmark('${slug}', \`${data.title.replace(/'/g,'')}\`, '${data.image}')" 
                        class="w-full py-3 rounded-xl font-bold border transition flex justify-center items-center gap-2 
                        ${isSaved ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-[#161619] border-white/10 text-gray-400 hover:text-white'}">
                        <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i> <span>${isSaved?'Tersimpan':'Bookmark'}</span>
                    </button>
                </div>

                <!-- Sisi Kanan: Info & Chapter -->
                <div class="flex-1 min-w-0">
                    <h1 class="text-3xl md:text-5xl font-black text-white leading-tight mb-4">${data.title}</h1>
                    
                    <div class="flex flex-wrap gap-2 mb-6">
                        <span class="badge bg-[#161619] border border-white/10 text-amber-500"><i class="fa fa-star"></i> ${data.rating}</span>
                        <span class="badge bg-[#161619] border border-white/10 text-blue-400">${data.status}</span>
                        <span class="badge bg-[#161619] border border-white/10 text-white">${data.type}</span>
                    </div>

                    <p class="text-sm text-gray-300 leading-relaxed bg-[#161619] p-5 rounded-2xl border border-white/5 mb-6 text-justify">
                        ${data.synopsis || "Sinopsis belum tersedia."}
                    </p>

                    <!-- List Chapter -->
                    <div class="bg-[#161619] rounded-2xl border border-white/5 overflow-hidden">
                        <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 class="font-bold text-white text-sm">Daftar Chapter (${chapters.length})</h3>
                            <input type="text" placeholder="Cari..." onkeyup="searchChapter(this.value)" class="bg-black/30 border border-white/10 rounded-lg px-3 py-1 text-xs w-32 focus:w-auto focus:border-amber-500 outline-none transition-all">
                        </div>
                        <div class="max-h-[500px] overflow-y-auto p-2" id="chapter-list">
                            ${chapters.length ? chapters.map(c => `
                                <div class="chapter-item flex justify-between items-center p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent transition group ${lastRead && lastRead.lastChapterSlug === c.slug ? 'bg-amber-500/10 border-amber-500/30' : ''}"
                                     onclick="readChapter('${c.slug}', '${slug}')">
                                    <span class="text-sm font-semibold text-gray-400 group-hover:text-amber-500 ${lastRead && lastRead.lastChapterSlug === c.slug ? 'text-amber-500' : ''}">${c.title}</span>
                                    <span class="text-[10px] text-gray-600 bg-black/20 px-2 py-0.5 rounded">${c.time||'Read'}</span>
                                </div>
                            `).join('') : '<div class="p-5 text-center text-gray-500">Chapter Kosong</div>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.title = `${data.title} - FmcComic`;

    } catch (err) {
        renderError("Gagal Memuat Komik", err.message);
    }
}


/* --- READER PAGE (Ultra optimized) --- */

async function readChapter(idOrSlug, comicSlug, push=true) {
    // 1. Loading UI State
    dom.content.innerHTML = `
    <div class="fixed inset-0 bg-[#0a0a0c] z-[55] flex flex-col items-center justify-center">
        <div class="w-10 h-10 border-t-2 border-amber-500 border-r-2 border-r-amber-500 rounded-full animate-spin mb-4"></div>
        <span class="text-xs text-amber-500 font-bold tracking-widest animate-pulse">MEMUAT CHAPTER...</span>
    </div>`;
    dom.navs.main.classList.add('-translate-y-full'); 
    
    try {
        const slug = await resolveSlug(idOrSlug);
        if(push) updateURL(`/chapter/${slug}`);
        if(push) registerUuid(slug, 'chapter');

        const data = await api(`/chapter/${slug}`);
        
        // PENTING: Validation
        if(!data || !data.images || data.images.length === 0) {
            throw new Error("Gambar chapter tidak ditemukan atau rusak.");
        }

        const parent = comicSlug || data.comic_slug || (data.relation?.slug) || 'home';
        const title = data.title || "Unknown Chapter";
        
        // Save History
        let h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
        h = h.filter(x => x.slug !== parent); // remove duplicate
        h.unshift({ 
            slug: parent, 
            title: appState.comicData?.title || data.comic_title || 'Komik', 
            image: appState.comicData?.image || 'assets/icon.png', 
            lastChapterSlug: slug, 
            lastChapterTitle: title 
        });
        localStorage.setItem('fmc_history', JSON.stringify(h.slice(0, 50)));

        // RENDER READER HTML
        dom.content.innerHTML = `
        <div class="bg-[#050505] min-h-screen relative select-none">
            <!-- Reader Navbar -->
            <div id="reader-head" class="fixed top-0 inset-x-0 p-3 z-[60] bg-black/90 backdrop-blur border-b border-white/5 flex justify-between items-center transition-transform">
                <div class="flex items-center gap-3">
                    <button onclick="showDetail('${parent}')" class="w-9 h-9 flex items-center justify-center bg-white/10 rounded-full hover:bg-amber-500 hover:text-black transition">
                        <i class="fa fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xs md:text-sm font-bold text-gray-200 truncate max-w-[200px]">${title}</h2>
                </div>
                <button onclick="toggleReaderSettings()" class="w-9 h-9 text-gray-400 hover:text-white"><i class="fa fa-cog"></i></button>
            </div>

            <!-- Image Canvas -->
            <div id="image-canvas" class="flex flex-col items-center pt-16 pb-24 min-h-screen ${appState.settings.fitMode==='fit'?'max-w-4xl mx-auto':''}" onclick="toggleReaderNav()">
                ${data.images.map(url => `
                    <div class="relative w-full min-h-[400px] bg-[#101012] mb-0.5">
                        <img src="${url}" loading="lazy" 
                             class="relative z-10 w-full h-auto opacity-0 transition-opacity duration-300"
                             onload="this.classList.remove('opacity-0'); this.parentElement.style.minHeight='auto'"
                             onerror="this.src='https://placehold.co/600x800/101012/FFF?text=Image+Error'; this.classList.remove('opacity-0')">
                        <div class="absolute inset-0 flex items-center justify-center text-gray-700 -z-0">
                            <i class="fa fa-spinner fa-spin"></i>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Bottom Nav -->
            <div id="reader-foot" class="fixed bottom-0 inset-x-0 p-4 z-[60] flex justify-center transition-transform">
                <div class="glass px-2 py-2 rounded-xl flex items-center gap-3 shadow-2xl bg-[#101012]/90">
                    <button ${data.navigation?.prev ? `onclick="readChapter('${data.navigation.prev}', '${parent}')"` : 'disabled class="opacity-20"'} class="w-10 h-10 hover:bg-white/10 rounded-lg text-white"><i class="fa fa-chevron-left"></i></button>
                    <button onclick="showDetail('${parent}')" class="text-[10px] font-bold text-gray-400 px-2 uppercase tracking-widest hover:text-white">Back to List</button>
                    <button ${data.navigation?.next ? `onclick="readChapter('${data.navigation.next}', '${parent}')"` : 'disabled class="opacity-50"'} class="w-10 h-10 bg-amber-600 text-white rounded-lg hover:bg-amber-500 shadow-lg flex items-center justify-center">
                        <i class="fa fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
        applySettings();
        window.scrollTo(0,0);

    } catch(err) {
        // Fallback kalau detail parent slug hilang, balik home
        dom.content.innerHTML = `
            <div class="h-screen flex flex-col items-center justify-center gap-4 text-center">
                <i class="fa fa-bug text-4xl text-red-500"></i>
                <p class="text-gray-400">Error: ${err.message}</p>
                <button onclick="showHome()" class="px-6 py-2 bg-amber-500 rounded font-bold">Ke Beranda</button>
            </div>
        `;
        dom.navs.main.classList.remove('-translate-y-full');
    }
}


/* --- GENERIC LIST PAGES (List, Genre, Search) --- */

async function showList(endpointUrl, titlePage) {
    if(window.location.pathname !== endpointUrl.split('?')[0] && endpointUrl.includes('Ongoing')) updateURL('/ongoing');
    if(window.location.pathname !== endpointUrl.split('?')[0] && endpointUrl.includes('Completed')) updateURL('/completed');
    
    renderLoading();
    
    try {
        const data = await api(endpointUrl);
        const list = Array.isArray(data) ? data : (data?.data || []);
        
        if(!list.length) throw new Error("Tidak ditemukan komik.");
        
        // Pagination logic (Simplifikasi ambil page dari URL)
        const urlObj = new URL(API_BASE + endpointUrl);
        const currPage = parseInt(urlObj.searchParams.get('page')) || 1;
        const basePath = endpointUrl.split('&page')[0]; // simple trick

        const prevFunc = currPage > 1 ? `showList('${basePath}&page=${currPage-1}', '${titlePage}')` : '';
        const nextFunc = `showList('${basePath}&page=${currPage+1}', '${titlePage}')`; // Assume always next for infinite scroll UX

        dom.content.innerHTML = `
        <div class="container mx-auto px-4 py-8 mt-16">
            <h2 class="text-xl font-bold mb-6 text-white border-l-4 border-amber-500 pl-4">${titlePage} (Hal ${currPage})</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-5">
                ${list.map(item => cardTemplate(item)).join('')}
            </div>
            
            <div class="flex justify-center gap-4 py-10">
                <button onclick="${prevFunc}" ${currPage<=1?'disabled class="hidden"':''} class="px-6 py-2 bg-[#161619] rounded-lg border border-white/10 hover:border-amber-500 hover:text-amber-500 font-bold text-xs">Prev</button>
                <button onclick="${nextFunc}" class="px-6 py-2 bg-[#161619] rounded-lg border border-white/10 hover:bg-amber-500 hover:text-black hover:border-transparent font-bold text-xs">Next</button>
            </div>
        </div>`;

    } catch (err) {
        renderError(titlePage, "Tidak ada data / Gagal terhubung");
    }
}

async function applyAdvancedFilter() {
    const q = document.getElementById('search-input').value;
    const g = document.getElementById('filter-genre').value;
    dom.filterPanel.classList.add('hidden');
    
    if(q) showList(`/search/${encodeURIComponent(q)}/1`, `Pencarian "${q}"`);
    else if(g) showList(`/genre/${g}/1`, `Genre: ${g}`);
    else {
        const type = document.getElementById('filter-type').value;
        const status = document.getElementById('filter-status').value;
        let url = `/list?orderby=popular&page=1`;
        if(type) url+=`&type=${type}`;
        if(status) url+=`&status=${status}`;
        showList(url, 'Hasil Filter');
    }
}


/* --- UTILS --- */

function cardTemplate(item) {
    const ch = item.chapter || item.latestChapter || item.chapters?.[0]?.title || 'Up';
    const typeClass = item.type?.toLowerCase().includes('manhwa') ? 'text-green-400 border-green-500/30 bg-green-500/10' : 
                      item.type?.toLowerCase().includes('manhua') ? 'text-pink-400 border-pink-500/30 bg-pink-500/10' : 
                      'text-blue-400 border-blue-500/30 bg-blue-500/10';

    return `
    <div class="group cursor-pointer" onclick="showDetail('${item.slug}')">
        <div class="relative aspect-[3/4] bg-[#161619] rounded-xl overflow-hidden border border-white/5 mb-3">
            <span class="absolute top-2 right-2 z-10 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border backdrop-blur-md ${typeClass}">${item.type||'Manga'}</span>
            <img src="${item.image}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60"></div>
            <div class="absolute bottom-2 left-2 z-20 max-w-full">
                <span class="text-[9px] font-bold text-black bg-amber-500 px-2 py-0.5 rounded shadow">${ch}</span>
            </div>
        </div>
        <h3 class="text-xs md:text-sm font-bold text-gray-300 leading-snug group-hover:text-amber-500 transition line-clamp-2">${item.title}</h3>
    </div>`;
}

function renderLoading() {
    dom.content.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div class="w-12 h-12 border-4 border-[#161619] border-t-amber-500 rounded-full animate-spin"></div>
        <span class="text-[10px] text-gray-500 animate-pulse font-bold tracking-widest">MEMUAT DATA...</span>
    </div>`;
}

function renderError(title, msg) {
    dom.content.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20 text-red-500 text-2xl"><i class="fa fa-triangle-exclamation"></i></div>
        <h2 class="text-xl font-bold text-white mb-1">${title}</h2>
        <p class="text-sm text-gray-500 mb-6 max-w-md">${msg}</p>
        <button onclick="showHome()" class="px-6 py-2.5 bg-white text-black font-bold rounded-lg text-sm hover:bg-gray-200 transition">Kembali ke Beranda</button>
    </div>`;
}

function loadGenres() {
    api('/genres').then(data => {
        if(data && Array.isArray(data)) {
            const sel = document.getElementById('filter-genre');
            data.sort((a,b)=>a.title.localeCompare(b.title)).forEach(g => {
                const o = document.createElement('option');
                o.value=g.slug; o.text=g.title; sel.appendChild(o);
            });
        }
    });
}

function toggleBookmark(slug, title, image) {
    let b = JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]');
    const idx = b.findIndex(x=>x.slug===slug);
    const btn = document.getElementById('bm-btn');
    if(idx>-1) {
        b.splice(idx,1);
        if(btn) {
            btn.innerHTML=`<i class="fa-regular fa-bookmark"></i> Bookmark`;
            btn.className = "w-full py-3 rounded-xl font-bold border transition flex justify-center items-center gap-2 bg-[#161619] border-white/10 text-gray-400 hover:text-white";
        }
        showToast("Dihapus dari Bookmark");
    } else {
        b.push({slug,title,image});
        if(btn) {
            btn.innerHTML=`<i class="fa-solid fa-bookmark"></i> Tersimpan`;
            btn.className = "w-full py-3 rounded-xl font-bold border transition flex justify-center items-center gap-2 bg-amber-500/10 border-amber-500 text-amber-500";
        }
        showToast("Tersimpan!", "success");
    }
    localStorage.setItem('fmc_bookmarks', JSON.stringify(b));
}

function toggleFilter(){ dom.filterPanel.classList.toggle('hidden'); }
function showToast(m,t='i'){
    const x=document.createElement('div');
    x.className=`fixed top-24 right-5 px-4 py-3 rounded-lg shadow-xl backdrop-blur-md border border-white/10 text-xs font-bold flex items-center gap-2 animate-fade-in z-[100] ${t==='error'?'bg-red-900/80 text-white':'bg-[#161619] text-amber-500'}`;
    x.innerHTML=`<i class="fa ${t==='error'?'fa-times':'fa-info-circle'}"></i> ${m}`;
    document.body.appendChild(x);
    setTimeout(()=>x.remove(),3000);
}
function searchChapter(v){
    document.querySelectorAll('.chapter-item').forEach(e => {
        e.style.display = e.textContent.toLowerCase().includes(v.toLowerCase()) ? 'flex':'none';
    });
}
function toggleReaderNav() {
    document.getElementById('reader-head').classList.toggle('-translate-y-full');
    document.getElementById('reader-foot').classList.toggle('translate-y-full');
}
function toggleReaderSettings() {
    const s = appState.settings.fitMode === 'fit' ? 'contain' : 'fit';
    appState.settings.fitMode = s;
    localStorage.setItem('fmc_settings', JSON.stringify(appState.settings));
    applySettings();
}
function applySettings() {
    const c = document.getElementById('image-canvas');
    if(!c) return;
    if(appState.settings.fitMode==='fit') {
        c.classList.add('max-w-4xl','mx-auto');
    } else {
        c.classList.remove('max-w-4xl','mx-auto');
    }
}
function showHistory(){ showHome(true); setTimeout(()=>{ 
    // Manual scroll to history (simplified since separate page was mostly empty)
    window.scrollTo({top: 400, behavior:'smooth'});
    showToast("Scroll ke bawah untuk riwayat");
}, 500); } 

// BOOKMARK PAGE REUSED LOGIC
function showBookmarks() {
    const b = JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]');
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8 mt-16">
        <h2 class="text-xl font-bold mb-6 text-white">Bookmark (${b.length})</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
             ${b.map(x=> cardTemplate({title:x.title, slug:x.slug, image:x.image, type:'SAVED', chapter:'Baca'})).join('')}
        </div>
        ${b.length===0 ? '<p class="text-gray-500 text-center mt-20">Belum ada komik disimpan.</p>' : ''}
    </div>`;
}
