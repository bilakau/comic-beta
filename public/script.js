/**
 * FmcComic Pro - Core Application (Fixed Version)
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
        darkMode: localStorage.getItem('fmc_dark') !== 'false'
    },

    utils: {
        // Mengambil UUID dari Slug (Wajib untuk URL)
        getUuid: async (slug, type) => {
            try {
                // Cek local storage dulu biar cepat
                const cacheKey = `uuid_${slug}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) return cached;

                const res = await fetch(`${CONFIG.BACKEND}/api/get-id`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ slug, type })
                });
                if(!res.ok) throw new Error("Backend Error");
                const json = await res.json();
                
                // Simpan ke cache
                if(json.uuid) localStorage.setItem(cacheKey, json.uuid);
                
                return json.uuid || slug;
            } catch (e) { return slug; }
        },
        // Mengambil Slug dari UUID (Untuk request ke API Komik)
        getSlug: async (uuid) => {
            if(uuid.length !== 36) return uuid; // Kalau bukan UUID, return as is
            try {
                const res = await fetch(`${CONFIG.BACKEND}/api/get-slug/${uuid}`);
                if(!res.ok) return uuid;
                return (await res.json()).slug;
            } catch { return uuid; }
        },
        fetch: async (url) => {
            app.ui.loading(true);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
                
                const res = await fetch(CONFIG.API_PROXY + encodeURIComponent(url), { signal: controller.signal });
                clearTimeout(timeoutId);

                const data = await res.json();
                app.ui.loading(false);
                return data.success ? (data.result?.content || data.result || data) : null;
            } catch (e) { 
                console.error(e);
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
            if(t) {
                document.getElementById('toast-msg').innerText = msg;
                t.classList.remove('translate-y-20', 'opacity-0');
                setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
            }
        },
        toggleSearch: () => {
            const el = document.getElementById('search-overlay');
            el.classList.toggle('hidden');
            if(!el.classList.contains('hidden')) {
                setTimeout(() => el.classList.remove('opacity-0'), 10);
                document.getElementById('search-input')?.focus();
            } else {
                el.classList.add('opacity-0');
            }
        },
        toggleSettings: () => {
            // Simple Settings Modal
            const confirmReset = confirm("Menu Pengaturan:\n\nOK = Reset Riwayat & Cache\nCancel = Tutup");
            if(confirmReset) {
                localStorage.clear();
                window.location.reload();
            }
        },
        renderSkeleton: (type) => {
            if(type === 'grid') {
                return `<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-8 animate-pulse">
                    ${Array(8).fill(0).map(() => `<div class="aspect-[3/4] bg-white/5 rounded-xl"></div>`).join('')}
                </div>`;
            }
            return `<div class="w-full h-64 bg-white/5 rounded-xl animate-pulse"></div>`;
        },
        scrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
        showError: (msg, retry) => {
            app.ui.root.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
                    <i class="fa fa-bug text-4xl text-amber-500 mb-4"></i>
                    <p class="text-gray-400 mb-6">${msg}</p>
                    <button onclick="${retry}" class="bg-white/10 px-6 py-2 rounded-full hover:bg-amber-500 hover:text-black transition">Coba Lagi</button>
                </div>`;
        }
    },

    components: {
        comicCard: (item) => {
            if(!item) return '';
            const title = item.title || 'Unknown Title';
            const image = item.image || 'https://via.placeholder.com/200x300';
            const type = item.type || 'Comic';
            // Fix: Ambil chapter dari berbagai kemungkinan key API
            const ch = item.chapter || item.latestChapter || (item.chapters ? item.chapters[0]?.title : 'Ch.?'); 
            const slug = item.slug || '#';
            const uuid = item.uuid || slug; // Ini akan dihandle router nanti

            return `
            <div class="relative group cursor-pointer" onclick="app.router.navigate(null, '${slug}', false)">
                <div class="overflow-hidden rounded-xl aspect-[3/4] relative card-gloss bg-[#1f1f23]">
                    <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white z-10 ${app.utils.getTypeClass(type)} shadow-md">${type}</span>
                    <img src="${image}" loading="lazy" class="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-80">
                    <div class="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent p-3 pt-10">
                        <h3 class="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-500 transition">${title}</h3>
                        <p class="text-[10px] text-amber-500 mt-1 font-medium">${ch}</p>
                    </div>
                </div>
            </div>`;
        }
    },

    pages: {
        home: async () => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            const data = await app.utils.fetch(`${CONFIG.API_BASE}/home`);
            
            if(!data || !data.data) return app.ui.showError("Gagal memuat data Home", "app.pages.home()");

            const hot = data.data.hotUpdates || [];
            const latest = data.data.latestReleases || [];

            let html = '';

            // Fix Hot Slider
            if(hot.length > 0) {
                html += `
                <section class="mb-8 fade-in">
                    <div class="flex overflow-x-auto snap-x-mandatory hide-scroll gap-4 pb-4">
                        ${hot.map(item => `
                            <div class="snap-center min-w-[85vw] md:min-w-[400px] h-48 md:h-64 rounded-2xl relative overflow-hidden cursor-pointer shadow-lg border border-white/5" 
                                onclick="app.router.navigate(null, '${item.slug}', false)">
                                <img src="${item.image}" class="absolute inset-0 w-full h-full object-cover">
                                <div class="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent flex flex-col justify-center pl-6 pr-20">
                                    <span class="bg-amber-500 text-black text-[10px] font-bold px-2 py-1 rounded w-fit mb-2">${item.type}</span>
                                    <h2 class="text-xl md:text-2xl font-black text-white leading-tight line-clamp-2 text-shadow">${item.title}</h2>
                                    <p class="text-gray-300 text-xs mt-2 font-mono">${item.latestChapter || item.chapter}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>`;
            }

            html += `
            <section class="fade-in">
                <h2 class="text-xl font-bold mb-6 border-l-4 border-amber-500 pl-4">Update Terbaru</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${latest.map(item => app.components.comicCard(item)).join('')}
                </div>
            </section>`;

            app.ui.root.innerHTML = html;
        },

        detail: async (idOrSlug) => {
            app.ui.root.innerHTML = app.ui.renderSkeleton('grid');
            app.ui.scrollToTop();
            
            // Konversi UUID ke Slug untuk Fetch API
            let fetchSlug = idOrSlug;
            if(idOrSlug.length === 36) {
                const map = await app.utils.getSlug(idOrSlug);
                if(map) fetchSlug = map;
            }

            const data = await app.utils.fetch(`${CONFIG.API_BASE}/detail/${fetchSlug}`);
            if(!data || !data.data) return app.ui.showError("Komik tidak ditemukan", "window.history.back()");

            const c = data.data;
            const isBookmarked = app.state.bookmarks.some(b => b.slug === fetchSlug);
            
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
                            <span>${c.status}</span> • <span>${c.type}</span> • <span class="text-amber-500">⭐ ${c.rating}</span>
                        </div>
                        
                        <div class="flex justify-center md:justify-start gap-3 mb-6">
                            <button onclick="app.router.navigate(null, '${c.chapters[c.chapters.length-1].slug}', true)" 
                                class="bg-amber-500 text-black px-8 py-3 rounded-xl font-bold hover:scale-105 transition shadow-lg shadow-amber-500/20">
                                Mulai Baca
                            </button>
                            <button onclick="app.handlers.toggleBookmark('${fetchSlug}', '${c.title.replace(/'/g,"")}', '${c.image}')" 
                                class="glass px-4 py-3 rounded-xl hover:bg-white/10 transition border border-white/10">
                                <i class="fa ${isBookmarked ? 'fa-bookmark text-amber-500' : 'fa-bookmark-o'}"></i>
                            </button>
                        </div>
                        
                        <div class="glass p-4 rounded-xl text-sm text-gray-300 leading-relaxed text-justify mb-6 border border-white/5 max-h-40 overflow-y-auto">
                            ${c.synopsis}
                        </div>

                        <div class="mt-8 glass rounded-2xl p-4 border border-white/5 text-left">
                            <h3 class="font-bold mb-4">Daftar Chapter</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scroll">
                                ${c.chapters.map(ch => `
                                    <div onclick="app.router.navigate(null, '${ch.slug}', true)" 
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

        reader: async (idOrSlug) => {
            app.ui.root.innerHTML = `<div class="h-screen flex items-center justify-center flex-col gap-4"><div class="animate-spin h-10 w-10 border-4 border-amber-500 rounded-full border-t-transparent"></div><p>Memuat Gambar...</p></div>`;
            document.getElementById('navbar').classList.add('-translate-y-full');
            
            let fetchSlug = idOrSlug;
            if(idOrSlug.length === 36) {
                const map = await app.utils.getSlug(idOrSlug);
                if(map) fetchSlug = map;
            }

            const data = await app.utils.fetch(`${CONFIG.API_BASE}/chapter/${fetchSlug}`);
            if(!data || !data.data) {
                document.getElementById('navbar').classList.remove('-translate-y-full');
                return app.ui.showError("Gagal memuat gambar", "window.history.back()");
            }

            const ch = data.data;
            app.ui.root.innerHTML = `
            <div class="bg-black min-h-screen relative -mt-20 reader-container">
                <div class="fixed top-0 w-full p-3 z-50 glass flex justify-between items-center transition-transform" id="reader-top">
                    <button onclick="window.history.back()" class="w-10 h-10 bg-black/50 rounded-full text-white flex items-center justify-center"><i class="fa fa-arrow-left"></i></button>
                    <span class="text-xs font-bold truncate max-w-[150px] text-center text-amber-500">${ch.title}</span>
                    <button onclick="document.documentElement.requestFullscreen().catch(e=>{})" class="w-10 h-10 bg-black/50 rounded-full text-white flex items-center justify-center"><i class="fa fa-expand"></i></button>
                </div>

                <div class="pb-20 pt-0 mx-auto max-w-3xl" onclick="document.getElementById('reader-top').classList.toggle('-translate-y-full');document.getElementById('reader-bot').classList.toggle('translate-y-full')">
                    ${ch.images.map(img => `<img src="${img}" loading="lazy" class="w-full mb-1 min-h-[200px] bg-[#1a1a1a]" onerror="this.style.display='none'">`).join('')}
                </div>

                <div id="reader-bot" class="fixed bottom-0 w-full p-4 glass z-50 transition-transform duration-300">
                    <div class="flex justify-center gap-4 max-w-md mx-auto">
                        <button ${ch.navigation.prev ? `onclick="app.router.navigate(null, '${ch.navigation.prev}', true)"` : 'disabled'} class="flex-1 py-3 rounded-xl bg-white/10 disabled:opacity-30"><i class="fa fa-chevron-left"></i></button>
                        <button ${ch.navigation.next ? `onclick="app.router.navigate(null, '${ch.navigation.next}', true)"` : 'disabled'} class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold disabled:opacity-30"><i class="fa fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>`;
        },

        library: () => {
            const bookmarks = app.state.bookmarks;
            app.ui.root.innerHTML = `
            <div class="fade-in">
                <h2 class="text-2xl font-bold mb-6 flex items-center gap-2"><i class="fa fa-bookmark text-amber-500"></i> Perpustakaan</h2>
                ${bookmarks.length === 0 ? '<div class="text-center text-gray-500 mt-20">Belum ada komik tersimpan.</div>' : ''}
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${bookmarks.map(item => app.components.comicCard(item)).join('')}
                </div>
            </div>`;
        },

        history: () => {
            app.ui.root.innerHTML = `<div class="fade-in text-center mt-20 text-gray-500">Fitur Riwayat akan hadir di update berikutnya.</div>`;
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
        }
    },

    handlers: {
        toggleBookmark: (slug, title, image) => {
            const idx = app.state.bookmarks.findIndex(b => b.slug === slug);
            if(idx > -1) {
                app.state.bookmarks.splice(idx, 1);
                app.ui.toast("Dihapus dari Library");
            } else {
                app.state.bookmarks.push({slug, title, image, added: Date.now()});
                app.ui.toast("Disimpan ke Library");
            }
            localStorage.setItem('fmc_bookmarks', JSON.stringify(app.state.bookmarks));
            const btn = document.querySelector('.fa-bookmark, .fa-bookmark-o');
            if(btn) btn.className = idx > -1 ? 'fa fa-bookmark-o' : 'fa fa-bookmark text-amber-500';
        }
    },

    router: {
        // NAVIGASI DENGAN UUID OTOMATIS
        navigate: async (path, slugHint = null, isChapter = false) => {
            let finalPath = path;

            // Jika ada Slug Hint (misal dari klik kartu komik)
            // Kita cari UUID-nya dulu sebelum ganti URL
            if(slugHint) {
                app.ui.loading(true); // Tampilkan loading bar karena ini proses async
                const type = isChapter ? 'chapter' : 'series';
                const uuid = await app.utils.getUuid(slugHint, type);
                finalPath = isChapter ? `/chapter/${uuid}` : `/series/${uuid}`;
            }

            if(finalPath) {
                window.history.pushState({}, '', finalPath);
                app.router.resolve(finalPath);
            }
        },
        resolve: (path) => {
            const nav = document.getElementById('navbar');
            if(nav) nav.classList.remove('-translate-y-full');
            
            if(path === '/' || path === '/index.html') return app.pages.home();
            if(path === '/ongoing') return app.pages.ongoing();
            if(path === '/library') return app.pages.library(); // Added Library route
            if(path === '/history') return app.pages.history(); // Added History route
            
            if(path.includes('/series/')) return app.pages.detail(path.split('/series/')[1]);
            if(path.includes('/chapter/')) return app.pages.reader(path.split('/chapter/')[1]);
            
            return app.pages.home();
        }
    }
};

window.addEventListener('popstate', () => app.router.resolve(window.location.pathname));
document.addEventListener('DOMContentLoaded', () => app.router.resolve(window.location.pathname));
