/**
 * FmcComic Pro - Core Application (Stable Version)
 */

const CONFIG = {
    // Kita gunakan backup proxy jika yang utama mati
    API_PROXY: "https://api.nekolabs.web.id/px?url=", 
    API_BASE: "https://www.sankavollerei.com/comic/komikcast",
    BACKEND: window.location.origin
};

const app = {
    state: {
        history: JSON.parse(localStorage.getItem('fmc_history') || '[]'),
        bookmarks: JSON.parse(localStorage.getItem('fmc_bookmarks') || '[]'),
        currentComic: null
    },

    utils: {
        getUuid: async (slug, type) => {
            try {
                // Fail-safe: Jika backend belum siap, langsung return slug
                const res = await fetch(`${CONFIG.BACKEND}/api/get-id`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ slug, type })
                });
                if(!res.ok) throw new Error("Backend Error");
                const json = await res.json();
                return json.uuid || slug;
            } catch (e) { 
                console.warn("UUID System offline, using slug:", slug);
                return slug; 
            }
        },
        getSlug: async (uuid) => {
            if(uuid.length !== 36) return uuid;
            try {
                const res = await fetch(`${CONFIG.BACKEND}/api/get-slug/${uuid}`);
                if(!res.ok) return uuid;
                return (await res.json()).slug;
            } catch { return uuid; }
        },
        fetch: async (url) => {
            app.ui.loading(true);
            try {
                // Tambahkan timeout 10 detik agar tidak loading selamanya
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const res = await fetch(CONFIG.API_PROXY + encodeURIComponent(url), {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if(!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                app.ui.loading(false);
                if (data.success === false) return null;
                return data.result?.content || data.result || data;
            } catch (e) { 
                console.error("Fetch Error:", e);
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
        }
    },

    ui: {
        root: document.getElementById('app-root'),
        loading: (show) => {
            const bar = document.getElementById('loading-bar');
            if(bar) {
                bar.style.width = show ? '70%' : '100%';
                setTimeout(() => { if(!show) bar.style.width = '0%'; }, 300);
            }
        },
        toast: (msg) => {
            const t = document.getElementById('toast');
            const tm = document.getElementById('toast-msg');
            if(t && tm) {
                tm.innerText = msg;
                t.classList.remove('translate-y-20', 'opacity-0');
                setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
            }
        },
        showError: (msg, retryFunc) => {
            app.ui.root.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
                    <i class="fa fa-exclamation-triangle text-4xl text-amber-500 mb-4"></i>
                    <h3 class="text-xl font-bold mb-2">Gagal Memuat</h3>
                    <p class="text-gray-400 mb-6 text-sm max-w-xs">${msg}</p>
                    <button onclick="${retryFunc}" class="bg-amber-500 text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition">
                        <i class="fa fa-refresh"></i> Coba Lagi
                    </button>
                </div>
            `;
        },
        toggleSearch: () => {
            const el = document.getElementById('search-overlay');
            if(el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                setTimeout(() => el.classList.remove('opacity-0'), 10);
                document.getElementById('search-input')?.focus();
            } else {
                el.classList.add('opacity-0');
                setTimeout(() => el.classList.add('hidden'), 300);
            }
        },
        renderSkeleton: (type) => {
            // Skeleton sederhana agar tidak berat
            if(type === 'grid') {
                return `<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-8 animate-pulse">
                    ${Array(6).fill(0).map(() => `<div class="aspect-[3/4] bg-white/5 rounded-xl"></div>`).join('')}
                </div>`;
            }
            return `<div class="w-full h-64 bg-white/5 rounded-xl animate-pulse"></div>`;
        },
        scrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' })
    },

    components: {
        comicCard: (item) => {
            if(!item) return '';
            // Validasi data agar tidak error
            const title = item.title || 'Tanpa Judul';
            const image = item.image || 'https://via.placeholder.com/200x300?text=No+Image';
            const type = item.type || 'Comic';
            const ch = item.chapter || item.latestChapter || 'Ch.?';
            const slug = item.slug || '#';
            const uuid = item.uuid || slug;

            return `
            <div class="relative group cursor-pointer" onclick="app.router.navigate('/series/${uuid}', '${slug}')">
                <div class="overflow-hidden rounded-xl aspect-[3/4] relative card-gloss bg-[#1f1f23]">
                    <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white z-10 ${app.utils.getTypeClass(type)} shadow-md">${type}</span>
                    <img src="${image}" loading="lazy" class="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-80" onerror="this.src='https://via.placeholder.com/200x300?text=Error'">
                    <div class="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-10">
                        <h3 class="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-500 transition">${title}</h3>
                        <p class="text-[10px] text-gray-400 mt-0.5">${ch}</p>
                    </div>
                </div>
            </div>`;
        }
    },

    pages: {
        home: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/home`);
            
            if(!data || !data.data) {
                return app.ui.showError("Gagal mengambil data komik. Pastikan koneksi lancar.", "app.pages.home()");
            }

            try {
                // Safe Mapping
                const hotUpdates = data.data.hotUpdates || [];
                const latest = data.data.latestReleases || [];

                // Slider HTML
                let sliderHTML = '';
                if(hotUpdates.length > 0) {
                    sliderHTML = `
                    <section class="mb-10 fade-in">
                        <div class="flex overflow-x-auto snap-x-mandatory hide-scroll gap-4 pb-4">
                            ${hotUpdates.map(item => `
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
                }

                const latestGrid = `
                <section class="fade-in">
                    <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Rilis Terbaru</h2>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        ${latest.map(item => app.components.comicCard(item)).join('')}
                    </div>
                </section>`;

                app.ui.root.innerHTML = sliderHTML + latestGrid;
            } catch (err) {
                console.error(err);
                app.ui.showError("Terjadi kesalahan saat memproses data.", "app.pages.home()");
            }
        },

        detail: async (slug) => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            app.ui.scrollToTop();
            
            let realSlug = slug;
            if(slug.length === 36) {
                const map = await app.utils.getSlug(slug);
                if(map) realSlug = map;
            }

            const data = await app.utils.fetch(`${CONFIG.API_BASE}/detail/${realSlug}`);
            if(!data || !data.data) return app.ui.showError("Komik tidak ditemukan atau gagal dimuat.", `app.pages.detail('${slug}')`);

            const c = data.data;
            const isBookmarked = app.state.bookmarks.some(b => b.slug === realSlug);
            
            // Save context for UUID
            app.utils.getUuid(realSlug, 'series');

            app.ui.root.innerHTML = `
            <div class="fade-in max-w-5xl mx-auto pb-20">
                <div class="relative w-full h-[250px] md:h-[350px] rounded-3xl overflow-hidden mb-[-80px] border border-white/5">
                    <img src="${c.image}" class="w-full h-full object-cover blur-sm opacity-30">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent"></div>
                </div>

                <div class="relative px-4 flex flex-col md:flex-row gap-8">
                    <div class="flex-shrink-0 mx-auto md:mx-0">
                        <img src="${c.image}" class="w-40 md:w-60 rounded-xl shadow-2xl border-2 border-white/10 z-10 relative">
                    </div>
                    <div class="flex-1 pt-4 md:pt-16 text-center md:text-left z-10">
                        <h1 class="text-2xl md:text-4xl font-black mb-2 leading-tight">${c.title}</h1>
                        <div class="flex flex-wrap justify-center md:justify-start gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-4">
                            <span>${c.status || 'Unknown'}</span> • <span>${c.type || 'Comic'}</span> • <span class="text-amber-500"><i class="fa fa-star"></i> ${c.rating || '-'}</span>
                        </div>
                        
                        <div class="glass p-4 rounded-xl text-sm text-gray-300 leading-relaxed text-justify mb-6 border border-white/5 max-h-40 overflow-y-auto">
                            ${c.synopsis || 'Tidak ada sinopsis.'}
                        </div>

                        <div class="mt-8 glass rounded-2xl p-4 border border-white/5 text-left">
                            <h3 class="font-bold mb-4">Chapter List</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scroll">
                                ${c.chapters.map(ch => `
                                    <div onclick="app.router.navigate('/chapter/${ch.slug}', null, true)" 
                                        class="p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-white/10 bg-white/5 border border-white/5 transition">
                                        <span class="text-sm font-medium text-gray-200 truncate pr-2">${ch.title}</span>
                                        <span class="text-[10px] text-gray-500 whitespace-nowrap">${ch.date || ''}</span>
                                    </div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        },

        reader: async (slug) => {
            app.ui.root.innerHTML = `<div class="h-screen flex items-center justify-center flex-col gap-4"><div class="animate-spin h-10 w-10 border-4 border-amber-500 rounded-full border-t-transparent"></div><p class="text-xs text-gray-500">Memuat Chapter...</p></div>`;
            const nav = document.getElementById('navbar');
            if(nav) nav.classList.add('-translate-y-full');
            
            let realSlug = slug;
            if(slug.length === 36) {
                const map = await app.utils.getSlug(slug);
                if(map) realSlug = map;
            }

            const data = await app.utils.fetch(`${CONFIG.API_BASE}/chapter/${realSlug}`);
            if(!data || !data.data) {
                if(nav) nav.classList.remove('-translate-y-full');
                return app.ui.showError("Gagal memuat gambar chapter.", `app.pages.reader('${slug}')`);
            }

            const ch = data.data;
            const images = ch.images || [];

            app.ui.root.innerHTML = `
            <div class="bg-black min-h-screen relative -mt-20 reader-container">
                <div class="fixed top-0 w-full p-3 z-50 glass flex justify-between items-center transition-transform" id="reader-top">
                    <button onclick="window.history.back()" class="w-10 h-10 bg-black/50 rounded-full text-white flex items-center justify-center"><i class="fa fa-arrow-left"></i></button>
                    <span class="text-xs font-bold truncate max-w-[150px] text-center">${ch.title}</span>
                    <button onclick="document.documentElement.requestFullscreen().catch(e=>{})" class="w-10 h-10 bg-black/50 rounded-full text-white flex items-center justify-center"><i class="fa fa-expand"></i></button>
                </div>

                <div class="pb-20 pt-0 mx-auto max-w-3xl" onclick="document.getElementById('reader-top').classList.toggle('-translate-y-full');document.getElementById('reader-bot').classList.toggle('translate-y-full')">
                    ${images.map(img => `<img src="${img}" loading="lazy" class="w-full mb-1 min-h-[200px] bg-[#1a1a1a]" onerror="this.style.display='none'">`).join('')}
                </div>

                <div id="reader-bot" class="fixed bottom-0 w-full p-4 glass z-50 transition-transform duration-300">
                    <div class="flex justify-center gap-4 max-w-md mx-auto">
                        <button ${ch.navigation.prev ? `onclick="app.router.navigate('/chapter/${ch.navigation.prev}', null, true)"` : 'disabled'} class="flex-1 py-3 rounded-xl bg-white/10 disabled:opacity-30"><i class="fa fa-chevron-left"></i></button>
                        <button ${ch.navigation.next ? `onclick="app.router.navigate('/chapter/${ch.navigation.next}', null, true)"` : 'disabled'} class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold disabled:opacity-30"><i class="fa fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>`;
        },

        ongoing: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/list?status=Ongoing&orderby=popular&page=1`);
            if(!data) return app.ui.showError("Gagal load data.", "app.pages.ongoing()");
            
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-green-500 pl-4">Komik Ongoing</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${(data.data || []).map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        },

        completed: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/list?status=Completed&orderby=popular&page=1`);
            if(!data) return app.ui.showError("Gagal load data.", "app.pages.completed()");

            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-blue-500 pl-4">Komik Tamat</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${(data.data || []).map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        }
    },

    router: {
        navigate: (path, slugHint = null, isChapter = false) => {
            window.history.pushState({}, '', path);
            app.router.resolve(path);
            if(slugHint) app.utils.getUuid(slugHint, isChapter ? 'chapter' : 'series');
        },
        resolve: (path) => {
            const nav = document.getElementById('navbar');
            if(nav) nav.classList.remove('-translate-y-full');
            
            if(path === '/' || path === '/index.html') return app.pages.home();
            if(path === '/ongoing') return app.pages.ongoing();
            if(path === '/completed') return app.pages.completed();
            
            if(path.includes('/series/')) return app.pages.detail(path.split('/series/')[1]);
            if(path.includes('/chapter/')) return app.pages.reader(path.split('/chapter/')[1]);
            
            return app.pages.home();
        }
    }
};

window.addEventListener('popstate', () => app.router.resolve(window.location.pathname));
document.addEventListener('DOMContentLoaded', () => app.router.resolve(window.location.pathname));
