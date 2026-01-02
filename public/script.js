const API_PROXY = "https://api.nekolabs.web.id/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

const contentArea = document.getElementById('content-area');
const filterPanel = document.getElementById('filter-panel');
const mainNav = document.getElementById('main-nav');
const mobileNav = document.getElementById('mobile-nav');
let currentChapterList = [];
const uuidCache = { series: {}, chapter: {} };

// --- FUNGSI UUID & SYNC ---
async function syncUuids(slugs, type) {
    const missing = slugs.filter(s => !uuidCache[type][s]);
    if (missing.length === 0) return;
    try {
        const res = await fetch(`${BACKEND_URL}/api/bulk-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slugs: missing, type })
        });
        const data = await res.json();
        Object.assign(uuidCache[type], data);
    } catch (e) { console.error("Sync Error:", e); }
}

async function getMappingFromUuid(uuid) {
    const res = await fetch(`${BACKEND_URL}/api/get-slug/${uuid}`);
    return res.ok ? await res.json() : null;
}

function updateURL(path) {
    if (window.location.pathname !== path) history.pushState(null, null, path);
}

// --- CORE UTILS ---
async function fetchAPI(url) {
    try {
        const res = await fetch(API_PROXY + encodeURIComponent(url));
        const data = await res.json();
        return data.success ? (data.result?.content || data.result) : null;
    } catch (e) { return null; }
}

function getTypeClass(t = '') {
    t = t.toLowerCase();
    if (t.includes('manga')) return 'type-manga';
    if (t.includes('manhwa')) return 'type-manhwa';
    if (t.includes('manhua')) return 'type-manhua';
    return 'type-default';
}

function resetNavs() { mainNav.classList.remove('-translate-y-full'); mobileNav.classList.remove('translate-y-full'); filterPanel.classList.add('hidden'); }
function toggleFilter() { filterPanel.classList.toggle('hidden'); if(document.getElementById('filter-genre').options.length <= 1) loadGenres(); }

// --- NAVIGASI HALAMAN ---
async function showHome(push = true) {
    if (push) updateURL('/');
    resetNavs();
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
    
    const data = await fetchAPI(`${API_BASE}/home`);
    if(!data) return;

    const allSlugs = [...data.data.hotUpdates.map(i=>i.slug), ...data.data.latestReleases.map(i=>i.slug)];
    await syncUuids(allSlugs, 'series');

    contentArea.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-2"><i class="fa fa-bolt text-amber-500"></i> Populer</h2>
        <div class="flex overflow-x-auto gap-4 hide-scroll pb-4">
            ${data.data.hotUpdates.map(item => `
                <div class="min-w-[160px] md:min-w-[200px] cursor-pointer card-hover relative" onclick="showDetail('${uuidCache.series[item.slug] || item.slug}')">
                    <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Hot'}</span>
                    <img src="${item.image}" class="h-60 md:h-72 w-full object-cover rounded-2xl">
                    <h3 class="mt-3 text-sm font-bold truncate">${item.title}</h3>
                </div>
            `).join('')}
        </div>
        <h2 class="text-xl font-bold mt-10 mb-6 border-l-4 border-amber-500 pl-4">Update Terbaru</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            ${data.data.latestReleases.map(item => `
                <div class="bg-zinc-900/40 p-2 rounded-2xl cursor-pointer border border-white/5" onclick="showDetail('${uuidCache.series[item.slug] || item.slug}')">
                    <img src="${item.image}" class="h-44 w-full object-cover rounded-xl">
                    <h3 class="text-xs font-bold mt-2 truncate">${item.title}</h3>
                </div>
            `).join('')}
        </div>
    `;
}

async function showDetail(idOrSlug, push = true) {
    let slug = idOrSlug;
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin h-12 w-12 border-t-2 border-amber-500 rounded-full"></div></div>`;

    if (idOrSlug.length === 36) {
        const mapping = await getMappingFromUuid(idOrSlug);
        if (mapping) slug = mapping.slug;
    }

    const data = await fetchAPI(`${API_BASE}/detail/${slug}`);
    if(!data) return;

    await syncUuids([slug], 'series');
    if (push) updateURL(`/series/${uuidCache.series[slug] || slug}`);

    const chaptersSlugs = data.data.chapters.map(c => c.slug);
    await syncUuids(chaptersSlugs, 'chapter');

    contentArea.innerHTML = `
        <div class="flex flex-col md:flex-row gap-10">
            <div class="md:w-1/3"><img src="${data.data.image}" class="w-full rounded-3xl shadow-2xl"></div>
            <div class="md:w-2/3">
                <h1 class="text-3xl font-bold mb-4">${data.data.title}</h1>
                <p class="text-gray-400 text-sm mb-8">${data.data.synopsis}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto custom-scroll">
                    ${data.data.chapters.map(ch => `
                        <div onclick="readChapter('${uuidCache.chapter[ch.slug] || ch.slug}', '${slug}')" class="bg-white/5 p-3 rounded-xl cursor-pointer hover:bg-amber-500 hover:text-black transition text-sm">
                            ${ch.title}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    saveHistory(slug, data.data.title, data.data.image);
    window.scrollTo(0,0);
}

async function readChapter(idOrSlug, comicSlug = null, push = true) {
    let chSlug = idOrSlug;
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin h-12 w-12 border-t-2 border-amber-500 rounded-full"></div></div>`;

    if (idOrSlug.length === 36) {
        const mapping = await getMappingFromUuid(idOrSlug);
        if (mapping) chSlug = mapping.slug;
    }

    await syncUuids([chSlug], 'chapter');
    if (push) updateURL(`/chapter/${uuidCache.chapter[chSlug] || chSlug}`);

    const data = await fetchAPI(`${API_BASE}/chapter/${chSlug}`);
    if(!data) return;

    mainNav.classList.add('-translate-y-full');
    mobileNav.classList.add('translate-y-full');

    contentArea.innerHTML = `
        <div class="bg-black -mx-4 pt-20 flex flex-col items-center">
            <button onclick="showHome()" class="mb-10 px-8 py-2 amber-gradient rounded-full text-black font-bold">Kembali</button>
            ${data.data.images.map(img => `<img src="${img}" class="max-w-full md:max-w-3xl mb-1" loading="lazy">`).join('')}
        </div>`;
    window.scrollTo(0,0);
}

// --- FITUR LAIN (HISTORY, BOOKMARK, DLL) ---
function saveHistory(slug, title, image) {
    let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    history = history.filter(h => h.slug !== slug);
    history.unshift({ slug, title, image });
    localStorage.setItem('fmc_history', JSON.stringify(history.slice(0, 20)));
}
function showHistory() { const h = JSON.parse(localStorage.getItem('fmc_history') || '[]'); renderGrid({data:h}, "Riwayat"); }
function showBookmarks() { const b = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]'); renderGrid({data:b}, "Koleksi"); }

async function showOngoing(p=1) { 
    updateURL('/ongoing'); resetNavs();
    const data = await fetchAPI(`${API_BASE}/list?status=Ongoing&orderby=popular&page=${p}`);
    renderGrid(data, "Komik Ongoing", "showOngoing");
}
async function showCompleted(p=1) { 
    updateURL('/completed'); resetNavs();
    const data = await fetchAPI(`${API_BASE}/list?status=Completed&orderby=popular&page=${p}`);
    renderGrid(data, "Komik Tamat", "showCompleted");
}

async function renderGrid(data, title, func, arg) {
    const list = data?.data || [];
    await syncUuids(list.map(i=>i.slug), 'series');
    contentArea.innerHTML = `<h2 class="text-2xl font-bold mb-8 border-l-4 border-amber-500 pl-4">${title}</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-6">
            ${list.map(i => `<div class="bg-zinc-900/40 rounded-2xl overflow-hidden card-hover cursor-pointer" onclick="showDetail('${uuidCache.series[i.slug] || i.slug}')">
                <img src="${i.image}" class="h-64 w-full object-cover"><div class="p-3 text-center text-xs font-bold">${i.title}</div>
            </div>`).join('')}
        </div>`;
}

// --- HANDLE INITIAL LOAD ---
async function handleInitialLoad() {
    const path = window.location.pathname;
    const id = path.split('/')[2];
    if (path.startsWith('/series/')) showDetail(id, false);
    else if (path.startsWith('/chapter/')) readChapter(id, null, false);
    else if (path === '/ongoing') showOngoing();
    else if (path === '/completed') showCompleted();
    else showHome(false);
}

window.addEventListener('popstate', handleInitialLoad);
document.addEventListener('DOMContentLoaded', handleInitialLoad);
