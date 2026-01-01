/* 
 <!-- Woi Kontol Lu ngapain?, mau nyuri ya lu? udh ada Wai masih aja mau genjutsu webnya malu lah sama ortu lu -->
*/

const API_PROXY = "https://api.nekolabs.web.id/px?url=";
const API_BASE = "https://www.sankavollerei.com/comic/komikcast";
const BACKEND_URL = window.location.origin;

const contentArea = document.getElementById('content-area');
const filterPanel = document.getElementById('filter-panel');
const mainNav = document.getElementById('main-nav');
const mobileNav = document.getElementById('mobile-nav');

let currentChapterList = [];
let currentComicSlug = '';
let imageObserver = null;
let chapterSearchTerm = '';

// Image Loading Optimization
function initImageObserver() {
    if (imageObserver) return;
    
    imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                    img.onload = () => {
                        img.classList.add('loaded');
                        img.parentElement?.classList?.remove('image-loading');
                    };
                    img.onerror = () => {
                        img.src = 'https://via.placeholder.com/800x1200/1a1a1a/ffffff?text=Gagal+Memuat+Gambar';
                        img.classList.add('loaded');
                    };
                }
                imageObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '200px',
        threshold: 0.1
    });
}

// Preload next image for smoother experience
function preloadNextImage(index, images) {
    if (index < images.length - 1) {
        const nextImg = new Image();
        nextImg.src = images[index + 1];
    }
}

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
    if (window.location.pathname !== path) {
        history.pushState(null, null, path);
    }
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
    window.location.href = '/404.html';
}

async function fetchAPI(url) {
    try {
        const response = await fetch(API_PROXY + encodeURIComponent(url));
        const data = await response.json();
        if (data.success) {
            return data.result?.content || data.result || data;
        }
        return null;
    } catch (e) { return null; }
}

function toggleFilter() {
    filterPanel.classList.toggle('hidden');
    const genreSelect = document.getElementById('filter-genre');
    if (genreSelect.options.length <= 1) loadGenres();
}

function resetNavs() {
    mainNav.classList.remove('-translate-y-full');
    mobileNav.classList.remove('translate-y-full');
    filterPanel.classList.add('hidden');
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => console.log(err.message));
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

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

async function showHome(push = true) {
    if (push) updateURL('/'); 
    resetNavs();
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
    
    const data = await fetchAPI(`${API_BASE}/home`);
    if(!data || !data.data) { redirectTo404(); return; }

    contentArea.innerHTML = `
        <section class="mb-10">
            <h2 class="text-2xl font-bold mb-6 flex items-center gap-2"><i class="fa fa-bolt text-amber-500"></i> Populer</h2>
            <div class="flex overflow-x-auto gap-4 hide-scroll pb-4">
                ${data.data.hotUpdates.map(item => `
                    <div class="min-w-[160px] md:min-w-[200px] cursor-pointer card-hover relative" onclick="showDetail('${item.slug}')">
                        <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Hot'}</span>
                        <img src="${item.image}" class="h-60 md:h-72 w-full object-cover rounded-2xl shadow-xl">
                        <h3 class="mt-3 text-sm font-bold truncate">${item.title}</h3>
                        <p class="text-amber-500 text-xs">${item.chapter || item.latestChapter}</p>
                    </div>
                `).join('')}
            </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div class="lg:col-span-2">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Terbaru</h2>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    ${data.data.latestReleases.slice(0, 12).map(item => `
                        <div class="bg-zinc-900/30 border border-white/5 p-2 rounded-2xl cursor-pointer hover:border-amber-500/50 transition relative group" onclick="showDetail('${item.slug}')">
                            <img src="${item.image}" class="h-44 w-full object-cover rounded-xl">
                            <h3 class="text-xs font-bold mt-2 line-clamp-2 h-8">${item.title}</h3>
                            <p class="text-[10px] text-gray-500 mt-1">${item.chapters[0]?.title || 'Ch.?'}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div>
                <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Proyek Kami</h2>
                <div class="space-y-4">
                    ${data.data.projectUpdates.map(item => `
                        <div class="flex gap-4 bg-zinc-900/20 p-2 rounded-2xl cursor-pointer hover:bg-white/5 transition" onclick="showDetail('${item.slug}')">
                            <img src="${item.image}" class="w-16 h-20 rounded-xl object-cover">
                            <div class="flex-1 flex flex-col justify-center overflow-hidden">
                                <h3 class="font-bold text-xs truncate">${item.title}</h3>
                                <p class="text-amber-500 text-[10px] mt-1">${item.chapters[0]?.title}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    window.scrollTo(0,0);
}

async function showOngoing(page = 1) {
    updateURL('/ongoing'); resetNavs();
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
    const data = await fetchAPI(`${API_BASE}/list?status=Ongoing&orderby=popular&page=${page}`);
    renderGrid(data, "Komik Ongoing Terpopuler", "showOngoing");
}

async function showCompleted(page = 1) {
    updateURL('/completed'); resetNavs();
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
    const data = await fetchAPI(`${API_BASE}/list?status=Completed&orderby=popular&page=${page}`);
    renderGrid(data, "Komik Tamat (Selesai)", "showCompleted");
}

async function showGenre(slug, page = 1) {
    resetNavs();
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
    const data = await fetchAPI(`${API_BASE}/genre/${slug}/${page}`);
    if(!data || !data.data || data.data.length === 0) { redirectTo404(); return; }
    renderGrid(data, `Genre: ${slug.toUpperCase()}`, "showGenre", slug);
}

async function applyAdvancedFilter() {
    const query = document.getElementById('search-input').value;
    const genre = document.getElementById('filter-genre').value;
    const type = document.getElementById('filter-type').value;
    const status = document.getElementById('filter-status').value;
    filterPanel.classList.add('hidden');
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;
    if (query) {
        const data = await fetchAPI(`${API_BASE}/search/${encodeURIComponent(query)}/1`);
        renderGrid(data, `Hasil Pencarian: ${query}`, null); return;
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
        contentArea.innerHTML = `<div class="text-center py-40 text-gray-500"><p>Komik tidak ditemukan.</p></div>`; return;
    }
    let paginationHTML = '';
    if (data.pagination && funcName) {
        const current = data.pagination.currentPage;
        const argStr = extraArg ? `'${extraArg}', ` : '';
        paginationHTML = `
            <div class="mt-14 flex justify-center items-center gap-6">
                ${current > 1 ? `<button onclick="${funcName}(${argStr}${current - 1})" class="glass px-6 py-2 rounded-xl text-xs hover:bg-amber-500 hover:text-black transition">Prev</button>` : ''}
                <span class="bg-amber-500 text-black px-6 py-2 rounded-xl text-xs font-extrabold">${current}</span>
                ${data.pagination.hasNextPage ? `<button onclick="${funcName}(${argStr}${current + 1})" class="glass px-6 py-2 rounded-xl text-xs hover:bg-amber-500 hover:text-black transition">Next</button>` : ''}
            </div>
        `;
    }
    contentArea.innerHTML = `
        <h2 class="text-2xl font-bold mb-8 border-l-4 border-amber-500 pl-4">${title}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            ${list.map(item => `
                <div class="bg-zinc-900/40 rounded-2xl overflow-hidden border border-white/5 card-hover cursor-pointer relative group" onclick="showDetail('${item.slug}')">
                    <span class="type-badge ${getTypeClass(item.type)}">${item.type || 'Comic'}</span>
                    <img src="${item.image}" class="h-64 w-full object-cover">
                    <div class="p-3 text-center">
                        <h3 class="text-xs font-bold truncate group-hover:text-amber-500 transition">${item.title}</h3>
                        <p class="text-[10px] text-amber-500 mt-1">${item.latestChapter || item.chapter || 'Baca'}</p>
                    </div>
                </div>
            `).join('')}
        </div>
        ${paginationHTML}
    `;
    window.scrollTo(0,0);
}

// Render Chapter List dengan desain profesional
function renderChapterList() {
    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const savedItem = history.find(h => h.slug === currentComicSlug);
    const lastReadSlug = savedItem?.lastChapterSlug || '';
    
    let filteredChapters = currentChapterList;
    if (chapterSearchTerm) {
        filteredChapters = currentChapterList.filter(ch => 
            ch.title.toLowerCase().includes(chapterSearchTerm.toLowerCase())
        );
    }
    
    const chaptersHTML = filteredChapters.map((ch, index) => {
        const isLatest = index === 0;
        const isRead = lastReadSlug === ch.slug;
        const chapterNumber = ch.title.match(/\d+(\.\d+)?/)?.[0] || (index + 1);
        
        return `
            <div class="chapter-item ${isRead ? 'read' : ''} ${isLatest ? 'latest' : ''}" 
                 onclick="readChapter('${ch.slug}', '${currentComicSlug}')">
                <div class="chapter-info">
                    <div class="chapter-number">Chapter ${chapterNumber}</div>
                    <div class="chapter-title">${ch.title}</div>
                    ${isLatest ? '<span class="chapter-badge">TERBARU</span>' : ''}
                    ${isRead ? '<span class="chapter-badge">SUDAH DIBACA</span>' : ''}
                </div>
                <div class="chapter-actions">
                    <button class="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition">
                        <i class="fas fa-book-reader text-amber-500"></i>
                    </button>
                    <button class="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition">
                        <i class="fas fa-download text-blue-500"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="glass rounded-3xl p-6 border-white/5">
            <div class="chapter-search-container">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold">Daftar Chapter (${currentChapterList.length})</h3>
                    <div class="text-sm text-gray-400">
                        <i class="fas fa-book-reader text-amber-500 mr-1"></i>
                        ${savedItem?.lastChapterTitle ? `Terakhir dibaca: ${savedItem.lastChapterTitle}` : 'Belum ada riwayat'}
                    </div>
                </div>
                <div class="relative">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" 
                           id="chapter-search-input" 
                           placeholder="Cari chapter..." 
                           oninput="filterChapterList(this.value)"
                           class="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-amber-500"
                           value="${chapterSearchTerm}">
                    ${chapterSearchTerm ? `
                        <button onclick="clearChapterSearch()" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="sortChapters('asc')" class="text-xs px-3 py-1 rounded-lg glass hover:bg-amber-500/20">
                        <i class="fas fa-sort-amount-up mr-1"></i>Terlama
                    </button>
                    <button onclick="sortChapters('desc')" class="text-xs px-3 py-1 rounded-lg glass hover:bg-amber-500/20">
                        <i class="fas fa-sort-amount-down mr-1"></i>Terbaru
                    </button>
                    <button onclick="scrollToLatest()" class="text-xs px-3 py-1 rounded-lg glass hover:bg-amber-500/20">
                        <i class="fas fa-arrow-down mr-1"></i>Terakhir
                    </button>
                </div>
            </div>
            <div class="chapter-scroll mt-4 max-h-[500px] overflow-y-auto">
                ${chaptersHTML}
            </div>
            ${filteredChapters.length === 0 ? `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-search fa-2x mb-2"></i>
                    <p>Tidak ada chapter yang cocok dengan pencarian</p>
                </div>
            ` : ''}
        </div>
    `;
}

function filterChapterList(term) {
    chapterSearchTerm = term;
    document.querySelector('#chapter-list-container').innerHTML = renderChapterList();
}

function clearChapterSearch() {
    chapterSearchTerm = '';
    document.querySelector('#chapter-search-input').value = '';
    document.querySelector('#chapter-list-container').innerHTML = renderChapterList();
}

function sortChapters(order) {
    if (order === 'asc') {
        currentChapterList = [...currentChapterList].reverse();
    } else {
        currentChapterList = [...currentChapterList].reverse();
    }
    document.querySelector('#chapter-list-container').innerHTML = renderChapterList();
}

function scrollToLatest() {
    const container = document.querySelector('.chapter-scroll');
    if (container) {
        container.scrollTop = 0;
    }
}

async function showDetail(idOrSlug, push = true) {
    let slug = idOrSlug;
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;

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
    currentComicSlug = slug;
    chapterSearchTerm = '';

    const history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    const savedItem = history.find(h => h.slug === slug);
    const startBtnText = savedItem && savedItem.lastChapterTitle ? `Lanjut: ${savedItem.lastChapterTitle}` : "Baca Chapter Pertama";
    const startBtnAction = savedItem && savedItem.lastChapterSlug ? 
        `readChapter('${savedItem.lastChapterSlug}', '${slug}')` : 
        `readChapter('${res.chapters[res.chapters.length - 1].slug}', '${slug}')`;

    contentArea.innerHTML = `
        <div class="flex flex-col md:flex-row gap-10">
            <div class="md:w-1/3">
                <div class="relative">
                    <span class="type-badge ${getTypeClass(res.type)} scale-125 top-5 left-5">${res.type || 'Comic'}</span>
                    <img src="${res.image}" class="w-full rounded-3xl shadow-2xl border border-white/10">
                </div>
                <div class="flex flex-col gap-3 mt-6">
                    <button onclick="${startBtnAction}" class="amber-gradient w-full py-4 rounded-2xl font-bold text-black flex items-center justify-center gap-2 active:scale-95 transition">
                        <i class="fa fa-play"></i> ${startBtnText}
                    </button>
                    <button onclick="toggleBookmark('${slug}', '${res.title.replace(/'/g, "")}', '${res.image}')" id="btn-bookmark"
                        class="w-full py-4 rounded-2xl glass font-bold border-white/10 hover:bg-white/5 transition">
                        <i class="fa fa-bookmark"></i> Simpan Koleksi
                    </button>
                    <div class="glass rounded-2xl p-4 mt-4">
                        <h4 class="font-bold text-sm mb-2">Info Komik</h4>
                        <div class="space-y-2 text-xs">
                            <div class="flex justify-between"><span class="text-gray-400">Author:</span><span class="font-medium">${res.author || 'Unknown'}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">Status:</span><span class="font-medium text-green-400">${res.status}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">Rating:</span><span class="font-medium text-amber-500">⭐ ${res.rating}</span></div>
                            <div class="flex justify-between"><span class="text-gray-400">Total Chapter:</span><span class="font-medium">${res.chapters.length}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="md:w-2/3">
                <div class="flex flex-wrap gap-2 mb-4">
                    ${res.genres ? res.genres.map(g => `<span class="bg-amber-500/10 text-amber-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase border border-amber-500/20">${g.title}</span>`).join('') : ''}
                </div>
                <h1 class="text-3xl font-extrabold mb-4">${res.title}</h1>
                
                <p class="text-gray-400 text-sm leading-relaxed mb-8 text-justify">${res.synopsis || "Sinopsis tidak tersedia."}</p>
                
                <div id="chapter-list-container">
                    ${renderChapterList()}
                </div>
            </div>
        </div>
    `;
    checkBookmarkStatus(slug);
    saveHistory(slug, res.title, res.image);
    window.scrollTo(0,0);
}

async function readChapter(chIdOrSlug, comicSlug = null, push = true) {
    let chSlug = chIdOrSlug;
    contentArea.innerHTML = `<div class="flex justify-center py-40"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>`;

    if (chIdOrSlug.length === 36) {
        const mapping = await getSlugFromUuid(chIdOrSlug);
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
    const backAction = comicSlug ? `showDetail('${comicSlug}')` : `showHome()`;

    let dropdownHTML = '';
    if (currentChapterList && currentChapterList.length > 0) {
        dropdownHTML = `
            <select onchange="readChapter(this.value, '${comicSlug || ''}')" class="bg-black/80 text-white border border-white/20 rounded-lg text-xs p-2 mx-2 max-w-[150px]">
                ${currentChapterList.map(ch => `<option value="${ch.slug}" ${ch.slug === chSlug ? 'selected' : ''}>${ch.title}</option>`).join('')}
            </select>
        `;
    } else { dropdownHTML = `<span class="text-xs font-bold px-4">Navigasi</span>`; }

    // Optimized image loading with Intersection Observer
    initImageObserver();
    
    const imagesHTML = res.images.map((img, index) => `
        <div class="image-loading mb-1 max-w-full md:max-w-3xl mx-auto">
            <img data-src="${img}" 
                 class="chapter-image max-w-full"
                 alt="Halaman ${index + 1}"
                 onload="preloadNextImage(${index}, ${JSON.stringify(res.images)})">
        </div>
    `).join('');

    contentArea.innerHTML = `
        <div class="relative min-h-screen bg-black -mx-4 -mt-24">
            <div id="reader-top" class="reader-ui fixed top-0 w-full glass z-[60] p-4 flex justify-between items-center border-b border-white/10">
                <div class="flex items-center gap-2">
                    <button onclick="${backAction}" class="p-2 hover:bg-white/10 rounded-full"><i class="fa fa-arrow-left"></i></button>
                    <div class="flex flex-col">
                        <h2 class="text-xs font-bold truncate text-amber-500 max-w-[150px] md:max-w-xs">${chSlug.replace(/-/g, ' ')}</h2>
                        <div class="text-[10px] text-gray-400 flex items-center gap-2">
                            <span>Gambar: ${res.images.length}</span>
                            <button onclick="toggleImageQuality()" class="hover:text-amber-500" title="Toggle Quality">
                                <i class="fas fa-expand-arrows-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changeReadingMode()" class="p-2 hover:bg-white/10 rounded-full text-white/80" title="Mode Baca">
                        <i class="fas fa-columns"></i>
                    </button>
                    <button onclick="toggleFullScreen()" class="p-2 hover:bg-white/10 rounded-full text-white/80" title="Fullscreen">
                        <i class="fa fa-expand"></i>
                    </button>
                </div>
            </div>
            
            <div class="flex flex-col items-center pt-20 pb-40" onclick="toggleReaderUI()" id="image-container">
                ${imagesHTML}
            </div>
            
            <div id="reader-bottom" class="reader-ui fixed bottom-6 left-0 w-full z-[60] px-4 flex justify-center pointer-events-none">
                <div class="glass p-3 rounded-2xl flex gap-2 items-center shadow-2xl border border-white/10 pointer-events-auto">
                    <button onclick="${res.navigation.prev ? `readChapter('${res.navigation.prev}', '${comicSlug || ''}')` : ''}" 
                            class="p-3 bg-white/10 rounded-xl ${!res.navigation.prev ? 'opacity-20' : 'hover:bg-amber-500 hover:text-black transition'}"
                            title="Chapter Sebelumnya">
                        <i class="fa fa-chevron-left"></i>
                    </button>
                    ${dropdownHTML}
                    <button onclick="${res.navigation.next ? `readChapter('${res.navigation.next}', '${comicSlug || ''}')` : ''}" 
                            class="p-3 amber-gradient text-black rounded-xl ${!res.navigation.next ? 'opacity-20' : 'hover:scale-105 transition'}"
                            title="Chapter Berikutnya">
                        <i class="fa fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            
            <div id="loading-progress" class="fixed top-16 left-0 w-full h-1 bg-gray-800 z-50 hidden">
                <div class="h-full bg-amber-500 transition-all duration-300" style="width: 0%"></div>
            </div>
        </div>
    `;
    
    // Observe all images for lazy loading
    setTimeout(() => {
        document.querySelectorAll('.chapter-image[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }, 100);
    
    // Update reading progress
    const progressBar = document.getElementById('loading-progress');
    progressBar.classList.remove('hidden');
    
    let loadedImages = 0;
    const totalImages = res.images.length;
    
    document.querySelectorAll('.chapter-image').forEach(img => {
        img.onload = () => {
            loadedImages++;
            const progress = (loadedImages / totalImages) * 100;
            progressBar.querySelector('div').style.width = `${progress}%`;
            
            if (loadedImages === totalImages) {
                setTimeout(() => {
                    progressBar.classList.add('hidden');
                }, 500);
            }
        };
    });
    
    if(comicSlug) saveHistory(comicSlug, null, null, chSlug, chSlug.replace(/-/g, ' '));
    window.scrollTo(0,0);
}

function toggleImageQuality() {
    const images = document.querySelectorAll('.chapter-image');
    images.forEach(img => {
        const currentSrc = img.src;
        if (currentSrc.includes('quality=high')) {
            img.src = currentSrc.replace('quality=high', 'quality=low');
        } else if (currentSrc.includes('quality=low')) {
            img.src = currentSrc.replace('quality=low', 'quality=high');
        }
    });
}

function changeReadingMode() {
    const container = document.getElementById('image-container');
    container.classList.toggle('grid');
    container.classList.toggle('grid-cols-1');
    container.classList.toggle('grid-cols-2');
    container.classList.toggle('gap-4');
}

function toggleReaderUI() {
    document.getElementById('reader-top').classList.toggle('ui-hidden-top');
    document.getElementById('reader-bottom').classList.toggle('ui-hidden-bottom');
}

function handleSearch(e) { if(e.key === 'Enter') applyAdvancedFilter(); }

function saveHistory(slug, title, image, chSlug, chTitle) {
    let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    let existing = history.find(h => h.slug === slug);
    const data = {
        slug, title: title || existing?.title, image: image || existing?.image,
        lastChapterSlug: chSlug || existing?.lastChapterSlug, lastChapterTitle: chTitle || existing?.lastChapterTitle,
        lastRead: new Date().toISOString()
    };
    history = history.filter(h => h.slug !== slug);
    history.unshift(data);
    if (history.length > 30) history.pop();
    localStorage.setItem('fmc_history', JSON.stringify(history));
}

function showHistory() {
    let history = JSON.parse(localStorage.getItem('fmc_history') || '[]');
    renderGrid({ data: history }, "Riwayat Baca", null);
}

function toggleBookmark(slug, title, image) {
    let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const idx = bookmarks.findIndex(b => b.slug === slug);
    if (idx > -1) {
        bookmarks.splice(idx, 1);
    } else {
        bookmarks.push({ slug, title, image, added: new Date().toISOString() });
    }
    localStorage.setItem('fmc_bookmarks', JSON.stringify(bookmarks));
    checkBookmarkStatus(slug);
}

function checkBookmarkStatus(slug) {
    let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    const btn = document.getElementById('btn-bookmark');
    if (btn && bookmarks.some(b => b.slug === slug)) {
        btn.innerHTML = `<i class="fa fa-check text-amber-500"></i> Tersimpan`;
        btn.classList.add('border-amber-500');
    } else if (btn) {
        btn.innerHTML = `<i class="fa fa-bookmark"></i> Simpan Koleksi`;
        btn.classList.remove('border-amber-500');
    }
}

function showBookmarks() {
    let bookmarks = JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]');
    renderGrid({ data: bookmarks }, "Koleksi Favorit", null);
}

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
    else if (path === '/ongoing') {
        showOngoing(1);
    }
    else if (path === '/completed') {
        showCompleted(1);
    }
    else {
        showHome(false);
    }
}

window.addEventListener('popstate', () => handleInitialLoad());

document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    handleInitialLoad();
    
    // Initialize Intersection Observer
    initImageObserver();
});
