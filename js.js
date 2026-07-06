        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import {
            getAuth, createUserWithEmailAndPassword,
            signInWithEmailAndPassword, signOut,
            onAuthStateChanged, sendPasswordResetEmail
        } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        import {
            getFirestore, collection, doc, setDoc, getDoc,
            addDoc, query, where, orderBy, onSnapshot,
            serverTimestamp, getDocs, updateDoc
        } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
        import { createClient as createSupabaseClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

        // ── PayHere Integration Configuration ──
        // ⚠️  SECURITY: merchant_secret is intentionally NOT here anymore.
        //     The hash is now generated server-side by a Supabase Edge Function
        //     (see /supabase-function/index.ts). Never put merchant_secret in
        //     client-side JS — anyone can read it from "View Source".
        const PAYHERE_CONFIG = {
            sandbox: true,
            merchant_id: '1236503' // safe to keep client-side, it's not a secret
        };

        // URL of your deployed Supabase Edge Function that generates the hash.
        const PAYHERE_HASH_ENDPOINT = 'https://pejcowjevmwwmcfqvopi.supabase.co/functions/v1/payhere-hash';

        // ── Firebase Init ──
        const firebaseConfig = {
            apiKey: "AIzaSyAXPGnlyVMTpsUdvJ0Qk7v6ummavjd2xxg",
            authDomain: "finalproject-c5660.firebaseapp.com",
            projectId: "finalproject-c5660",
            storageBucket: "finalproject-c5660.firebasestorage.app",
            messagingSenderId: "66814464975",
            appId: "1:66814464975:web:9f3fde73b51d06026ab8ba",
            measurementId: "G-MJ2TMFML9R"
        };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // ── Supabase client ──
        const supabase = createSupabaseClient(
            'https://pejcowjevmwwmcfqvopi.supabase.co',
            'sb_publishable_6_vIlumY_wH2wCmJ8RnY4w_34aWydZz'
        );

        // Active chat and real-time database listener cleanups
        let _chatUnsub = null;
        let _orderDocUnsub = null;
        let _supportChatUnsub = null;
        let _ordersUnsub = null;

        // ════════════════════════════════════════
        // DYNAMIC SITE CONTENT & ON-SNAPSHOTS
        // ════════════════════════════════════════
        const COLOR_CSS = { blue: '#3b82f6', indigo: '#6366f1', emerald: '#10b981', pink: '#ec4899', yellow: '#eab308', purple: '#a855f7', orange: '#f97316' };
        let _activeFilter = 'all';

        if (document.body.getAttribute('data-page') === 'home') {
            onSnapshot(
                query(collection(db, 'portfolio'), orderBy('createdAt', 'desc')),
                (snap) => {
                    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    renderPortfolioGrid(items);
                    renderFilterButtons(items);
                    renderHeroSlideshow(items);
                },
                (err) => console.warn('Portfolio snapshot error:', err)
            );
        }

        function renderHeroSlideshow(items) {
            const container = document.getElementById('hero-slideshow');
            if (!container) return;
            const covers = items.map(i => i.img).filter(Boolean);
            if (!covers.length) {
                container.innerHTML = `<div class="slide active" style="display:flex;align-items:center;justify-content:center;background:#111;">
                    <i class="fas fa-image" style="font-size:2rem;color:#333;"></i>
                </div>`;
                resetHeroSlideshow();
                return;
            }
            container.innerHTML = covers.map((src, i) => `
                <div class="slide${i === 0 ? ' active' : ''}">
                    <img src="${src}" alt="Project ${i + 1}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">
                </div>`).join('');
            resetHeroSlideshow();
        }

        function renderPortfolioGrid(items) {
            const grid = document.getElementById('portfolio-grid');
            if (!grid) return;
            if (!items.length) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:#64748b;">
                    <i class="fas fa-images" style="font-size:2rem;display:block;margin-bottom:1rem;"></i>
                    No portfolio items yet.
                </div>`;
                return;
            }
            grid.innerHTML = items.map(item => {
                const imgs = [item.img, ...(item.gallery || [])].filter(Boolean);
                const imgsJSON = JSON.stringify(imgs);
                const hidden = (_activeFilter !== 'all' && item.cat !== _activeFilter) ? 'hidden-item' : '';
                return `<div class="portfolio-item ${item.cat || ''} ${hidden} group relative rounded-[2rem] overflow-hidden aspect-[4/5] border border-white/5"
                    onclick='openProject(${JSON.stringify(item.title || '')},${JSON.stringify(item.cat || '')},${imgsJSON})'>
                    <img src="${item.img || ''}" class="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                         onerror="this.style.background='#1a1a1a'">
                    <div class="overlay absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-10 bg-gradient-to-t from-black via-black/20 to-transparent">
                        <span class="text-blue-500 font-bold uppercase text-[10px] tracking-widest mb-3">${item.cat || ''}</span>
                        <h4 class="text-2xl heading-bold">${item.title || ''}</h4>
                    </div>
                </div>`;
            }).join('');
        }

        function renderFilterButtons(items) {
            const bar = document.getElementById('portfolio-filter-bar');
            if (!bar) return;
            const cats = ['all', ...new Set(items.map(i => i.cat).filter(Boolean))];
            bar.innerHTML = cats.map(cat => {
                const isActive = _activeFilter === cat;
                return `<button onclick="filterPortfolio('${cat}')"
                    class="filter-btn px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-neutral-400'}">
                    ${cat === 'all' ? 'All Work' : cat}
                </button>`;
            }).join('');
        }

        if (document.body.getAttribute('data-page') === 'home') {
            onSnapshot(
                query(collection(db, 'services'), orderBy('order', 'asc')),
                (snap) => {
                    if (snap.empty) return;
                    const services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const container = document.querySelector('#services .grid');
                    if (!container) return;
                    container.innerHTML = services.map(s => {
                        const col = COLOR_CSS[s.color] || '#3b82f6';
                        return `<div onclick="serviceNavigate('${s.tag || s.name}')" class="service-card p-12 rounded-[2rem]" style="cursor:pointer;">
                        <i class="fas ${s.icon || 'fa-star'}" style="font-size:1.875rem;color:${col};display:block;margin-bottom:2.5rem;"></i>
                        <h3 class="text-2xl heading-bold mb-4">${s.name}</h3>
                        <p class="text-neutral-500 font-medium leading-relaxed">${s.desc}</p>
                    </div>`;
                    }).join('');
                },
                (err) => console.warn('Services snapshot error:', err)
            );
        }

        async function loadAboutFromDB() {
            try {
                const snap = await getDoc(doc(db, 'siteConfig', 'about'));
                if (!snap.exists()) return;
                const d = snap.data();
                if (d.name) document.querySelectorAll('[data-about="name"]').forEach(el => el.textContent = d.name);
                if (d.title) document.querySelectorAll('[data-about="title"]').forEach(el => el.textContent = d.title);
                if (d.bio1) document.querySelectorAll('[data-about="bio1"]').forEach(el => el.textContent = d.bio1);
                if (d.bio2) document.querySelectorAll('[data-about="bio2"]').forEach(el => el.textContent = d.bio2);
                if (d.since) document.querySelectorAll('[data-about="since"]').forEach(el => el.textContent = d.since + '+');
                if (d.platform) document.querySelectorAll('[data-about="platform"]').forEach(el => el.textContent = d.platform);
                if (d.linkedin) { const el = document.getElementById('ab-linkedin-link'); if (el) el.href = d.linkedin; }
                if (d.github) { const el = document.getElementById('ab-github-link'); if (el) el.href = d.github; }
                if (d.fiverr) { const el = document.getElementById('ab-fiverr-link'); if (el) el.href = d.fiverr; }
                if (d.whatsapp) document.querySelectorAll('a[href*="wa.me"]').forEach(el => el.href = 'https://wa.me/' + d.whatsapp.replace(/[^0-9]/g, ''));
                if (d.photoUrl || d.photoData) {
                    const src = d.photoUrl || d.photoData;
                    document.querySelectorAll('[data-about="photo"]').forEach(el => { el.src = src; });
                }
                if (d.hero) { const el = document.getElementById('hero-headline'); if (el) el.innerHTML = d.hero; }
                if (d.heroSub) { const el = document.getElementById('hero-sub'); if (el) el.textContent = d.heroSub; }
                ['skill1', 'skill2', 'skill3'].forEach((k, i) => { if (d[k]) { const el = document.querySelectorAll('[data-about="skill"]')[i]; if (el) el.lastChild.textContent = d[k]; } });
                ['tool1', 'tool2', 'tool3'].forEach((k, i) => { if (d[k]) { const el = document.querySelectorAll('[data-about="tool"]')[i]; if (el) el.lastChild.textContent = d[k]; } });
            } catch (e) { console.warn('About load error:', e); }
        }
        if (document.body.getAttribute('data-page') === 'home') loadAboutFromDB();


        // ════════════════════════════════════════
        // PUBLIC REVIEWS — Homepage
        // ════════════════════════════════════════
        async function loadPublicReviews() {
            const grid = document.getElementById('public-reviews-grid');
            const loading = document.getElementById('public-reviews-loading');
            const empty = document.getElementById('public-reviews-empty');
            const avgEl = document.getElementById('reviews-avg-public');
            const countEl = document.getElementById('reviews-count-public');
            const starsEl = document.getElementById('reviews-avg-stars-public');

            if (!grid) return;

            loading.style.display = 'block';
            grid.style.display = 'none';
            empty.style.display = 'none';

            try {
                const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
                const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                loading.style.display = 'none';

                if (!reviews.length) {
                    empty.style.display = 'block';
                    return;
                }

                // Average rating badge
                const avg = (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1);
                if (avgEl) avgEl.textContent = avg;
                if (countEl) countEl.textContent = reviews.length + ' review' + (reviews.length !== 1 ? 's' : '');
                if (starsEl) {
                    const full = Math.round(parseFloat(avg));
                    starsEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
                        `<i class="fas fa-star" style="font-size:0.85rem;color:${i < full ? '#fbbf24' : '#334155'};"></i>`
                    ).join('');
                }

                // Render cards
                grid.innerHTML = reviews.map(r => {
                    const stars = Array.from({ length: 5 }, (_, i) =>
                        `<i class="fas fa-star" style="color:${i < (r.rating || 0) ? '#fbbf24' : '#334155'};font-size:0.85rem;"></i>`
                    ).join('');
                    const date = r.createdAt?.seconds
                        ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '';
                    const initials = ((r.fname || r.username || '?')[0]).toUpperCase();
                    const avatar = r.profilePhotoData
                        ? `<img src="${r.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<span style="font-size:0.85rem;font-weight:800;color:#fff;">${initials}</span>`;
                    const fullName = ((r.fname || '') + ' ' + (r.lname || '')).trim() || r.username || 'Anonymous';
                    return `
            <div style="background:#141414;border:1px solid rgba(255,255,255,0.07);border-radius:1.25rem;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;">
                <div style="display:flex;align-items:center;gap:0.85rem;">
                    <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                        ${avatar}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.92rem;color:#fff;">${_escHtml(fullName)}</div>
                        <div style="font-size:0.72rem;color:#64748b;">@${_escHtml(r.username || '—')} · ${_escHtml(r.service || '—')}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;gap:2px;">${stars}</div>
                    <div style="font-size:0.7rem;color:#475569;">${date}</div>
                </div>
                ${r.text ? `<div style="font-size:0.88rem;color:#cbd5e1;line-height:1.65;font-style:italic;">"${_escHtml(r.text)}"</div>` : ''}
            </div>`;
                }).join('');

                grid.style.display = 'grid';

            } catch (e) {
                loading.style.display = 'none';
                empty.style.display = 'block';
                console.error('Failed to load reviews:', e);
            }
        }

        // Load reviews on page init
        if (document.body.getAttribute('data-page') === 'home') loadPublicReviews();


        // ════════════════════════════════════════
        // CUSTOM NON-BLOCKING DIALOG & TOAST SYSTEM
        // ════════════════════════════════════════

        // Carries a toast message across a real page navigation (MPA), since
        // showToast can't survive a full page reload on its own.
        window._navigateWithToast = function (url, message, type) {
            try { sessionStorage.setItem('_pendingToast', JSON.stringify({ message, type: type || 'success' })); } catch (e) { }
            window.location.href = url;
        };

        window.showToast = function (message, type = 'success') {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.style.position = 'fixed';
                container.style.bottom = '2rem';
                container.style.left = '2rem';
                container.style.zIndex = '10000';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '0.5rem';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.style.background = '#141414';
            toast.style.border = type === 'success' ? '1px solid #22c55e' : '1px solid #ef4444';
            toast.style.borderRadius = '0.75rem';
            toast.style.padding = '0.85rem 1.25rem';
            toast.style.color = '#fff';
            toast.style.fontSize = '0.88rem';
            toast.style.fontWeight = '600';
            toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.3)';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '0.5rem';
            toast.style.animation = 'pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';

            const icon = type === 'success' ? '<i class="fas fa-check-circle" style="color:#22c55e;"></i>' : '<i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>';
            toast.innerHTML = `${icon} <span>${message}</span>`;

            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s ease';
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        };

        window.showConfirmDialog = function (title, message, yesCallback) {
            const modal = document.getElementById('custom-confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const yesBtn = document.getElementById('confirm-btn-yes');
            const noBtn = document.getElementById('confirm-btn-no');

            titleEl.textContent = title;
            messageEl.textContent = message;
            modal.style.display = 'flex';

            const closeConfirm = () => { modal.style.display = 'none'; };

            yesBtn.onclick = () => {
                closeConfirm();
                yesCallback();
            };
            noBtn.onclick = closeConfirm;
        };

        // ════════════════════════════════════════
        // AUTHENTICATION PROFILE LOADER
        // ════════════════════════════════════════
        async function _loadUserProfile(user, attempt = 1) {
            const MAX_ATTEMPTS = 3;
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (!snap.exists()) {
                    window._currentUser = { uid: user.uid, email: user.email };
                } else {
                    const profile = snap.data();
                    window._currentUser = { uid: user.uid, email: user.email, ...profile };
                }
            } catch (err) {
                console.error(`[auth] Profile fetch failed (attempt ${attempt}):`, err);
                if (attempt < MAX_ATTEMPTS) {
                    await new Promise(r => setTimeout(r, attempt * 600));
                    return _loadUserProfile(user, attempt + 1);
                }
                window._currentUser = { uid: user.uid, email: user.email, _profileLoadFailed: true };
            }
            _applyUserNav(window._currentUser, user);
        }

        function _applyUserNav(profile, user) {
            const initials = (profile.fname || profile.lname)
                ? (((profile.fname || '')[0] || '') + ((profile.lname || '')[0] || '')).toUpperCase()
                : (user.email ? user.email[0].toUpperCase() : 'U');
            document.querySelectorAll('.user-avatar-nav').forEach(el => {
                if (profile.profilePhotoData) {
                    el.innerHTML = `<img src="${profile.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="avatar">`;
                } else {
                    el.textContent = initials;
                }
            });

            const loggedIn = document.getElementById('nav-logged-in');
            const loggedOut = document.getElementById('nav-logged-out');
            if (loggedIn) loggedIn.style.display = 'flex';
            if (loggedOut) loggedOut.style.display = 'none';
        }

        const PROTECTED_PAGES = ['order-dashboard', 'order-form', 'order-chat', 'support-chat'];

        function _initCurrentPage() {
            const page = document.body.getAttribute('data-page');
            if (page === 'order-dashboard') {
                if (window.loadOrders) window.loadOrders();
            } else if (page === 'order-chat') {
                const params = new URLSearchParams(window.location.search);
                const orderId = params.get('orderId');
                if (orderId) {
                    window._activeChatOrderKey = orderId;
                    if (window.loadOrderAndChat) window.loadOrderAndChat(orderId);
                }
            } else if (page === 'support-chat') {
                if (typeof loadSupportChat === 'function') loadSupportChat();
            }
        }

        onAuthStateChanged(auth, async (user) => {
            const page = document.body.getAttribute('data-page');
            if (user) {
                await _loadUserProfile(user);
                _initCurrentPage();
            } else {
                window._currentUser = null;
                const loggedIn = document.getElementById('nav-logged-in');
                const loggedOut = document.getElementById('nav-logged-out');
                if (loggedIn) loggedIn.style.display = 'none';
                if (loggedOut) loggedOut.style.display = 'flex';
                if (PROTECTED_PAGES.includes(page)) {
                    window.location.href = 'login.html?next=orders';
                }
            }
        });

        if (document.body.getAttribute('data-page') === 'login') {
            const _p = new URLSearchParams(window.location.search);
            if (_p.get('next') === 'orders') {
                setTimeout(() => showErr('loginErr', 'Please sign in to view your orders.'), 100);
            }
        }

        // ════════════════════════════════════════
        // OTP & VERIFICATION SYSTEM
        // ════════════════════════════════════════
        let _otpCode = '';
        let _otpPending = {};
        let _otpTimerHandle = null;
        let _otpExpiry = 0;

        const EMAILJS_SERVICE_ID = 'service_v4vvmrc';
        const EMAILJS_TEMPLATE_ID = 'template_zqklgpk';
        const EMAILJS_PUBLIC_KEY = 'mgYGTVMp1Cs9frm6j';

        function _generateOtp() {
            return String(Math.floor(100000 + Math.random() * 900000));
        }

        window.handleRegister = async function () {
            const fn = document.getElementById('reg-fname').value.trim();
            const ln = document.getElementById('reg-lname').value.trim();
            const un = document.getElementById('reg-uname').value.trim();
            const em = document.getElementById('reg-email').value.trim();
            const ph = document.getElementById('reg-phone').value.trim();
            const p1 = document.getElementById('reg-pass').value;
            const p2 = document.getElementById('reg-pass2').value;
            const bio = document.getElementById('reg-bio').value.trim();
            const errBox = document.getElementById('regErr');

            if (!fn) return _regErr('Please enter your first name.');
            if (!ln) return _regErr('Please enter your last name.');
            if (!un) return _regErr('Please choose a username.');
            if (!em || !em.includes('@')) return _regErr('Please enter a valid email.');
            if (!ph) return _regErr('Please enter your contact number.');
            if (p1.length < 8) return _regErr('Password must be at least 8 characters.');
            if (p1 !== p2) return _regErr('Passwords do not match.');
            errBox.style.display = 'none';

            const unSnap = await getDocs(query(collection(db, 'users'), where('username', '==', un)));
            if (!unSnap.empty) return _regErr('That username is already taken. Please choose another.');

            const btn = document.querySelector('#page-register .btn-primary');
            btn.disabled = true; btn.innerHTML = 'Sending OTP… <i class="fas fa-spinner fa-spin"></i>';

            try {
                _otpPending = { fn, ln, un, em, ph, bio, p1 };
                await _sendOtp(em, fn);
                document.getElementById('otpEmailDisplay').textContent = em;
                _showOtpModal();
            } catch (err) {
                console.error(err);
                _regErr('Failed to send verification email. Please try again.');
            } finally {
                btn.disabled = false; btn.innerHTML = 'Create Account <i class="fas fa-arrow-right"></i>';
            }
        };

        async function _sendOtp(email, name) {
            _otpCode = _generateOtp();
            _otpExpiry = Date.now() + 5 * 60 * 1000;

            if (EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
                emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    to_email: email,
                    to_name: name,
                    otp_code: _otpCode
                });
            } else {
                console.log('%c[OTP Demo] Your code: ' + _otpCode, 'color:#3b82f6;font-size:1.2rem;font-weight:bold;');
                setTimeout(() => {
                    const inputs = document.querySelectorAll('.otp-inputs input');
                    [..._otpCode].forEach((d, i) => {
                        if (inputs[i]) { inputs[i].value = d; inputs[i].classList.add('otp-filled'); }
                    });
                    document.getElementById('otpDemoNote').style.display = 'block';
                    document.getElementById('otpDemoCode').textContent = _otpCode;
                }, 400);
            }
        }

        function _showOtpModal() {
            document.querySelectorAll('.otp-inputs input').forEach(i => { i.value = ''; i.classList.remove('otp-filled'); });
            document.getElementById('otpErr').style.display = 'none';
            document.getElementById('otpDemoNote').style.display = 'none';
            document.getElementById('otpModal').classList.add('show');
            setTimeout(() => document.querySelector('.otp-inputs input')?.focus(), 150);
            _startOtpTimer();
        }

        function _startOtpTimer() {
            if (_otpTimerHandle) clearInterval(_otpTimerHandle);
            const timerEl = document.getElementById('otpTimerSec');
            const resendBtn = document.getElementById('otpResendBtn');
            resendBtn.disabled = true;
            _otpTimerHandle = setInterval(() => {
                const left = Math.max(0, Math.round((_otpExpiry - Date.now()) / 1000));
                timerEl.textContent = left + 's';
                if (left <= 0) {
                    clearInterval(_otpTimerHandle);
                    resendBtn.disabled = false;
                    timerEl.parentElement.style.display = 'none';
                }
            }, 1000);
        }

        // OTP inputs listeners
        window.otpKeyUp = function (el, idx, e) {
            el.classList.toggle('otp-filled', el.value !== '');
            if (el.value && idx < 5) {
                document.querySelectorAll('.otp-inputs input')[idx + 1]?.focus();
            }
            if (e.key === 'Backspace' && !el.value && idx > 0) {
                const prev = document.querySelectorAll('.otp-inputs input')[idx - 1];
                prev.value = ''; prev.classList.remove('otp-filled'); prev.focus();
            }
        };

        window.otpPaste = function (e) {
            const data = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
            const inputs = document.querySelectorAll('.otp-inputs input');
            [...data].forEach((d, i) => { if (inputs[i]) { inputs[i].value = d; inputs[i].classList.add('otp-filled'); } });
            inputs[Math.min(data.length, 5)]?.focus();
            e.preventDefault();
        };

        window.closeOtpModal = function () {
            document.getElementById('otpModal').classList.remove('show');
            if (_otpTimerHandle) clearInterval(_otpTimerHandle);
        };

        window.resendOtp = async function () {
            if (!_otpPending.em) return;
            document.getElementById('otpErr').style.display = 'none';
            document.getElementById('otpResendBtn').disabled = true;
            document.getElementById('otpTimerSec').parentElement.style.display = '';
            document.querySelectorAll('.otp-inputs input').forEach(i => { i.value = ''; i.classList.remove('otp-filled'); });
            try {
                await _sendOtp(_otpPending.em, _otpPending.fn);
                _startOtpTimer();
            } catch (err) {
                document.getElementById('otpErr').textContent = 'Failed to resend. Please try again.';
                document.getElementById('otpErr').style.display = 'block';
            }
        };

        window.verifyOtp = async function () {
            const entered = [...document.querySelectorAll('.otp-inputs input')].map(i => i.value).join('');
            const errEl = document.getElementById('otpErr');
            errEl.style.display = 'none';

            if (entered.length < 6) {
                errEl.textContent = 'Please enter the full 6-digit code.';
                errEl.style.display = 'block'; return;
            }
            if (Date.now() > _otpExpiry) {
                errEl.textContent = 'This code has expired. Please request a new one.';
                errEl.style.display = 'block'; return;
            }
            if (entered !== _otpCode) {
                errEl.textContent = 'Incorrect code. Please try again.';
                errEl.style.display = 'block';
                document.querySelector('.otp-inputs').style.animation = 'none';
                setTimeout(() => { document.querySelector('.otp-inputs').style.animation = 'shake 0.35s ease'; }, 10);
                return;
            }

            const verifyBtn = document.getElementById('otpVerifyBtn');
            verifyBtn.disabled = true; verifyBtn.innerHTML = 'Creating account… <i class="fas fa-spinner fa-spin"></i>';

            try {
                const { fn, ln, un, em, ph, bio, p1 } = _otpPending;
                const cred = await createUserWithEmailAndPassword(auth, em, p1);
                const uid = cred.user.uid;

                const userData = {
                    fname: fn,
                    lname: ln,
                    username: un,
                    email: em,
                    phone: ph,
                    bio: bio,
                    createdAt: serverTimestamp()
                };
                if (window._profilePhotoBase64) {
                    userData.profilePhotoData = window._profilePhotoBase64;
                    userData.profilePhotoType = window._profilePhotoType || 'image/jpeg';
                    userData.profilePhotoName = window._profilePhotoName || 'profile.jpg';
                }
                await setDoc(doc(db, 'users', uid), userData);

                window._profilePhotoBase64 = null;
                window._profilePhotoType = null;
                window._profilePhotoName = null;

                closeOtpModal();
                _otpPending = {}; _otpCode = '';
                document.getElementById('regSuccess').style.display = 'block';
                document.getElementById('regOverlay').classList.add('show');
            } catch (err) {
                console.error(err);
                closeOtpModal();
                const msg = err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' : err.message;
                _regErr(msg);
            } finally {
                verifyBtn.disabled = false; verifyBtn.innerHTML = 'Verify & Create Account <i class="fas fa-arrow-right"></i>';
            }
        };

        function _regErr(msg) {
            const el = document.getElementById('regErr');
            el.textContent = msg; el.style.display = 'block';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // ════════════════════════════════════════
        // FORGOT PASSWORD FLOW
        // ════════════════════════════════════════
        let _fpOtpCode = '';
        let _fpOtpExpiry = 0;
        let _fpEmail = '';
        let _fpTimerInterval = null;

        window.openForgotPassword = function () {
            document.getElementById('fpModal').style.display = 'flex';
            document.getElementById('fp-step1').style.display = 'block';
            document.getElementById('fp-step2').style.display = 'none';
            document.getElementById('fp-step3').style.display = 'none';
            document.getElementById('fpEmailErr').textContent = '';
            document.getElementById('fpEmailErr').style.display = 'none';
            if (document.getElementById('fp-email-input')) document.getElementById('fp-email-input').value = '';
        };

        window.closeFpModal = function () {
            document.getElementById('fpModal').style.display = 'none';
            if (_fpTimerInterval) { clearInterval(_fpTimerInterval); _fpTimerInterval = null; }
        };

        function _startFpTimer() {
            if (_fpTimerInterval) clearInterval(_fpTimerInterval);
            let secs = Math.round((_fpOtpExpiry - Date.now()) / 1000);
            const secEl = document.getElementById('fpTimerSec');
            const resendBtn = document.getElementById('fpResendBtn');
            if (secEl) secEl.textContent = secs + 's';
            if (resendBtn) resendBtn.disabled = true;
            _fpTimerInterval = setInterval(() => {
                secs--;
                if (secEl) secEl.textContent = Math.max(0, secs) + 's';
                if (secs <= 0) {
                    clearInterval(_fpTimerInterval); _fpTimerInterval = null;
                    if (resendBtn) resendBtn.disabled = false;
                }
            }, 1000);
        }

        window.fpSendOtp = async function () {
            const email = document.getElementById('fp-email-input').value.trim();
            const errEl = document.getElementById('fpEmailErr');
            errEl.style.display = 'none';
            if (!email || !/\S+@\S+\.\S+/.test(email)) {
                errEl.textContent = 'Please enter a valid email address.';
                errEl.style.display = 'block'; return;
            }
            const btn = document.getElementById('fpSendBtn');
            btn.disabled = true; btn.innerHTML = 'Sending… <i class="fas fa-spinner fa-spin"></i>';
            try {
                // Use Firebase password reset email (simplest approach)
                await sendPasswordResetEmail(auth, email);
                _fpEmail = email;
                // Show step 3 directly (Firebase handles the reset via email link)
                document.getElementById('fp-step1').style.display = 'none';
                document.getElementById('fp-step3').style.display = 'block';
                document.getElementById('fpNewPassErr').textContent = '';
                document.getElementById('fpNewPassErr').style.display = 'none';
                // Show success message in step 3
                document.getElementById('fpNewPassErr').style.display = 'block';
                document.getElementById('fpNewPassErr').style.background = 'rgba(34,197,94,0.08)';
                document.getElementById('fpNewPassErr').style.border = '1px solid rgba(34,197,94,0.25)';
                document.getElementById('fpNewPassErr').style.color = '#4ade80';
                document.getElementById('fpNewPassErr').textContent = '✅ Password reset email sent to ' + email + '. Check your inbox and follow the link to reset your password.';
                document.getElementById('fpResetBtn').style.display = 'none';
            } catch (e) {
                const msg = e.code === 'auth/user-not-found' ? 'No account found with this email.' : (e.code === 'auth/invalid-email' ? 'Invalid email address.' : e.message);
                errEl.textContent = msg;
                errEl.style.display = 'block';
            } finally {
                btn.disabled = false; btn.innerHTML = 'Send Code <i class="fas fa-paper-plane"></i>';
            }
        };

        // These exist as placeholders for the OTP UI (Firebase handles via email link)
        window.fpVerifyOtp = function () { window.closeFpModal(); };
        window.fpResendOtp = function () { window.fpSendOtp(); };
        window.fpResetPassword = function () { window.closeFpModal(); };
        window.fpOtpKeyUp = function () { };
        window.fpOtpPaste = function () { };

        // ════════════════════════════════════════
        // LOGIN & FORGOT PASSWORD FLOW
        // ════════════════════════════════════════
        window.handleLogin = async function () {
            let id = document.getElementById('login-id').value.trim();
            const pw = document.getElementById('login-pass').value;
            const errBox = document.getElementById('loginErr');
            errBox.style.display = 'none';

            if (!id) return _loginErr('Please enter your email or username.');
            if (!pw) return _loginErr('Please enter your password.');

            const btn = document.querySelector('#page-login .btn-primary');
            btn.disabled = true; btn.textContent = 'Signing in…';

            try {
                if (!id.includes('@')) {
                    const snap = await getDocs(query(collection(db, 'users'), where('username', '==', id)));
                    if (snap.empty) { _loginErr('No account found with that username.'); return; }
                    id = snap.docs[0].data().email;
                }
                await signInWithEmailAndPassword(auth, id, pw);
                document.getElementById('loginOverlay').classList.add('show');
            } catch (err) {
                console.error(err);
                const code = err.code;
                const msg = code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'Incorrect email/username or password.' : err.message;
                _loginErr(msg);
            } finally {
                btn.disabled = false; btn.innerHTML = 'Sign In <i class="fas fa-arrow-right"></i>';
            }
        };

        function _loginErr(msg) {
            const el = document.getElementById('loginErr');
            el.textContent = msg; el.style.display = 'block';
        }

        // ════════════════════════════════════════
        // PAYHERE PAYMENT & SECURED HASH GENERATOR
        // ════════════════════════════════════════
        window._selectedPayMethod = ''; // 'online' | 'bank'

        window.selectPayMethod = function (method) {
            window._selectedPayMethod = method;
            const onlineEl = document.getElementById('pay-method-online');
            const bankEl = document.getElementById('pay-method-bank');
            const slipSection = document.getElementById('slip-section');
            const payhereInfo = document.getElementById('payhere-info');
            const btnText = document.getElementById('submit-btn-text');

            if (method === 'online') {
                onlineEl.style.border = '2px solid rgba(59,130,246,0.6)';
                onlineEl.style.background = 'rgba(59,130,246,0.08)';
                bankEl.style.border = '2px solid rgba(255,255,255,0.1)';
                bankEl.style.background = 'rgba(255,255,255,0.02)';
                slipSection.style.display = 'none';
                payhereInfo.style.display = 'block';
                btnText.textContent = 'Pay & Place Order';
            } else {
                bankEl.style.border = '2px solid rgba(139,92,246,0.6)';
                bankEl.style.background = 'rgba(139,92,246,0.08)';
                onlineEl.style.border = '2px solid rgba(255,255,255,0.1)';
                onlineEl.style.background = 'rgba(255,255,255,0.02)';
                slipSection.style.display = 'block';
                payhereInfo.style.display = 'none';
                btnText.textContent = 'Submit Order';
            }
        };

        window.submitOrder = async function () {
            if (!window._currentUser) return;
            const service = window._selectedService;
            const brand = document.getElementById('f-brand').value.trim();
            const budget = document.getElementById('f-budget').value;
            const deadline = document.getElementById('f-deadline').value;
            const desc = document.getElementById('f-desc').value.trim();
            const ref = document.getElementById('f-ref').value.trim();

            if (!service) return _orderErr('Please select a service.');
            if (!budget) return _orderErr('Please select a package.');
            if (!brand) return _orderErr('Please enter your project / brand name.');
            if (!desc) return _orderErr('Please describe your project.');
            if (!window._selectedPayMethod) return _orderErr('Please select a payment method.');
            document.getElementById('orderErr').style.display = 'none';

            const btn = document.querySelector('#ov-form .btn-primary');
            btn.disabled = true;
            btn.querySelector('#submit-btn-text').textContent = 'Processing…';

            // Extract numeric price — e.g. "Rs.3,000" → 3000.00
            const priceStr = window._selectedPackage ? window._selectedPackage.price : '';
            const priceNum = parseFloat(priceStr.replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
            const formattedAmount = priceNum.toFixed(2);
            const orderCode = `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

            try {
                if (window._selectedPayMethod === 'online') {
                    // 🇱🇰 PAYHERE PAYMENT GATEWAY INTEGRATION
                    window._pendingOrderData = {
                        uid: window._currentUser.uid,
                        username: window._currentUser.username || '',
                        service, brand, budget, deadline, desc, ref,
                        orderCode,
                        paymentMethod: 'Online'
                    };

                    const userDoc = await getDoc(doc(db, 'users', window._currentUser.uid));
                    const userData = userDoc.exists() ? userDoc.data() : {};
                    const fullName = userData.displayName || userData.username || window._currentUser.username || 'Customer';
                    const email = window._currentUser.email || userData.email || '';
                    const phone = userData.phone || '0000000000';

                    // Generate PayHere hash SERVER-SIDE via Supabase Edge Function.
                    // The merchant_secret never touches the browser now.
                    const hashRes = await fetch(PAYHERE_HASH_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_id: orderCode,
                            amount: formattedAmount,
                            currency: 'LKR'
                        })
                    });
                    if (!hashRes.ok) {
                        throw new Error('Could not generate payment hash. Please try again.');
                    }
                    const hashData = await hashRes.json();
                    const hash = hashData.hash;


                    const payment = {
                        sandbox: PAYHERE_CONFIG.sandbox,
                        merchant_id: PAYHERE_CONFIG.merchant_id,
                        return_url: window.location.href,
                        cancel_url: window.location.href,
                        notify_url: 'https://pejcowjevmwwmcfqvopi.supabase.co/functions/v1/payhere-webhook',
                        order_id: orderCode,
                        items: `${service} — ${budget}`,
                        amount: formattedAmount,
                        currency: 'LKR',
                        hash: hash,
                        first_name: fullName.split(' ')[0] || fullName,
                        last_name: fullName.split(' ').slice(1).join(' ') || '',
                        email: email,
                        phone: phone,
                        address: 'Sri Lanka',
                        city: 'Colombo',
                        country: 'Sri Lanka',
                    };

                    payhere.onCompleted = async function (orderId) {
                        await _saveOrderToFirestore({
                            ...window._pendingOrderData,
                            status: 'Active',
                            paymentStatus: 'Paid',
                            payhereOrderId: orderId,
                            startedAt: serverTimestamp(),
                            createdAt: serverTimestamp()
                        });
                        window._pendingOrderData = null;
                        _resetOrderForm(btn);
                        window._navigateWithToast('order-dashboard.html', '✅ Payment successful! Your order is now active.', 'success');
                    };

                    payhere.onDismissed = function () {
                        btn.disabled = false;
                        btn.querySelector('#submit-btn-text').textContent = 'Pay & Place Order';
                        showToast('Payment cancelled. You can try again.', 'error');
                    };

                    payhere.onError = function (error) {
                        btn.disabled = false;
                        btn.querySelector('#submit-btn-text').textContent = 'Pay & Place Order';
                        _orderErr('Payment failed: ' + error);
                    };

                    payhere.startPayment(payment);
                    return;

                } else {
                    // Bank Transfer flow
                    const orderData = {
                        uid: window._currentUser.uid,
                        username: window._currentUser.username || '',
                        service, brand, budget, deadline, desc, ref,
                        status: 'Pending',
                        orderCode,
                        paymentMethod: 'Bank',
                        paymentStatus: 'Unpaid',
                        paymentProof: null,
                        createdAt: serverTimestamp()
                    };
                    if (window._bankSlipBase64) {
                        orderData.paymentProofData = window._bankSlipBase64;
                        orderData.paymentProofType = window._bankSlipType || 'image/jpeg';
                        orderData.paymentProofName = window._bankSlipName || 'slip.jpg';
                        orderData.paymentStatus = 'Pending';
                    }
                    await _saveOrderToFirestore(orderData);
                    _resetOrderForm(btn);
                    window._navigateWithToast('order-dashboard.html', '✅ Order submitted! Please await bank receipt validation.', 'success');
                    return;
                }
            } catch (err) {
                console.error(err);
                _orderErr('Failed to submit order. Please try again.');
                btn.disabled = false;
                btn.querySelector('#submit-btn-text').textContent = window._selectedPayMethod === 'online' ? 'Pay & Place Order' : 'Submit Order';
            }
        };

        async function _saveOrderToFirestore(orderData) {
            await addDoc(collection(db, 'orders'), orderData);
        }

        function _orderErr(msg) {
            const el = document.getElementById('orderErr');
            if (el) { el.textContent = msg; el.style.display = 'block'; }
            const btn = document.querySelector('#ov-form .btn-primary');
            if (btn) {
                btn.disabled = false;
                const btnText = btn.querySelector('#submit-btn-text');
                if (btnText) btnText.textContent = window._selectedPayMethod === 'online' ? 'Pay & Place Order' : 'Submit Order';
            }
        }

        function _resetOrderForm(btn) {
            ['f-brand', 'f-budget', 'f-deadline', 'f-desc', 'f-ref'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.querySelectorAll('.srv-opt').forEach(o => o.classList.remove('selected'));
            const pkgSection = document.getElementById('pkg-section');
            if (pkgSection) pkgSection.style.display = 'none';
            const pkgCards = document.getElementById('pkg-cards');
            if (pkgCards) pkgCards.innerHTML = '';
            const slipLabel = document.getElementById('slip-label');
            if (slipLabel) { slipLabel.textContent = 'Click to attach payment slip'; slipLabel.style.color = '#94a3b8'; }
            const slipArea = document.getElementById('slip-upload-area');
            if (slipArea) { slipArea.style.borderColor = 'rgba(255,255,255,0.1)'; slipArea.style.background = 'rgba(255,255,255,0.02)'; }
            const slipInput = document.getElementById('f-slip');
            if (slipInput) slipInput.value = '';
            window._selectedService = '';
            window._selectedPackage = null;
            window._bankSlipBase64 = null;
            window._bankSlipType = null;
            window._bankSlipName = null;
            window._selectedPayMethod = '';
            ['pay-method-online', 'pay-method-bank'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.style.border = '2px solid rgba(255,255,255,0.1)'; el.style.background = 'rgba(255,255,255,0.02)'; }
            });
            const slipSec = document.getElementById('slip-section');
            const phInfo = document.getElementById('payhere-info');
            if (slipSec) slipSec.style.display = 'none';
            if (phInfo) phInfo.style.display = 'none';
            if (btn) {
                btn.disabled = false;
                const btnText = btn.querySelector('#submit-btn-text');
                if (btnText) btnText.textContent = 'Submit Order';
            }
        }

        // ════════════════════════════════════════
        // REAL-TIME FIRESTORE LISTENER FOR ORDERS
        // ════════════════════════════════════════
        window.loadOrders = function () {
            if (!window._currentUser) return;
            const list = document.getElementById('orders-list');
            list.innerHTML = '<p style="color:#64748b;font-size:0.85rem;">Loading orders…</p>';

            if (_ordersUnsub) { _ordersUnsub(); _ordersUnsub = null; }

            const q = query(
                collection(db, 'orders'),
                where('uid', '==', window._currentUser.uid),
                orderBy('createdAt', 'desc')
            );

            _ordersUnsub = onSnapshot(q, (snap) => {
                const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                const total = orders.length;
                const active = orders.filter(o => o.status === 'Active').length;
                const done = orders.filter(o => o.status === 'Completed').length;
                const pending = orders.filter(o => o.status === 'Pending').length;

                const spent = orders.reduce((sum, o) => {
                    if (o.paymentStatus === 'Paid') {
                        const num = parseFloat((o.budget || '').replace(/[^0-9.]/g, ''));
                        return sum + (isNaN(num) ? 0 : num);
                    }
                    return sum;
                }, 0);

                document.getElementById('stat-total').textContent = total;
                document.getElementById('stat-progress').textContent = active;
                document.getElementById('stat-done').textContent = done;
                document.getElementById('stat-pending').textContent = pending;
                document.getElementById('stat-spent').textContent = spent > 0 ? '$' + spent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$0';

                if (orders.length === 0) {
                    list.innerHTML = '<p style="color:#64748b;font-size:0.85rem;text-align:center;padding:2rem 0;">No orders yet. Click <strong style="color:#fff;">+ New Order</strong> to get started!</p>';
                    return;
                }

                const iconMap = {
                    'Logo Design': 'fa-pen-nib', 'Full Branding': 'fa-star',
                    'Social Media': 'fa-image', 'Flyer / Poster': 'fa-file-alt',
                    'Packaging': 'fa-box', 'Other': 'fa-ellipsis-h'
                };
                const badgeMap = {
                    'Pending': 'pending', 'Active': 'active-b', 'Completed': 'done',
                    'Cancelled': 'danger', 'CancelRequested': 'cancel-req'
                };

                list.innerHTML = orders.map(o => {
                    const icon = iconMap[o.service] || 'fa-pen-nib';
                    const badge = badgeMap[o.status] || 'pending';
                    const dateStr = o.createdAt && typeof o.createdAt.seconds === 'number' ? new Date(o.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

                    return `
                    <div class="order-card-item" onclick="openOrderChat('${o.id}')">
                        <div style="display:flex;align-items:center;gap:1rem;">
                            <div style="width:44px;height:44px;border-radius:0.75rem;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);display:flex;align-items:center;justify-content:center;color:#3b82f6;font-size:1rem;flex-shrink:0;">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:0.95rem;margin-bottom:0.25rem;">${_esc(o.brand)} — ${_esc(o.service)}</div>
                                <div style="font-size:0.75rem;color:#64748b;">${dateStr}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:1rem;">
                            <span class="badge ${badge}">${_esc(o.status)}</span>
                            <span style="font-weight:800;font-size:1rem;">${_esc(o.budget)}</span>
                            <button class="btn-outline-sm" onclick="event.stopPropagation();openOrderChat('${o.id}')"><i class="fas fa-comment"></i> Chat</button>
                        </div>
                    </div>`;
                }).join('');
            }, (err) => {
                console.error(err);
                list.innerHTML = '<p style="color:#f87171;font-size:0.85rem;">Failed to load orders. Please refresh.</p>';
            });
        };

        // ════════════════════════════════════════
        // REAL-TIME CONVERSATION SYSTEMS & TIMELINE
        // ════════════════════════════════════════
        window.openOrderChat = function (orderId) {
            window.location.href = 'order-chat.html?orderId=' + encodeURIComponent(orderId);
        };

        window.loadOrderAndChat = function (orderId) {
            if (_orderDocUnsub) { _orderDocUnsub(); _orderDocUnsub = null; }
            window._currentDeliveryLink = null;
            const orderDocRef = doc(db, 'orders', orderId);

            function applyOrderToUI(order) {
                document.getElementById('od-id').textContent = order.orderCode || orderId.slice(0, 6).toUpperCase();
                document.getElementById('od-service').textContent = order.service || '—';
                document.getElementById('od-status').textContent = order.status || 'Pending';
                document.getElementById('od-price').textContent = order.budget || '—';

                const deadlineVal = order.deadline;
                const deadlineEl = document.getElementById('od-deadline');
                const countdownWrap = document.getElementById('od-countdown-wrap');
                const countdownEl = document.getElementById('od-countdown');

                if (deadlineVal) {
                    const deadlineDate = new Date(deadlineVal + 'T23:59:59');
                    deadlineEl.textContent = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    countdownWrap.style.display = 'block';

                    if (window._countdownInterval) clearInterval(window._countdownInterval);

                    function updateCountdown() {
                        const now = new Date();
                        const diff = deadlineDate - now;
                        if (diff <= 0) {
                            countdownEl.textContent = 'Deadline passed';
                            countdownEl.style.color = '#f87171';
                            clearInterval(window._countdownInterval);
                            return;
                        }
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const secs = Math.floor((diff % (1000 * 60)) / 1000);
                        countdownEl.textContent = days > 0
                            ? `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`
                            : `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
                        countdownEl.style.color = diff < 86400000 ? '#f59e0b' : '#3b82f6';
                    }
                    updateCountdown();
                    window._countdownInterval = setInterval(updateCountdown, 1000);
                } else {
                    deadlineEl.textContent = '—';
                    countdownWrap.style.display = 'none';
                }

                const _titleEl = document.getElementById('chat-service-title');
                const _metaEl = document.getElementById('chat-service-meta');
                if (_titleEl) _titleEl.textContent = `${order.brand || 'Order'} — ${order.service || 'Service'}`;
                if (_metaEl) _metaEl.textContent = `Budget: ${order.budget || '—'} · Delivery: ${deadlineVal ? new Date(deadlineVal + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}`;

                const payStatus = order.paymentStatus || 'Unpaid';
                const payStatusEl = document.getElementById('chat-payment-status');
                if (payStatusEl) {
                    payStatusEl.textContent = payStatus;
                    payStatusEl.style.color = payStatus === 'Paid' ? '#22c55e' : (payStatus === 'Pending' ? '#3b82f6' : '#f59e0b');
                }
                const proofEl = document.getElementById('chat-payment-proof');
                if (proofEl) {
                    if (order.paymentProofName) {
                        proofEl.innerHTML = `<strong>Receipt:</strong> ${order.paymentProofName}`;
                    } else if (order.paymentProof && order.paymentProof.name) {
                        proofEl.innerHTML = `<strong>Receipt:</strong> ${order.paymentProof.name}`;
                    } else {
                        proofEl.innerHTML = `<strong>Receipt:</strong> none uploaded`;
                    }
                }

                const paymentUploadSection = document.getElementById('payment-upload-section');
                const paymentPaidBadge = document.getElementById('payment-paid-badge');
                const isPaid = payStatus === 'Paid';
                const isOrderActive = order.status === 'Active' || order.status === 'Completed';

                if (paymentUploadSection) {
                    paymentUploadSection.style.display = (isPaid && isOrderActive) ? 'none' : 'block';
                }
                if (paymentPaidBadge) {
                    paymentPaidBadge.style.display = (isPaid && isOrderActive) ? 'flex' : 'none';
                }

                const cancelBtn = document.getElementById('cancel-order-btn');
                const cancelPendingNotice = document.getElementById('cancel-pending-notice');
                if (cancelBtn) {
                    const showCancel = order.status === 'Pending' || order.status === 'Active';
                    cancelBtn.style.display = showCancel ? 'flex' : 'none';
                }
                if (cancelPendingNotice) {
                    cancelPendingNotice.style.display = order.status === 'CancelRequested' ? 'flex' : 'none';
                }

                const delivSection = document.getElementById('delivery-files-section');
                const delivList = document.getElementById('delivery-files-list');
                const delivFiles = order.deliveryFiles || [];
                if (delivFiles.length > 0 && delivSection && delivList) {
                    delivSection.style.display = 'block';
                    window._currentDeliveryFiles = delivFiles;
                    delivList.innerHTML = delivFiles.map((f, i) => `
                        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:0.5rem;">
                            <i class="fas fa-file-alt" style="color:#64748b;font-size:0.8rem;flex-shrink:0;"></i>
                            <span style="flex:1;font-size:0.75rem;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(f.name || '').replace(/</g, '&lt;')}</span>
                            <button onclick="downloadSingleDeliveryFile('${(f.url || '').replace(/'/g, "\\'")}','${(f.name || 'file').replace(/'/g, "\\'")}');"
                               style="flex-shrink:0;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e;border-radius:0.4rem;padding:0.25rem 0.55rem;font-size:0.68rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:0.3rem;font-family:inherit;">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>`).join('');
                    const completeBtn = document.getElementById('complete-order-btn');
                    if (completeBtn) {
                        completeBtn.style.display = order.status === 'Active' ? 'flex' : 'none';
                    }
                } else if (delivSection) {
                    delivSection.style.display = 'none';
                    window._currentDeliveryFiles = [];
                }

                if (window._updateReviewButton) window._updateReviewButton(order);

                function getTimelineStep(ord) {
                    if (ord.reviewPosted) return 5;
                    if (ord.status === 'Completed') return 4;
                    if (ord.deliveryFiles && ord.deliveryFiles.length > 0) return 3;
                    if (ord.designingStartedAt) return 2;
                    if (ord.status === 'Active' || ord.status === 'CancelRequested') return 1;
                    if (ord.status === 'Cancelled') return 4;
                    return 0;
                }
                const step = getTimelineStep(order);
                const fmtDate = (ts) => ts && ts.seconds ? new Date(ts.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

                const tlSteps = [
                    { label: 'Order Placed', sub: fmtDate(order.createdAt) || 'Today', color: '#3b82f6' },
                    { label: 'Payment Accepted', sub: step >= 1 ? (fmtDate(order.startedAt) || 'Confirmed') : 'Pending', color: '#3b82f6' },
                    { label: 'Design in Progress', sub: step >= 2 ? (fmtDate(order.designingStartedAt) || 'Underway ✏️') : 'Upcoming', color: '#a855f7' },
                    { label: 'Files Delivered', sub: step >= 3 ? (order.status === 'Cancelled' ? 'Cancelled' : (fmtDate(order.deliveredAt) || 'Delivered 📦')) : 'Upcoming', color: '#22c55e' },
                    { label: 'Order Completed', sub: step >= 4 ? (order.status === 'Cancelled' ? 'Cancelled ✗' : (fmtDate(order.completedAt) || 'Completed ✓')) : 'Upcoming', color: '#f59e0b' },
                    { label: 'Review Posted', sub: step >= 5 ? '⭐ Review submitted — Thank you!' : 'After completion', color: '#facc15' }
                ];

                const tlContainer = document.getElementById('timeline-steps-container');
                if (tlContainer) {
                    tlContainer.innerHTML = tlSteps.map((s, i) => {
                        const done = i < step || i === 0;
                        const active = i === step;
                        const dotColor = done || active ? s.color : '#334155';
                        const labelColor = done || active ? '#fff' : '#475569';
                        const subColor = done || active ? '#94a3b8' : '#334155';
                        const isLast = i === tlSteps.length - 1;
                        const glowStyle = active ? `box-shadow:0 0 8px ${s.color};` : '';
                        return `<div style="display:flex;gap:0.75rem;margin-bottom:${isLast ? '0' : '1rem'};" class="tl-item">
                            <div class="tl-dot" style="background:${dotColor};${glowStyle}flex-shrink:0;margin-top:3px;"></div>
                            <div style="font-size:0.78rem;color:${subColor};line-height:1.5;">
                                <strong style="color:${labelColor};display:block;font-size:0.8rem;">${s.label}</strong>${s.sub}
                            </div>
                        </div>`;
                    }).join('');
                }
            }

            getDoc(orderDocRef).then(snap => {
                if (snap.exists()) applyOrderToUI({ id: snap.id, ...snap.data() });
            }).catch(console.error);

            _orderDocUnsub = onSnapshot(orderDocRef, (snap) => {
                if (!snap.exists()) return;
                applyOrderToUI({ id: snap.id, ...snap.data() });
            });

            loadChatMessages(orderId);
        };

        window.completeOrder = async function () {
            if (!window._activeChatOrderKey) return;
            window.showConfirmDialog(
                'Complete Order',
                'Are you sure you want to mark this order as completed and accept design outputs?',
                async () => {
                    try {
                        await updateDoc(doc(db, 'orders', window._activeChatOrderKey), {
                            status: 'Completed',
                            completedAt: serverTimestamp()
                        });
                        const cancelBtn = document.getElementById('cancel-order-btn');
                        if (cancelBtn) cancelBtn.style.display = 'none';
                        const statusEl = document.getElementById('od-status');
                        if (statusEl) statusEl.textContent = 'Completed';
                        window.showToast('Order marked as Completed successfully!', 'success');
                    } catch (err) {
                        console.error('Complete order failed:', err);
                        window.showToast('Unable to complete order. Please try again.', 'error');
                    }
                }
            );
        };

        window.cancelOrder = async function () {
            if (!window._activeChatOrderKey) return;
            const reason = prompt('Please tell us why you want to cancel this order:');
            if (reason === null) return;
            if (!reason.trim()) {
                window.showToast('Please provide a reason for cancellation.', 'error');
                return;
            }
            const orderSnap = await getDoc(doc(db, 'orders', window._activeChatOrderKey));
            const prevStatus = orderSnap.exists() ? (orderSnap.data().status || 'Active') : 'Active';
            try {
                await updateDoc(doc(db, 'orders', window._activeChatOrderKey), {
                    status: 'CancelRequested',
                    prevStatus: prevStatus,
                    cancelReason: reason.trim(),
                    cancelRequestedAt: serverTimestamp()
                });
                window.showToast('Cancellation request sent safely for designer review.', 'success');
            } catch (err) {
                console.error('Cancel request failed:', err);
                window.showToast('Unable to send cancellation request.', 'error');
            }
        };

        // Review Button State Logic
        window._updateReviewButton = async function (order) {
            const btn = document.getElementById('review-order-btn');
            if (!btn) return;
            if (order.status !== 'Completed') {
                btn.style.display = 'none';
                return;
            }
            try {
                const snap = await getDocs(query(
                    collection(db, 'reviews'),
                    where('orderId', '==', window._activeChatOrderKey),
                    where('uid', '==', window._currentUser.uid)
                ));
                if (!snap.empty) {
                    btn.style.display = 'flex';
                    btn.innerHTML = '<i class="fas fa-star" style="color:#fbbf24;"></i> Review Submitted';
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'not-allowed';
                } else {
                    btn.style.display = 'flex';
                    btn.innerHTML = '<i class="fas fa-star"></i> Leave a Review';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            } catch (e) {
                btn.style.display = 'flex';
            }
        };

        // Chat messages loading
        function loadChatMessages(orderId) {
            if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }

            const messagesEl = document.getElementById('chat-messages');
            messagesEl.innerHTML = '<div class="sys-msg">Loading messages…</div>';

            const q = query(
                collection(db, 'orders', orderId, 'messages'),
                orderBy('createdAt', 'asc')
            );

            _chatUnsub = onSnapshot(q, (snap) => {
                messagesEl.innerHTML = '<div class="sys-msg">Chat · ' + new Date().toLocaleDateString() + '</div>';
                snap.forEach(d => {
                    const msg = d.data();
                    const mine = msg.uid === window._currentUser?.uid;
                    const time = msg.createdAt && typeof msg.createdAt.seconds === 'number' ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const init = (msg.senderName || '?')[0].toUpperCase();
                    let avaHtml = `<div class="msg-avatar ${mine ? 'user' : ''}">${init}</div>`;
                    if (mine && window._currentUser?.profilePhotoData) {
                        avaHtml = `<div class="msg-avatar user" style="overflow:hidden;background:transparent;"><img src="${window._currentUser.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;"></div>`;
                    }
                    messagesEl.innerHTML += `
                        <div class="msg ${mine ? 'mine' : 'theirs'}">
                            ${avaHtml}
                            <div class="msg-inner">
                                <div class="msg-bubble">
                                    ${msg.imageData ? `<img src="${msg.imageData}" style="max-width:200px; border-radius:0.5rem; display:block; margin-bottom:0.4rem; cursor:pointer;" onclick="window.open(this.src)">` : ''}
                                    ${msg.text !== 'Sent an image' ? _escHtml(msg.text) : ''}
                                </div>
                                <div class="msg-time">${time}</div>
                            </div>
                        </div>`;
                });
                messagesEl.scrollTop = messagesEl.scrollHeight;
            });
        }

        window.sendMessage = async function () {
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            const orderId = window._activeChatOrderKey;
            if (!text || !orderId || !window._currentUser) return;

            input.value = '';
            input.style.height = 'auto';

            try {
                await addDoc(collection(db, 'orders', orderId, 'messages'), {
                    uid: window._currentUser.uid,
                    senderName: (window._currentUser.fname || '') + ' ' + (window._currentUser.lname || ''),
                    text,
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                console.error('Send failed:', err);
            }
        };

        window.sendChatImage = async function (e, type) {
            const file = e.target.files[0];
            if (!file || !window._currentUser) return;
            try {
                const dataUrl = await resizeAndConvertToBase64(file, 5);

                const payload = {
                    uid: window._currentUser.uid,
                    senderName: (window._currentUser.fname || '') + ' ' + (window._currentUser.lname || ''),
                    text: 'Sent an image',
                    imageData: dataUrl,
                    createdAt: serverTimestamp()
                };

                if (type === 'order' && window._activeChatOrderKey) {
                    await addDoc(collection(db, 'orders', window._activeChatOrderKey, 'messages'), payload);
                } else if (type === 'support') {
                    await addDoc(collection(db, 'supportChats', window._currentUser.uid, 'messages'), payload);
                }
            } catch (err) {
                console.error('Image send failed:', err);
                window.showToast('Failed to upload image.', 'error');
            } finally {
                e.target.value = '';
            }
        };

        // ── Support Chat ──
        let _supportUnsub = null;

        window.openSupportChat = function () {
            if (!window._currentUser) { window.showPage('page-login'); return; }
            window.switchOrderView('ov-support');
        };

        function loadSupportChat() {
            const uid = window._currentUser?.uid;
            if (!uid) return;
            const messagesEl = document.getElementById('support-chat-messages');
            messagesEl.innerHTML = '<div style="text-align:center;color:#475569;font-size:0.82rem;padding:2rem;">Loading messages…</div>';
            if (_supportUnsub) { _supportUnsub(); _supportUnsub = null; }
            const q = query(collection(db, 'supportChats', uid, 'messages'), orderBy('createdAt', 'asc'));
            _supportUnsub = onSnapshot(q, snap => {
                if (snap.empty) {
                    messagesEl.innerHTML = '<div style="text-align:center;color:#475569;font-size:0.82rem;padding:2rem;">No messages yet. Say hello! 👋</div>';
                    return;
                }
                messagesEl.innerHTML = '';
                snap.docs.forEach(d => {
                    const msg = d.data();
                    const mine = msg.uid === uid;
                    const time = msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const init = (msg.senderName || '?')[0].toUpperCase();
                    let avaHtml = `<div class="msg-avatar ${mine ? 'user' : ''}">${init}</div>`;
                    if (mine && window._currentUser?.profilePhotoData) {
                        avaHtml = `<div class="msg-avatar user" style="overflow:hidden;background:transparent;"><img src="${window._currentUser.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;"></div>`;
                    }
                    messagesEl.innerHTML += `<div class="msg ${mine ? 'mine' : 'theirs'}">
                        ${avaHtml}
                        <div class="msg-inner">
                            <div class="msg-bubble">
                                ${msg.imageData ? `<img src="${msg.imageData}" style="max-width:200px;border-radius:0.5rem;display:block;margin-bottom:0.4rem;cursor:pointer;" onclick="window.open(this.src)">` : ''}
                                ${msg.text && msg.text !== 'Sent an image' ? _escHtml(msg.text) : ''}
                            </div>
                            <div class="msg-time">${time}</div>
                        </div>
                    </div>`;
                });
                messagesEl.scrollTop = messagesEl.scrollHeight;
            });
        }

        window.sendSupportMessage = async function () {
            const input = document.getElementById('support-chat-input');
            const text = input?.value.trim();
            const uid = window._currentUser?.uid;
            if (!text || !uid) return;
            input.value = '';
            input.style.height = 'auto';
            const name = (window._currentUser.fname || '') + ' ' + (window._currentUser.lname || '') || window._currentUser.username || 'Customer';
            try {
                await addDoc(collection(db, 'supportChats', uid, 'messages'), {
                    uid,
                    senderName: name.trim(),
                    text,
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                console.error('Support send failed:', err);
                window.showToast('Failed to send message.', 'error');
            }
        };

        window.handleLogout = async function () {
            if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
            if (_ordersUnsub) { _ordersUnsub(); _ordersUnsub = null; }
            if (_supportUnsub) { _supportUnsub(); _supportUnsub = null; }
            await signOut(auth);
            window._currentUser = null;
            window.showPage('page-portfolio');
        };

        window.submitReview = async function () {
            const rating = window._reviewRating;
            const text = document.getElementById('review-text').value.trim();
            const errEl = document.getElementById('review-err');
            if (!rating) { errEl.textContent = 'Please select a star rating.'; errEl.style.display = 'block'; return; }
            if (!text) { errEl.textContent = 'Please write a short review.'; errEl.style.display = 'block'; return; }
            errEl.style.display = 'none';

            const orderId = window._activeChatOrderKey;
            const user = window._currentUser;
            if (!orderId || !user) return;

            const btn = document.querySelector('#review-modal .btn-primary');
            btn.disabled = true; btn.innerHTML = 'Submitting… <i class="fas fa-spinner fa-spin"></i>';

            try {
                const orderSnap = await getDoc(doc(db, 'orders', orderId));
                const order = orderSnap.exists() ? orderSnap.data() : {};

                await addDoc(collection(db, 'reviews'), {
                    orderId,
                    orderCode: order.orderCode || '',
                    service: order.service || '',
                    previewImg: order.previewImg || null,
                    uid: user.uid,
                    username: user.username || '',
                    fname: user.fname || '',
                    lname: user.lname || '',
                    profilePhotoData: user.profilePhotoData || null,
                    rating,
                    text,
                    createdAt: serverTimestamp()
                });

                await updateDoc(doc(db, 'orders', orderId), { reviewPosted: true, reviewPostedAt: serverTimestamp() });
                closeReviewModal();
                document.getElementById('reviewSuccessOverlay').classList.add('show');
                await window._updateReviewButton({ status: 'Completed' });
            } catch (e) {
                errEl.textContent = 'Failed to submit review. Please try again.';
                errEl.style.display = 'block';
            } finally {
                btn.disabled = false; btn.innerHTML = 'Submit Review <i class="fas fa-paper-plane"></i>';
            }
        };
        // ════════════════════════════════════════
        // MULTI-FILE NAVIGATION (was single-page class toggling,
        // now each "page"/"view" is its own real HTML file)
        // ════════════════════════════════════════
        const PAGE_FILE_MAP = {
            'page-portfolio': 'index.html',
            'page-register': 'register.html',
            'page-login': 'login.html',
            'page-orders': 'order-dashboard.html'
        };

        const ORDER_VIEW_FILE_MAP = {
            'ov-dashboard': 'order-dashboard.html',
            'ov-form': 'order-form.html',
            'ov-chat': 'order-chat.html',
            'ov-support': 'support-chat.html'
        };

        window.showPage = function (id) {
            if (id === 'page-orders' && !window._currentUser) {
                window.location.href = 'login.html?next=orders';
                return;
            }
            const file = PAGE_FILE_MAP[id];
            if (file) window.location.href = file;
        };

        window.switchOrderView = function (viewId) {
            const file = ORDER_VIEW_FILE_MAP[viewId];
            if (file) window.location.href = file;
        };

        window.ordersNavBack = function () {
            if (document.body.getAttribute('data-page') === 'order-dashboard') {
                window.showPage('page-portfolio');
            } else {
                window.switchOrderView('ov-dashboard');
            }
        };

        let currentSlide = 0;
        let _heroInterval = null;
        function nextSlide() {
            const slides = document.querySelectorAll('#hero-slideshow .slide');
            if (slides.length < 2) return;
            slides[currentSlide]?.classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide]?.classList.add('active');
        }
        function resetHeroSlideshow() {
            currentSlide = 0;
            if (_heroInterval) clearInterval(_heroInterval);
            _heroInterval = setInterval(nextSlide, 5000);
        }
        if (document.getElementById('hero-slideshow')) resetHeroSlideshow();

        function serviceNavigate(cat) { filterPortfolio(cat); document.getElementById('portfolio').scrollIntoView({ behavior: 'smooth' }); }

        function filterPortfolio(cat) {
            _activeFilter = cat;
            document.querySelectorAll('.filter-btn').forEach(b => {
                const isCat = b.getAttribute('onclick') === `filterPortfolio('${cat}')`;
                b.className = `filter-btn px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition ${isCat ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-neutral-400'}`;
            });
            document.querySelectorAll('.portfolio-item').forEach(item => {
                if (cat === 'all' || item.classList.contains(cat)) {
                    item.classList.remove('hidden-item');
                } else {
                    item.classList.add('hidden-item');
                }
            });
        }

        function openProject(title, cat, images) {
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-category').innerText = cat;
            document.getElementById('modal-description').innerText = cat === 'Certificate'
                ? 'Verified achievement reflecting commitment to professional excellence.'
                : 'Deep collaboration to create a visual language that speaks to the target audience.';
            document.getElementById('modal-order-btn').style.display = cat === 'Certificate' ? 'none' : 'inline-flex';
            const gallery = document.getElementById('modal-gallery');
            gallery.innerHTML = '';
            images.forEach(src => { const img = document.createElement('img'); img.src = src; img.className = 'w-full rounded-2xl shadow-xl border border-white/5 object-cover'; gallery.appendChild(img); });
            document.getElementById('project-modal').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() { const m = document.getElementById('project-modal'); if (m) m.classList.remove('active'); document.body.style.overflow = ''; }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); } });

        // Image compression helpers
        function resizeAndConvertToBase64(file, maxMB = 2) {
            return new Promise((resolve, reject) => {
                const maxBytes = maxMB * 1024 * 1024;
                if (!file.type.startsWith('image/')) {
                    if (file.size > maxBytes) {
                        reject(new Error(`File exceeds ${maxMB}MB limit.`));
                        return;
                    }
                    const r = new FileReader();
                    r.onload = ev => resolve(ev.target.result);
                    r.onerror = () => reject(new Error('Failed to read file.'));
                    r.readAsDataURL(file);
                    return;
                }
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    let { width, height } = img;
                    const canvas = document.createElement('canvas');
                    let quality = 0.92;
                    const tryEncode = () => {
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        const byteSize = Math.round((dataUrl.length - 22) * 3 / 4);
                        if (byteSize <= maxBytes || (width <= 200 && quality <= 0.5)) {
                            resolve(dataUrl);
                        } else if (quality > 0.5) {
                            quality -= 0.1;
                            tryEncode();
                        } else {
                            width = Math.round(width * 0.75);
                            height = Math.round(height * 0.75);
                            quality = 0.82;
                            tryEncode();
                        }
                    };
                    tryEncode();
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image.')); };
                img.src = url;
            });
        }

        function previewPhoto(e) {
            const file = e.target.files[0]; if (!file) return;
            resizeAndConvertToBase64(file, 2).then(dataUrl => {
                const img = document.getElementById('avatarImg');
                img.src = dataUrl;
                img.style.display = 'block';
                document.getElementById('avatarIcon').style.display = 'none';
                window._profilePhotoBase64 = dataUrl;
                window._profilePhotoType = 'image/jpeg';
                window._profilePhotoName = file.name;
            }).catch(err => {
                showToast(err.message || 'Image too large. Max 2MB.', 'error');
                e.target.value = '';
            });
        }

        function togglePassField(id, el) {
            const inp = document.getElementById(id);
            const hide = inp.type === 'password';
            inp.type = hide ? 'text' : 'password';
            el.innerHTML = hide ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        }

        const SERVICE_PACKAGES = {
            'Logo Design': [
                { name: 'Basic', price: 'Rs.3,000', days: 5, features: '2 HQ logo concepts · Source file · Printable file · High-res PNG & JPG · Unlimited revisions · 5-day delivery' },
                { name: 'Standard', price: 'Rs.6,500', days: 4, features: '3 HQ logo concepts · Social media kit · Source file · Printable file · Unlimited revisions · 4-day delivery' },
                { name: 'Premium', price: 'Rs.12,000', days: 3, features: '5 HQ logo concepts · 2 Stationery designs · Social media kit · Source file · Unlimited revisions · 3-day delivery' }
            ],
            'Full Branding': [
                { name: 'Basic', price: 'Rs.12,000', days: 7, features: 'Logo design · Brand color palette · Typography guide · Business card design · Source files · 7-day delivery' },
                { name: 'Standard', price: 'Rs.22,000', days: 6, features: 'Everything in Basic · Letterhead · Social media kit · Brand style guide (PDF) · Unlimited revisions · 6-day delivery' },
                { name: 'Premium', price: 'Rs.38,000', days: 5, features: 'Everything in Standard · Stationery set (5 items) · Packaging mockup · Brand presentation deck · Priority 5-day delivery' }
            ],
            'Social Media': [
                { name: 'Basic', price: 'Rs.2,500', days: 4, features: '5 social media posts · 2 platform sizes · HQ PNG exports · Brand-consistent design · 4-day delivery' },
                { name: 'Standard', price: 'Rs.5,500', days: 3, features: '10 social media posts · 3 platform sizes · Story templates · Editable Canva/PSD files · 3-day delivery' },
                { name: 'Premium', price: 'Rs.9,500', days: 2, features: '20 social media posts · All platform sizes · Highlight covers · Reel thumbnail set · Source files · 2-day delivery' }
            ],
            'Flyer / Poster': [
                { name: 'Basic', price: 'Rs.2,000', days: 3, features: '1 flyer/poster design · 2 revisions · Print-ready PDF · HQ PNG export · 3-day delivery' },
                { name: 'Standard', price: 'Rs.4,000', days: 2, features: '1 flyer + 1 social media version · Unlimited revisions · Print-ready + digital files · Source file · 2-day delivery' },
                { name: 'Premium', price: 'Rs.7,000', days: 2, features: '3 flyer/poster designs · Both print & digital sizes · Unlimited revisions · All source files included · 2-day delivery' }
            ],
            'Packaging': [
                { name: 'Basic', price: 'Rs.6,000', days: 6, features: '1 packaging design · Label/wrap design · 2 revisions · Print-ready PDF · 6-day delivery' },
                { name: 'Standard', price: 'Rs.12,000', days: 5, features: '1 packaging design · Front + back + sides · Unlimited revisions · Mockup preview · Source file · 5-day delivery' },
                { name: 'Premium', price: 'Rs.20,000', days: 4, features: 'Full packaging suite (box, label, bag) · 3D mockup · Unlimited revisions · All source files · Priority 4-day delivery' }
            ],
            'Other': [
                { name: 'Basic', price: 'Rs.3,000', days: 5, features: 'Single design deliverable · 2 revisions · HQ export files · 5-day delivery' },
                { name: 'Standard', price: 'Rs.6,500', days: 3, features: 'Single design deliverable · Unlimited revisions · Source file · 3-day delivery' },
                { name: 'Premium', price: 'Rs.12,000', days: 2, features: 'Complex/multi-part deliverable · Unlimited revisions · All source files · Priority 2-day delivery' }
            ]
        };

        window._selectedPackage = null;

        function selectSrv(el, name) {
            document.querySelectorAll('.srv-opt').forEach(o => o.classList.remove('selected'));
            el.classList.add('selected');
            window._selectedService = name;
            window._selectedPackage = null;
            document.getElementById('f-budget').value = '';
            renderPackages(name);
        }

        function renderPackages(service) {
            const packages = SERVICE_PACKAGES[service];
            const section = document.getElementById('pkg-section');
            const container = document.getElementById('pkg-cards');
            if (!packages) { section.style.display = 'none'; return; }

            const tiers = [
                { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', badge: '#64748b', badgeBg: 'rgba(100,116,139,0.12)' },
                { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.35)', badge: '#3b82f6', badgeBg: 'rgba(59,130,246,0.12)' },
                { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.3)', badge: '#a855f7', badgeBg: 'rgba(168,85,247,0.12)' }
            ];

            container.innerHTML = packages.map((pkg, i) => {
                const t = tiers[i];
                return `<div class="pkg-card" data-pkg="${pkg.name}" data-price="${pkg.price}" data-days="${pkg.days}"
                    onclick="selectPackage(this,'${pkg.name}','${pkg.price}',${pkg.days})"
                    style="cursor:pointer;border:1.5px solid ${t.border};background:${t.bg};border-radius:0.85rem;padding:1rem 1.1rem;transition:all 0.2s;position:relative;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
                        <div>
                            <span style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:${t.badge};background:${t.badgeBg};padding:0.2rem 0.55rem;border-radius:999px;">${pkg.name} Pack</span>
                            <div style="font-size:1.45rem;font-weight:800;letter-spacing:-0.03em;color:#fff;margin-top:0.4rem;">${pkg.price}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;">
                            <div class="pkg-check" style="width:22px;height:22px;border-radius:50%;border:2px solid ${t.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;"></div>
                            <span style="font-size:0.65rem;font-weight:700;color:${t.badge};background:${t.badgeBg};padding:0.18rem 0.5rem;border-radius:999px;white-space:nowrap;"><i class="fas fa-clock" style="margin-right:3px;"></i>${pkg.days}d delivery</span>
                        </div>
                    </div>
                    <div style="font-size:0.78rem;color:#94a3b8;line-height:1.6;">${pkg.features.split(' · ').filter(f => !f.match(/\d+-day delivery/i)).map(f => `<span style="display:inline-block;margin-right:0.35rem;">✓ ${f}</span>`).join('')}</div>
                </div>`;
            }).join('');

            section.style.display = 'block';
        }

        function selectPackage(el, name, price, days) {
            document.querySelectorAll('.pkg-card').forEach(c => {
                c.style.boxShadow = 'none';
                c.style.transform = 'none';
                const chk = c.querySelector('.pkg-check');
                chk.innerHTML = '';
                chk.style.background = 'transparent';
            });
            el.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.5)';
            el.style.transform = 'translateY(-2px)';
            const chk = el.querySelector('.pkg-check');
            chk.innerHTML = '<i class="fas fa-check" style="font-size:0.65rem;color:#fff;"></i>';
            chk.style.background = '#3b82f6';
            chk.style.borderColor = '#3b82f6';
            window._selectedPackage = { name, price, days };
            document.getElementById('f-budget').value = `${name} Pack — ${price}`;
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + (days || 5));
            document.getElementById('f-deadline').value = deadline.toISOString().split('T')[0];
        }

        window.previewSlip = function (e) {
            const file = e.target.files[0];
            if (!file) return;
            resizeAndConvertToBase64(file, 2).then(dataUrl => {
                const label = document.getElementById('slip-label');
                label.textContent = '📎 ' + file.name;
                label.style.color = '#22c55e';
                document.getElementById('slip-upload-area').style.borderColor = 'rgba(34,197,94,0.4)';
                document.getElementById('slip-upload-area').style.background = 'rgba(34,197,94,0.04)';
                window._bankSlipBase64 = dataUrl;
                window._bankSlipType = file.type.startsWith('image/') ? 'image/jpeg' : file.type;
                window._bankSlipName = file.name;
            }).catch(err => {
                showToast(err.message || 'File too large. Max 2MB.', 'error');
                e.target.value = '';
            });
        };

        function handleChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (window.sendMessage) window.sendMessage(); } }
        function handleSupportChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (window.sendSupportMessage) window.sendSupportMessage(); } }
        function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

        function showErr(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        function closeOverlay(id) { document.getElementById(id).classList.remove('show'); }

        // Review Modal Handlers
        window._reviewRating = 0;
        const STAR_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Outstanding!' };

        window.openReviewModal = function () {
            if (!window._activeChatOrderKey) return;
            window._reviewRating = 0;
            document.getElementById('review-text').value = '';
            document.getElementById('review-err').style.display = 'none';
            resetStars();
            document.getElementById('review-star-label').textContent = '';
            document.getElementById('review-modal').style.display = 'flex';
        };

        window.closeReviewModal = function () {
            document.getElementById('review-modal').style.display = 'none';
        };

        window.hoverStars = function (val) {
            document.querySelectorAll('.review-star').forEach(s => {
                s.style.color = parseInt(s.dataset.val) <= val ? '#fbbf24' : '#334155';
            });
            document.getElementById('review-star-label').textContent = STAR_LABELS[val] || '';
        };

        window.resetStars = function () {
            const cur = window._reviewRating;
            document.querySelectorAll('.review-star').forEach(s => {
                s.style.color = parseInt(s.dataset.val) <= cur ? '#fbbf24' : '#334155';
            });
            document.getElementById('review-star-label').textContent = cur > 0 ? STAR_LABELS[cur] : '';
        };

        window.setStars = function (val) {
            window._reviewRating = val;
            resetStars();
        };

        function _esc(s) { return (s || '').replace(/'/g, "\\'"); }
        function _escHtml(t) { return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

        // ════════════════════════════════════════
        // GLOBAL EXPORTS
        // (needed because this file is loaded as a <script type="module">,
        // so plain top-level "function foo(){}" declarations are module-scoped
        // and would NOT be reachable from inline onclick="foo()" HTML attributes
        // without being explicitly attached to window like this)
        // ════════════════════════════════════════
        window.openProject = openProject;
        window.closeModal = closeModal;
        window.filterPortfolio = filterPortfolio;
        window.serviceNavigate = serviceNavigate;
        window.previewPhoto = previewPhoto;
        window.togglePassField = togglePassField;
        window.selectSrv = selectSrv;
        window.selectPackage = selectPackage;
        window.handleChatKey = handleChatKey;
        window.handleSupportChatKey = handleSupportChatKey;
        window.autoResize = autoResize;
        window.closeOverlay = closeOverlay;

        // Show a toast that was carried over from a previous page via a real
        // navigation (see window._navigateWithToast in js.js's module part).
        (function () {
            try {
                const raw = sessionStorage.getItem('_pendingToast');
                if (raw) {
                    sessionStorage.removeItem('_pendingToast');
                    const { message, type } = JSON.parse(raw);
                    if (window.showToast) window.showToast(message, type);
                }
            } catch (e) { }
        })();





