/*
  FmcComic Ultra Full - Nekolabs Edition
  Fitur: Swiper Hero, Reader Settings, History, Bookmark, UUID Support
  Proxy: NEKOLABS (Original)
*/

const API_PROXY = "https://api.nekolabs.web.id/px?url=";
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

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    applyReaderSettings(); 
    handleRouting();

    document.addEventListener('click', (e) => {
        if (dom.filterPanel && !dom.filterPanel.classList.contains('hidden') && !e.target.closest('#filter-panel') && !e.target.closest('[onclick="toggleFilter()"]')) {
            toggleFilter();
        }
        if (dom.settingsModal && !dom.settingsModal.classList.contains('hidden') && !e.target.closest('#reader-settings') && !e.target.closest('[onclick="toggleReaderSettings()"]')) {
            toggleReaderSettings();
        }
    });
});

window.addEventListener('popstate', handleRouting);
window.onscroll = handleScrollEffect;

/* --- CORE FUNCTIONS --- */

async function api(endpoint) {
    const targetUrl = endpoint.startsWith('http') ? endpoint : API_BASE + endpoint;
    const finalUrl = API_PROXY + encodeURIComponent(targetUrl);
    
    try {
        const res = await fetch(finalUrl);
        const json = await res.json();
        
        // Handling Nekolabs Wrapper
        if (json.success === true && json.result) return json.result.content || json.result; // Kadang nekolabs wrap result
        if (json.data) return json.data; // Standar API komik
        return json;
        
    } catch (e) {
        console.error("API Error:", e);
        // Fallback silent, biar UI handle loading
        return null;
    }
}

async function resolveSlug(input) {
    if(input && input.length === 36) { 
        try {
            const res = await fetch(`${BACKEND_URL}/api/get-slug/${input}`);
            if(res.ok) return (await res.json()).slug;
        } catch(e) {} 
    }
    return input;
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

function updateURL(path) { if (window.location.pathname !== path) history.pushState(null, null, path); }

/* --- ROUTING --- */

async function handleRouting() {
    const path = window.location.pathname;
    resetUI();
    
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
    renderLoading("Menyiapkan Komik...");
    document.title = "FmcComic";

    const data = await api('/home');
    
    // Validasi data agar tidak stuck loading
    if (!data || (!data.hotUpdates && !data.latestReleases)) {
        return renderError("Gagal Memuat Home", "Data dari Nekolabs kosong atau timeout.");
    }

    const slides = (data.hotUpdates || []).slice(0, 8);
    const latest = data.latestReleases || [];
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');

    let html = '';

    // HERO SLIDER
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
                                <span class="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shadow-lg shadow-amber-500/20 mb-2 inline-block">Trending</span>
                                <h2 class="text-3xl md:text-5xl font-black text-white leading-tight mb-2 drop-shadow-xl line-clamp-2">${item.title}</h2>
                                <p class="text-amber-400 font-bold text-sm"><i class="fa fa-book-open"></i> ${item.chapter || item.latestChapter}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="swiper-pagination !bottom-6 md:!bottom-12 md:!left-12 md:!w-auto container mx-auto px-4"></div>
        </div>
        `;
    }

    html += `<div class="container mx-auto px-4 -mt-8 relative z-30 pb-24 space-y-10">`;

    // HISTORY STRIP
    if (history.length > 0) {
        html += `
        <div class="animate-fade-in">
            <div class="flex items-center gap-2 mb-3 text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                <i class="fa fa-clock-rotate-left text-amber-500"></i> Lanjutkan Baca
            </div>
            <div class="flex overflow-x-auto gap-3 hide-scroll pb-2">
                ${history.slice(0, 10).map(h => `
                    <div onclick="readChapter('${h.lastChapterSlug}', '${h.slug}')" 
                        class="min-w-[200px] bg-[#1a1a1d] p-2 rounded-xl border border-white/5 flex gap-3 cursor-pointer hover:border-amber-500/50 hover:bg-[#202024] transition">
                        <img src="${h.image}" class="w-10 h-14 rounded object-cover shadow-sm bg-gray-800">
                        <div class="flex flex-col justify-center overflow-hidden">
                            <h4 class="text-xs font-bold text-gray-200 truncate mb-1">${h.title}</h4>
                            <span class="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded w-max border border-amber-500/10">${h.lastChapterTitle || 'Lanjut'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // GRID LATEST
    html += `
        <div class="animate-fade-in">
            <h2 class="text-xl font-bold text-white mb-6 border-l-4 border-amber-500 pl-4">Rilis Terbaru</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                ${latest.map(item => renderCard(item)).join('')}
            </div>
            
            <div class="mt-10 flex justify-center">
                 <button onclick="showList('/list?orderby=popular','Semua Komik')" class="px-8 py-3 rounded-full bg-white/5 border border-white/10 text-xs font-bold hover:bg-amber-500 hover:text-black hover:border-transparent transition">Lihat Lebih Banyak</button>
            </div>
        </div>
    </div>`;

    dom.content.innerHTML = html;

    if (slides.length > 0) {
        new Swiper(".mySwiper", {
            loop: true,
            effect: 'fade',
            speed: 800,
            autoplay: { delay: 4000 },
            pagination: { el: ".swiper-pagination", clickable: true },
        });
    }
}

/* --- DETAIL PAGE --- */

async function showDetail(idOrSlug, push = true) {
    renderLoading();
    let slug = await resolveSlug(idOrSlug);
    
    if (push) {
        updateURL(`/series/${slug}`);
        registerUuid(slug, 'series');
    }

    const data = await api(`/detail/${slug}`);
    if (!data) return renderError("Data Kosong", "Gagal mengambil detail komik.");

    appState.comicData = data;
    
    // Check saved state
    const bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const isBookmarked = bookmarks.some(b => b.slug === slug);
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const historyItem = history.find(h => h.slug === slug);
    
    // Chapters
    const chapters = data.chapters || [];
    const lastChSlug = historyItem ? historyItem.lastChapterSlug : null;
    const firstChSlug = chapters.length > 0 ? chapters[chapters.length - 1].slug : null;
    
    let btnAction = lastChSlug ? `readChapter('${lastChSlug}', '${slug}')` : (firstChSlug ? `readChapter('${firstChSlug}', '${slug}')` : `showToast('Chapter belum ada', 'error')`);
    let btnText = lastChSlug ? "Lanjut Baca" : "Mulai Baca";

    dom.content.innerHTML = `
    <div class="relative h-[45vh] w-full overflow-hidden">
        <div class="absolute inset-0 bg-[#0a0a0c]"></div>
        <img src="${data.image}" class="w-full h-full object-cover opacity-20 blur-xl scale-110">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent"></div>
    </div>

    <div class="container mx-auto px-4 -mt-40 relative z-10 pb-20">
        <div class="flex flex-col md:flex-row gap-8 lg:gap-12">
            
            <div class="w-[200px] md:w-[260px] shrink-0 mx-auto md:mx-0 flex flex-col gap-4">
                <img src="${data.image}" class="w-full rounded-xl shadow-2xl border-4 border-[#161619] aspect-[2/3]">
                
                <button onclick="${btnAction}" class="w-full py-3.5 rounded-xl font-bold text-black bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition flex justify-center items-center gap-2">
                    <i class="fa fa-book-open"></i> ${btnText}
                </button>
                
                <button id="bookmark-btn" onclick="toggleBookmark('${slug}', \`${data.title.replace(/'/g, "")}\`, '${data.image}')" 
                    class="w-full py-3.5 rounded-xl font-bold border transition flex justify-center items-center gap-2 ${isBookmarked ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-[#1a1a1d] border-white/10 text-gray-400 hover:text-white'}">
                    <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i> <span>${isBookmarked ? 'Tersimpan' : 'Bookmark'}</span>
                </button>
            </div>

            <div class="flex-1 min-w-0">
                <h1 class="text-3xl md:text-5xl font-black text-white leading-tight mb-4 text-center md:text-left">${data.title}</h1>
                
                <div class="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                    <span class="px-3 py-1 bg-[#1a1a1d] border border-white/10 rounded-lg text-xs font-bold text-white">${data.type}</span>
                    <span class="px-3 py-1 bg-[#1a1a1d] border border-white/10 rounded-lg text-xs font-bold ${data.status.toLowerCase()=='ongoing'?'text-green-500':'text-red-500'}">${data.status}</span>
                    <span class="px-3 py-1 bg-[#1a1a1d] border border-white/10 rounded-lg text-xs font-bold text-amber-500"><i class="fa fa-star"></i> ${data.rating}</span>
                </div>

                <div class="bg-[#1a1a1d] rounded-2xl p-5 border border-white/5 mb-8">
                    <p class="text-gray-300 text-sm leading-relaxed text-justify md:text-left font-light">${data.synopsis || "Tidak ada deskripsi."}</p>
                </div>

                <div class="bg-[#1a1a1d] rounded-2xl border border-white/5 overflow-hidden flex flex-col max-h-[600px]">
                    <div class="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0">
                        <span class="font-bold text-white text-sm">List Chapter (${chapters.length})</span>
                        <input type="text" onkeyup="filterChapterList(this.value)" placeholder="Cari..." class="w-32 bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-xs focus:border-amber-500 outline-none text-white">
                    </div>
                    
                    <div class="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        ${chapters.map(c => `
                            <div class="chapter-row flex justify-between items-center p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent transition group ${lastChSlug === c.slug ? 'bg-amber-500/10 border-amber-500/20' : ''}"
                                 onclick="readChapter('${c.slug}', '${slug}')">
                                <span class="text-sm font-semibold text-gray-300 group-hover:text-amber-500 ${lastChSlug === c.slug ? 'text-amber-500' : ''} truncate max-w-[70%]">${c.title}</span>
                                <span class="text-[10px] text-gray-600">${c.time || ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

/* --- READER --- */

async function readChapter(idOrSlug, comicSlug, push = true) {
    if (appState.isNavigating) return;
    appState.isNavigating = true;

    // Loading Screen
    dom.content.innerHTML = `
    <div class="fixed inset-0 bg-[#0a0a0c] z-[55] flex flex-col items-center justify-center gap-4">
        <div class="w-10 h-10 border-4 border-amber-900 border-t-amber-500 rounded-full animate-spin"></div>
        <p class="text-amber-500 text-xs font-bold animate-pulse tracking-widest">NEKOLABS LOADING...</p>
    </div>`;
    dom.navs.main.classList.add('-translate-y-full'); 

    try {
        let slug = await resolveSlug(idOrSlug);
        if (push) {
            updateURL(`/chapter/${slug}`);
            registerUuid(slug, 'chapter');
        }

        const data = await api(`/chapter/${slug}`);
        if (!data || !data.images) throw new Error("Gambar rusak atau API down.");

        const parentSlug = comicSlug || data.comic_slug || (data.relation?.slug) || 'home';
        const title = data.title || "Chapter";
        const images = data.images || [];

        // Save History
        let h = JSON.parse(localStorage.getItem('fmc_history') || '[]');
        h = h.filter(x => x.slug !== parentSlug); 
        h.unshift({
            slug: parentSlug,
            title: appState.comicData ? appState.comicData.title : (data.comic_title || 'Komik'),
            image: appState.comicData ? appState.comicData.image : 'assets/icon.png',
            lastChapterSlug: slug,
            lastChapterTitle: title,
            timestamp: Date.now()
        });
        localStorage.setItem('fmc_history', JSON.stringify(h.slice(0, 50)));

        // RENDER READER
        dom.content.innerHTML = `
        <div id="reader-wrapper" class="min-h-screen bg-[#0a0a0c] pb-24 relative select-none">
            
            <div id="reader-header" class="fixed top-0 w-full z-[60] bg-[#0a0a0c]/90 backdrop-blur border-b border-white/5 p-3 flex justify-between items-center transition-transform duration-300">
                <div class="flex items-center gap-3 overflow-hidden">
                    <button onclick="showDetail('${parentSlug}')" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-amber-500 hover:text-black transition text-white"><i class="fa fa-arrow-left"></i></button>
                    <span class="text-xs font-bold text-gray-200 truncate max-w-[200px]">${title}</span>
                </div>
                <button onclick="toggleReaderSettings()" class="w-9 h-9 text-gray-400 hover:text-white flex items-center justify-center"><i class="fa fa-gear"></i></button>
            </div>

            <div id="image-container" class="pt-16 min-h-screen flex flex-col items-center cursor-pointer" onclick="toggleReaderUI()">
                ${images.map(url => `
                    <div class="relative w-full min-h-[300px] bg-[#111] mb-0.5">
                        <img src="${url}" loading="lazy" class="relative z-10 w-full h-auto opacity-0 transition-opacity duration-300" 
                             onload="this.classList.remove('opacity-0');this.parentElement.style.minHeight='auto'"
                             onerror="this.parentElement.innerHTML='<div class=\\'p-10 text-center text-red-500\\'>Gagal Muat</div>'">
                        <div class="absolute inset-0 flex items-center justify-center z-0 text-gray-700"><i class="fa fa-spinner fa-spin"></i></div>
                    </div>
                `).join('')}
            </div>

            <div id="reader-footer" class="fixed bottom-0 w-full z-[60] p-5 flex justify-center transition-transform duration-300">
                <div class="glass px-2 py-2 rounded-2xl flex items-center gap-4 shadow-2xl bg-[#0a0a0c]/90 border border-white/10">
                    <button ${data.navigation?.prev ? `onclick="readChapter('${data.navigation.prev}', '${parentSlug}')"` : 'disabled class="opacity-30"'} class="w-10 h-10 hover:bg-white/10 rounded-lg text-white"><i class="fa fa-chevron-left"></i></button>
                    <button onclick="showDetail('${parentSlug}')" class="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">Detail</button>
                    <button ${data.navigation?.next ? `onclick="readChapter('${data.navigation.next}', '${parentSlug}')"` : `onclick="showDetail('${parentSlug}')"`} class="w-10 h-10 bg-amber-500 hover:bg-amber-400 text-black rounded-lg">
                        <i class="fa ${data.navigation?.next ? 'fa-chevron-right' : 'fa-check'}"></i>
                    </button>
                </div>
            </div>
        </div>`;

        applyReaderSettings(); 
        window.scrollTo(0,0);
        appState.isNavigating = false;

    } catch (e) {
        renderError("Error Chapter", "Gambar tidak dapat dimuat.");
        dom.navs.main.classList.remove('-translate-y-full');
        appState.isNavigating = false;
    }
}

/* --- LISTING & GENERIC --- */

async function showList(urlEndpoint, titlePage) {
    if(window.location.pathname !== urlEndpoint.split('?')[0]) {
        if(urlEndpoint.includes('Ongoing')) updateURL('/ongoing');
        else if(urlEndpoint.includes('Completed')) updateURL('/completed');
    }

    renderLoading();
    const data = await api(urlEndpoint);
    const list = Array.isArray(data) ? data : (data?.data || []);
    
    if (list.length === 0) return renderError(titlePage, "Tidak ada data ditemukan.");

    // Simple Pagination Handling
    const currentUrl = new URL(API_BASE + urlEndpoint);
    const page = parseInt(currentUrl.searchParams.get('page')) || 1;
    const baseUrl = urlEndpoint.replace(/&page=\d+/, '').replace(/\/page\/\d+/, '');
    
    dom.content.innerHTML = `
    <div class="container mx-auto px-4 py-8 pt-20">
        <h2 class="text-2xl font-bold text-white mb-8 border-l-4 border-amber-500 pl-4">${titlePage}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5 animate-fade-in">
            ${list.map(item => renderCard(item)).join('')}
        </div>
        
        <div class="mt-12 flex justify-center items-center gap-4">
            <button onclick="showList('${baseUrl}&page=${page-1}', '${titlePage}')" ${page===1 ? 'disabled class="opacity-0"' : 'class="px-5 py-2 bg-[#1a1a1d] border border-white/10 rounded-lg font-bold text-xs hover:text-amber-500"'}>Prev</button>
            <span class="text-sm font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded">Page ${page}</span>
            <button onclick="showList('${baseUrl}&page=${page+1}', '${titlePage}')" class="px-5 py-2 bg-[#1a1a1d] border border-white/10 rounded-lg font-bold text-xs hover:bg-amber-500 hover:text-black hover:border-transparent transition">Next</button>
        </div>
    </div>`;
}

function renderCard(item) {
    let typeClass = item.type?.toLowerCase().includes('manhwa') ? "text-green-400 bg-green-500/10" : "text-blue-400 bg-blue-500/10";
    return `
    <div class="group cursor-pointer relative" onclick="showDetail('${item.slug}')">
        <div class="relative aspect-[3/4] bg-[#161619] rounded-xl overflow-hidden border border-white/5 mb-3 group-hover:border-amber-500/40 transition">
            <img src="${item.image}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
            <span class="absolute top-2 right-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-white/5 backdrop-blur ${typeClass} z-10">${item.type||'UP'}</span>
            <div class="absolute bottom-2 left-2 max-w-full z-10"><span class="text-[9px] font-bold text-black bg-amber-500 px-2 py-0.5 rounded shadow truncate block">${item.chapter||'Read'}</span></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
        </div>
        <h3 class="font-bold text-sm text-gray-200 leading-tight group-hover:text-amber-500 transition line-clamp-2">${item.title}</h3>
    </div>`;
}

/* --- EXTRAS: BOOKMARKS & SETTINGS --- */

function showBookmarks() {
    updateURL('/bookmarks');
    const b = JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]');
    if(b.length === 0) return renderError("Bookmark Kosong", "Simpan komik dulu gan.");
    dom.content.innerHTML = `<div class="container mx-auto px-4 py-20"><h2 class="text-xl font-bold mb-8 text-white"><i class="fa fa-bookmark text-amber-500"></i> Bookmark</h2><div class="grid grid-cols-2 sm:grid-cols-6 gap-4">${b.map(i => renderCard({...i, type:'Saved', chapter:'Baca'})).join('')}</div></div>`;
}

function showHistory() {
    updateURL('/history');
    const h = JSON.parse(localStorage.getItem('fmc_history')||'[]');
    if(h.length === 0) return renderError("Riwayat Kosong", "Baca komik dulu gan.");
    dom.content.innerHTML = `<div class="container mx-auto px-4 py-20"><div class="flex justify-between mb-6"><h2 class="text-xl font-bold"><i class="fa fa-history text-amber-500"></i> Riwayat</h2><button onclick="localStorage.removeItem('fmc_history');showHistory()" class="text-xs text-red-500">Hapus</button></div><div class="grid gap-3">${h.map(i => `<div class="bg-[#161619] p-3 rounded-xl flex gap-4 cursor-pointer hover:bg-white/5" onclick="readChapter('${i.lastChapterSlug}','${i.slug}')"><img src="${i.image}" class="w-14 h-20 object-cover rounded bg-black"><div class="flex flex-col justify-center"><h3 class="font-bold text-gray-200 text-sm">${i.title}</h3><p class="text-xs text-amber-500 mt-1">${i.lastChapterTitle}</p></div></div>`).join('')}</div></div>`;
}

function applyAdvancedFilter() {
    const q = document.getElementById('search-input').value;
    const g = document.getElementById('filter-genre').value;
    dom.filterPanel.classList.add('hidden');
    if (q) showList(`/search/${encodeURIComponent(q)}/1`, `Cari: "${q}"`);
    else if(g) showList(`/genre/${g}/1`, `Genre: ${g}`);
}

/* --- SETTINGS & HELPERS --- */
function toggleReaderSettings() { dom.settingsModal.classList.toggle('hidden'); if(!dom.settingsModal.classList.contains('hidden')) { dom.settingsModal.classList.add('scale-100','opacity-100'); dom.settingsModal.classList.remove('scale-90','opacity-0'); } else { dom.settingsModal.classList.remove('scale-100','opacity-100'); dom.settingsModal.classList.add('scale-90','opacity-0'); } }
function toggleImageFit() { appState.settings.fitMode = appState.settings.fitMode === 'contain' ? 'original' : 'contain'; saveSettings(); applyReaderSettings(); }
function changeBrightness(val) { appState.settings.brightness = val; document.getElementById('bright-val').innerText = val + "%"; saveSettings(); applyReaderSettings(); }
function saveSettings() { localStorage.setItem('fmc_settings', JSON.stringify(appState.settings)); }

function applyReaderSettings() {
    const c = document.getElementById('image-container');
    if(c) {
        if (appState.settings.fitMode === 'original') { c.classList.remove('max-w-4xl', 'mx-auto', 'px-0'); document.getElementById('btn-fit-toggle').innerText="Original"; } 
        else { c.classList.add('max-w-4xl', 'mx-auto', 'px-0'); document.getElementById('btn-fit-toggle').innerText="Fit Width"; }
    }
    if (dom.overlay) dom.overlay.style.opacity = (100 - appState.settings.brightness) / 100;
}

function toggleBookmark(slug, title, image) {
    let b = JSON.parse(localStorage.getItem('fmc_bookmarks')||'[]');
    const i = b.findIndex(x=>x.slug===slug);
    const btn = document.getElementById('bookmark-btn');
    if(i!==-1) { b.splice(i,1); showToast("Dihapus"); if(btn) { btn.classList.remove('text-amber-500','border-amber-500'); btn.innerHTML=`<i class="fa-regular fa-bookmark"></i> Bookmark`; } } 
    else { b.push({slug,title,image}); showToast("Tersimpan!"); if(btn) { btn.classList.add('text-amber-500','border-amber-500'); btn.innerHTML=`<i class="fa-solid fa-bookmark"></i> Tersimpan`; } }
    localStorage.setItem('fmc_bookmarks', JSON.stringify(b));
}

function loadGenres(){ api('/genres').then(d=>{ if(d&&Array.isArray(d)) { const el=document.getElementById('filter-genre'); d.sort((a,b)=>a.title.localeCompare(b.title)).forEach(g=>{ const o=document.createElement('option'); o.value=g.slug; o.text=g.title; el.appendChild(o); }) } }); }
function showToast(m,t='i'){ const d=document.createElement('div'); d.className=`p-3 rounded-lg shadow-xl backdrop-blur-md text-xs font-bold flex gap-2 animate-fade-in ${t=='error'?'bg-red-900 text-white':'bg-[#1a1a1d] text-amber-500'}`; d.innerHTML=m; dom.toastContainer.appendChild(d); setTimeout(()=>d.remove(),3000); }
function toggleReaderUI() { const h=document.getElementById('reader-header'), f=document.getElementById('reader-footer'); if(h){h.classList.toggle('-translate-y-full'); f.classList.toggle('translate-y-[150%]');} }
function renderLoading(t="Memuat..."){ dom.content.innerHTML=`<div class="h-[60vh] flex flex-col items-center justify-center gap-3"><div class="w-10 h-10 border-4 border-t-amber-500 rounded-full animate-spin"></div><p class="text-[10px] animate-pulse font-bold text-gray-500 uppercase">${t}</p></div>`; }
function renderError(t,m){ dom.content.innerHTML=`<div class="h-[60vh] flex flex-col items-center justify-center gap-2 text-center px-4"><h3 class="font-bold text-white text-lg">${t}</h3><p class="text-sm text-gray-500 mb-4">${m}</p><button onclick="showHome()" class="text-amber-500 text-xs font-bold border border-amber-500 px-4 py-2 rounded">Refresh</button></div>`; }
function toggleFilter(){ dom.filterPanel.classList.toggle('hidden'); }
function filterChapterList(v){ document.querySelectorAll('.chapter-row').forEach(e=>e.style.display=e.textContent.toLowerCase().includes(v.toLowerCase())?'flex':'none'); }
function handleScrollEffect() { if(dom.navs.main) window.scrollY>20 ? dom.navs.main.classList.add('bg-[#0a0a0c]/90','shadow-xl','backdrop-blur') : dom.navs.main.classList.remove('bg-[#0a0a0c]/90','shadow-xl','backdrop-blur'); document.getElementById('scroll-top').style.opacity = window.scrollY > 400 ? 1 : 0; }
