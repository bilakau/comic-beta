/**
 * FmcComic Pro - Core Application
 * Architecture: SPA with Vanilla JS
 */

const CONFIG = {
    API_PROXY: "https://api.nekolabs.web.id/px?url=",
    API_BASE: "https://www.sankavollerei.com/comic/komikcast",
    BACKEND: window.location.origin
};

const app = {
    state: {
        history: JSON.parse(localStorage.getItem('fmc_history') || '[]'),
        bookmarks: JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]'),
        currentComic: null,
        currentChapter: null
    },

    utils: {
        getUuid: async (slug, type) => {
            try {
                const res = await fetch(`${CONFIG.BACKEND}/api/get-id`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ slug, type })
                });
                return (await res.json()).uuid;
            } catch { return slug; }
        },
        getSlug: async (uuid) => {
            if(uuid.length !== 36) return uuid;
            try {
                const res = await fetch(`${CONFIG.BACKEND}/api/get-slug/${uuid}`);
                return (await res.json()).slug;
            } catch { return null; }
        },
        fetch: async (url) => {
            app.ui.loading(true);
            try {
                const res = await fetch(CONFIG.API_PROXY + encodeURIComponent(url));
                const data = await res.json();
                app.ui.loading(false);
                return data.success ? (data.result?.content || data.result || data) : null;
            } catch { 
                app.ui.loading(false); 
                return null; 
            }
        },
        getTypeClass: (t) => {
            const type = (t || '').toLowerCase();
            if(type.includes('manga')) return 'badge-manga';
            if(type.includes('manhwa')) return 'badge-manhwa';
            if(type.includes('manhua')) return 'badge-manhua';
            return 'bg-gray-600';
        },
        saveHistory: (data) => {
            let hist = app.state.history.filter(h => h.slug !== data.slug);
            hist.unshift({ ...data, timestamp: Date.now() });
            if(hist.length > 50) hist.pop();
            app.state.history = hist;
            localStorage.setItem('fmc_history', JSON.stringify(hist));
        },
        formatTime: (ts) => {
            const d = new Date(ts);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    },

    ui: {
        root: document.getElementById('app-root'),
        loading: (show) => {
            document.getElementById('loading-bar').style.width = show ? '70%' : '100%';
            setTimeout(() => {
                if(!show) document.getElementById('loading-bar').style.width = '0%';
            }, 300);
        },
        toast: (msg) => {
            const t = document.getElementById('toast');
            document.getElementById('toast-msg').innerText = msg;
            t.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
        },
        toggleSearch: () => {
            const el = document.getElementById('search-overlay');
            if(el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                setTimeout(() => el.classList.remove('opacity-0'), 10);
                document.getElementById('search-input').focus();
                app.ui.loadGenres();
            } else {
                el.classList.add('opacity-0');
                setTimeout(() => el.classList.add('hidden'), 300);
            }
        },
        loadGenres: async () => {
            const box = document.getElementById('genre-tags');
            if(box.children.length > 0) return;
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/genres`);
            if(data?.data) {
                box.innerHTML = data.data.sort(() => 0.5 - Math.random()).slice(0, 15).map(g => 
                    `<span onclick="app.pages.genre('${g.slug}');app.ui.toggleSearch()" class="cursor-pointer bg-white/5 hover:bg-amber-500 hover:text-black px-4 py-2 rounded-xl text-xs font-bold border border-white/10 transition">${g.title}</span>`
                ).join('');
            }
        },
        renderSkeleton: (type) => {
            if(type === 'grid') {
                return `<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-8">
                    ${Array(10).fill(0).map(() => `
                        <div class="aspect-[3/4] rounded-xl pulse-skeleton"></div>
                    `).join('')}
                </div>`;
            }
            if(type === 'detail') {
                return `<div class="flex flex-col md:flex-row gap-8 animate-pulse">
                    <div class="w-full md:w-1/3 aspect-[3/4] bg-gray-800 rounded-2xl"></div>
                    <div class="w-full md:w-2/3 space-y-4">
                        <div class="h-8 bg-gray-800 w-3/4 rounded"></div>
                        <div class="h-4 bg-gray-800 w-full rounded"></div>
                        <div class="h-4 bg-gray-800 w-full rounded"></div>
                    </div>
                </div>`;
            }
        },
        scrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' })
    },

    components: {
        comicCard: (item, progress = null) => {
            return `
            <div class="relative group cursor-pointer" onclick="app.router.navigate('/series/${item.uuid || item.slug}', '${item.slug}')">
                <div class="overflow-hidden rounded-xl aspect-[3/4] relative card-gloss">
                    <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white z-10 ${app.utils.getTypeClass(item.type)}">${item.type || 'COMIC'}</span>
                    <img src="${item.image}" loading="lazy" class="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-80">
                    <div class="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/70 to-transparent p-3 pt-10">
                        <h3 class="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-500 transition">${item.title}</h3>
                        <p class="text-[10px] text-gray-400 mt-0.5">${item.chapter || item.latestChapter || 'Unknown'}</p>
                        ${progress ? `
                            <div class="mt-2 flex items-center gap-2">
                                <div class="reading-progress-bg flex-1"><div class="reading-progress-fill" style="width: ${progress}%"></div></div>
                                <span class="text-[9px] text-amber-500">${progress}%</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>`;
        }
    },

    pages: {
        home: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/home`);
            if(!data) return;

            // Continue Reading Section
            let continueHTML = '';
            const history = app.state.history.slice(0, 5);
            if(history.length > 0) {
                continueHTML = `
                <section class="mb-10 fade-in">
                    <h2 class="text-lg font-bold mb-4 flex items-center gap-2 text-amber-500"><i class="fa fa-clock"></i> Lanjut Baca</h2>
                    <div class="flex gap-4 overflow-x-auto hide-scroll pb-2">
                        ${history.map(h => {
                            const progress = h.totalCh ? Math.round((h.readChIndex / h.totalCh) * 100) : 0;
                            return `
                            <div class="min-w-[140px] relative cursor-pointer" onclick="app.router.navigate('/chapter/${h.lastChapterUuid || h.lastChapterSlug}', null, true)">
                                <img src="${h.image}" class="w-full h-24 object-cover rounded-xl opacity-60 hover:opacity-100 transition border border-white/10">
                                <div class="absolute bottom-2 left-2 right-2">
                                    <p class="text-[10px] font-bold truncate text-white">${h.title}</p>
                                    <p class="text-[9px] text-amber-500 truncate">Ch. ${h.lastChapterTitle.replace(/Chapter/i, '')}</p>
                                    <div class="reading-progress-bg mt-1 h-1"><div class="reading-progress-fill" style="width: ${progress}%"></div></div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </section>`;
            }

            // Popular Slider
            const sliderHTML = `
            <section class="mb-10 fade-in">
                <div class="flex overflow-x-auto snap-x-mandatory hide-scroll gap-4 pb-4">
                    ${data.data.hotUpdates.map(item => `
                        <div class="snap-center min-w-[85vw] md:min-w-[400px] h-48 md:h-64 rounded-2xl relative overflow-hidden cursor-pointer shadow-lg border border-white/5" onclick="app.router.navigate('/series/${item.slug}', '${item.slug}')">
                            <img src="${item.image}" class="absolute inset-0 w-full h-full object-cover">
                            <div class="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent flex flex-col justify-center pl-6 pr-20">
                                <span class="bg-amber-500 text-black text-[10px] font-bold px-2 py-1 rounded w-fit mb-2">${item.type}</span>
                                <h2 class="text-xl md:text-2xl font-black text-white leading-tight line-clamp-2 text-shadow">${item.title}</h2>
                                <p class="text-gray-300 text-xs mt-2 line-clamp-2">${item.latestChapter}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>`;

            const latestGrid = `
            <section class="fade-in">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Rilis Terbaru</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${data.data.latestReleases.map(item => app.components.comicCard(item)).join('')}
                </div>
            </section>`;

            app.ui.root.innerHTML = continueHTML + sliderHTML + latestGrid;
        },

        detail: async (slug) => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('detail');
            app.ui.scrollToTop();
            
            // Handle UUID to Slug
            let realSlug = slug;
            if(slug.length === 36) {
                const map = await app.utils.getSlug(slug);
                if(map) realSlug = map;
            }

            // Check API
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/detail/${realSlug}`);
            if(!data || !data.data) return app.ui.root.innerHTML = `<div class="text-center mt-20">Gagal memuat komik.</div>`;

            const c = data.data;
            app.state.currentComic = c;

            // Bookmark Status
            const isBookmarked = app.state.bookmarks.some(b => b.slug === realSlug);
            
            // History Data
            const hist = app.state.history.find(h => h.slug === realSlug);
            const lastRead = hist ? hist.lastChapterSlug : null;

            // Save UUID mapping silently
            app.utils.getUuid(realSlug, 'series');

            app.ui.root.innerHTML = `
            <div class="fade-in max-w-5xl mx-auto">
                <!-- Header Info -->
                <div class="relative w-full h-[300px] rounded-3xl overflow-hidden mb-[-100px] border border-white/5">
                    <img src="${c.image}" class="w-full h-full object-cover blur-sm opacity-40">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent"></div>
                </div>

                <div class="relative px-4 flex flex-col md:flex-row gap-8">
                    <div class="flex-shrink-0 mx-auto md:mx-0">
                        <img src="${c.image}" class="w-48 md:w-60 rounded-xl shadow-2xl border-2 border-white/10 z-10 relative">
                    </div>
                    <div class="flex-1 pt-4 md:pt-16 text-center md:text-left z-10">
                        <h1 class="text-2xl md:text-4xl font-black mb-2 leading-tight">${c.title}</h1>
                        <div class="flex flex-wrap justify-center md:justify-start gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-4">
                            <span>${c.status}</span> • <span>${c.type}</span> • <span class="text-amber-500"><i class="fa fa-star"></i> ${c.rating}</span>
                        </div>
                        
                        <div class="flex justify-center md:justify-start gap-3 mb-6">
                            <button onclick="app.router.navigate('/chapter/${lastRead || c.chapters[c.chapters.length-1].slug}', null, true)" 
                                class="bg-amber-500 text-black px-8 py-3 rounded-xl font-bold hover:scale-105 transition shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                                <i class="fa ${lastRead ? 'fa-play' : 'fa-book'}"></i> ${lastRead ? 'Lanjut Baca' : 'Mulai Baca'}
                            </button>
                            <button onclick="app.handlers.toggleBookmark('${realSlug}', '${c.title.replace(/'/g,"")}', '${c.image}')" 
                                class="glass px-4 py-3 rounded-xl hover:bg-white/10 transition border border-white/10">
                                <i class="fa ${isBookmarked ? 'fa-bookmark text-amber-500' : 'fa-bookmark-o'}"></i>
                            </button>
                        </div>
                        
                        <div class="glass p-4 rounded-xl text-sm text-gray-400 leading-relaxed text-justify mb-6 border border-white/5">
                            <h3 class="font-bold text-white mb-1">Sinopsis</h3>
                            ${c.synopsis}
                        </div>
                    </div>
                </div>

                <!-- Chapter List -->
                <div class="mt-8 glass rounded-2xl p-6 border border-white/5">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold">Chapter List (${c.chapters.length})</h3>
                        <div class="text-xs text-gray-500"><i class="fa fa-sort"></i> Update: ${c.updatedOn || '-'}</div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scroll">
                        ${c.chapters.map((ch, idx) => {
                            const isRead = hist && hist.readChapters && hist.readChapters.includes(ch.slug);
                            return `
                            <div onclick="app.router.navigate('/chapter/${ch.slug}', null, true)" 
                                class="p-3 rounded-lg flex justify-between items-center cursor-pointer transition border border-white/5 
                                ${lastRead === ch.slug ? 'bg-amber-500/20 border-amber-500/50' : 'hover:bg-white/5 bg-white/[0.02]'}">
                                <span class="text-sm font-medium ${isRead ? 'text-gray-500' : 'text-gray-200'}">${ch.title}</span>
                                <span class="text-[10px] text-gray-500">${ch.date || ''}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        },

        reader: async (slug) => {
            app.ui.root.innerHTML = `<div class="h-screen flex items-center justify-center"><div class="animate-spin h-10 w-10 border-4 border-amber-500 rounded-full border-t-transparent"></div></div>`;
            document.getElementById('navbar').classList.add('-translate-y-full');
            
            // UUID Handling
            let realSlug = slug;
            if(slug.length === 36) {
                const map = await app.utils.getSlug(slug);
                if(map) realSlug = map;
            }

            const data = await app.utils.fetch(`${CONFIG.API_BASE}/chapter/${realSlug}`);
            if(!data || !data.data) {
                app.ui.toast("Error load chapter");
                app.router.navigate('/'); return;
            }

            const ch = data.data;
            
            // Save Progress Logic
            // Kita coba cari slug series dari URL atau History sebelumnya untuk konteks
            let seriesSlug = '';
            // Hacky way to find series slug from chapter text or previous history
            // Better implementation: pass series slug in state
            
            // Render
            app.ui.root.innerHTML = `
            <div class="bg-black min-h-screen relative -mt-20 reader-container" onclick="document.getElementById('reader-bar').classList.toggle('translate-y-full')">
                <div class="fixed top-0 w-full p-4 z-50 glass flex justify-between items-center transition-transform" id="reader-top">
                    <button onclick="window.history.back()" class="w-10 h-10 bg-black/50 rounded-full text-white"><i class="fa fa-arrow-left"></i></button>
                    <span class="text-xs font-bold truncate max-w-[200px]">${ch.title}</span>
                    <button onclick="document.documentElement.requestFullscreen()" class="w-10 h-10 bg-black/50 rounded-full text-white"><i class="fa fa-expand"></i></button>
                </div>

                <div class="pb-24 pt-0 mx-auto max-w-3xl">
                    ${ch.images.map(img => `<img src="${img}" loading="lazy" class="w-full">`).join('')}
                </div>

                <div id="reader-bar" class="fixed bottom-0 w-full p-4 glass z-50 transition-transform duration-300">
                    <div class="flex justify-center gap-4 max-w-md mx-auto">
                        <button ${ch.navigation.prev ? `onclick="app.router.navigate('/chapter/${ch.navigation.prev}', null, true)"` : 'disabled'} class="flex-1 py-3 rounded-xl bg-white/10 disabled:opacity-30"><i class="fa fa-chevron-left"></i> Prev</button>
                        <button ${ch.navigation.next ? `onclick="app.router.navigate('/chapter/${ch.navigation.next}', null, true)"` : 'disabled'} class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold disabled:opacity-30">Next <i class="fa fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>`;
            
            // Auto Update History (Simple Version)
            // Note: di implementasi real, kita butuh tahu Parent Comicnya siapa.
            // Disini kita asumsi user datang dari halaman Detail, jadi kita update history terakhir yang cocok.
            // Atau kita fetch detail chapter untuk dapat breadcrumb (jika API support).
            
            // Simulasi update history "terakhir dibaca" di item paling atas
            const lastRead = app.state.history[0];
            if(lastRead) {
                // Update simple
                lastRead.lastChapterSlug = realSlug;
                lastRead.lastChapterTitle = ch.title;
                // Save UUID too
                const uuid = await app.utils.getUuid(realSlug, 'chapter');
                lastRead.lastChapterUuid = uuid;
                app.utils.saveHistory(lastRead);
            }
        },

        library: () => {
             // Gabungan History & Bookmarks
            const bookmarks = app.state.bookmarks;
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-2xl font-bold mb-6 flex items-center gap-2"><i class="fa fa-bookmark text-amber-500"></i> Koleksi Saya</h2>
                ${bookmarks.length === 0 ? '<div class="text-center text-gray-500 mt-20">Belum ada koleksi.</div>' : ''}
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${bookmarks.map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        },

        search: async (query) => {
            app.ui.toggleSearch();
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/search/${query}/1`);
            
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-xl font-bold mb-6">Hasil: "${query}"</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${(data?.data || []).map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        },
        
        genre: async (slug) => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/genre/${slug}/1`);
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-xl font-bold mb-6 capitalize">Genre: ${slug}</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${(data?.data || []).map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        },

        ongoing: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/list?status=Ongoing&orderby=popular&page=1`);
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-green-500 pl-4">Komik Ongoing</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${(data?.data || []).map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        },

        completed: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/list?status=Completed&orderby=popular&page=1`);
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-blue-500 pl-4">Komik Tamat</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${(data?.data || []).map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        }
    },

    handlers: {
        toggleBookmark: (slug, title, image) => {
            const idx = app.state.bookmarks.findIndex(b => b.slug === slug);
            if(idx > -1) {
                app.state.bookmarks.splice(idx, 1);
                app.ui.toast("Dihapus dari koleksi");
            } else {
                app.state.bookmarks.push({slug, title, image, added: Date.now()});
                app.ui.toast("Disimpan ke koleksi");
            }
            localStorage.setItem('fmc_bookmarks', JSON.stringify(app.state.bookmarks));
            // Re-render button icon if in detail page
            const btn = document.querySelector('.fa-bookmark, .fa-bookmark-o');
            if(btn) {
                btn.className = idx > -1 ? 'fa fa-bookmark-o' : 'fa fa-bookmark text-amber-500';
            }
        }
    },

    router: {
        navigate: (path, slugHint = null, isChapter = false) => {
            window.history.pushState({}, '', path);
            app.router.resolve(path);
            
            // Get UUID in background for clean URLs next time
            if(slugHint) {
                const type = isChapter ? 'chapter' : 'series';
                app.utils.getUuid(slugHint, type);
            }
        },
        resolve: (path) => {
            // Reset UI
            document.getElementById('navbar').classList.remove('-translate-y-full');
            
            if(path === '/' || path === '/index.html') return app.pages.home();
            if(path === '/ongoing') return app.pages.ongoing();
            if(path === '/completed') return app.pages.completed();
            
            if(path.includes('/series/')) {
                const slug = path.split('/series/')[1];
                return app.pages.detail(slug);
            }
            if(path.includes('/chapter/')) {
                const slug = path.split('/chapter/')[1];
                return app.pages.reader(slug);
            }
            
            return app.pages.home();
        }
    }
};

// Init
window.addEventListener('popstate', () => app.router.resolve(window.location.pathname));
document.addEventListener('DOMContentLoaded', () => {
    app.router.resolve(window.location.pathname);
});
