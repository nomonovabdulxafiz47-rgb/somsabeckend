function safeParse(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return (v === null || v === undefined) ? fallback : v; }
    catch (e) { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ==========================================
// CHIROYLI DIALOG OYNALARI (alert / confirm / prompt o'rniga)
// ==========================================
function uiDialog(o) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    ov.style.zIndex = 20000;
    const icons = { success: '✅', warn: '⚠️', ask: '❓', info: '🥐' };
    const hasInput = o.input !== undefined && o.input !== null;
    ov.innerHTML = `<div class="modal-box ui-dialog ${o.type || 'info'}">
        <div class="ui-dialog-icon">${icons[o.type] || '🥐'}</div>
        <div class="ui-dialog-title">${esc(o.title || 'City Somsa POS')}</div>
        <div class="ui-dialog-text">${esc(o.text)}</div>
        ${hasInput ? `<input class="form-control" id="uiDlgInput" style="margin-top:14px" value="${esc(o.input)}">` : ''}
        <div class="ui-dialog-btns">
            ${o.confirm ? `<button type="button" class="btn-main ui-cancel">Bekor qilish</button>` : ''}
            <button type="button" class="btn-main ui-ok">OK</button>
        </div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.ui-ok').onclick = () => {
        const val = hasInput ? ov.querySelector('#uiDlgInput').value : undefined;
        close();
        if (o.onOk) o.onOk(val);
    };
    const c = ov.querySelector('.ui-cancel');
    if (c) c.onclick = close;
    if (hasInput) setTimeout(() => ov.querySelector('#uiDlgInput').focus(), 50);
}
window.alert = function(msg) {
    const s = String(msg);
    const ok = /^(✅|☀️|❄️|🗑️)/.test(s);
    uiDialog({ text: s.replace(/^(✅|☀️|❄️|🗑️)\s*/, ''), type: ok ? 'success' : 'warn' });
};
function askConfirm(text, onYes) { uiDialog({ text, type: 'ask', confirm: true, onOk: onYes }); }
function askInput(text, def, onOk) { uiDialog({ text, type: 'ask', confirm: true, input: def, onOk }); }

function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function formatDateUz(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
}
function onlyDigits(s) { return String(s || '').replace(/\D/g, ''); }
function normalizeLogin(s) { return String(s || '').trim().replace(/\s+/g, ''); }
function sameLogin(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase(); }
function validLogin(s) { return /^[A-Za-z0-9_.\-]{3,30}$/.test(s); }
function hashPass(p) {
    const s = 'citysomsa|' + p;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const ROLE_NAMES = { sotuvchi: 'Sotuvchi', somsachi: 'Somsachi', tekshiruvchi: 'Tekshiruvchi' };
const SUPER_ADMIN_LOGIN = '998887276008';
const SUPER_ADMIN_PASS = '1029384756';
const DAY_MS = 24 * 60 * 60 * 1000;

let users = safeParse('users', []);
users = users.filter(u => u.phone !== SUPER_ADMIN_LOGIN);
users.unshift({
    phone: SUPER_ADMIN_LOGIN,
    passHash: hashPass(SUPER_ADMIN_PASS),
    plainPass: SUPER_ADMIN_PASS,
    role: 'tekshiruvchi',
    name: 'Asilbek Admin',
    isSuperAdmin: true,
    subStatus: 'free'
});
save('users', users);

let branches = safeParse('branches', []);
let appSubSettings = safeParse('appSubSettings', { price: 10000, cardNumber: '8600 0000 0000 0000', cardOwner: 'Asilbek Admin' });
let adminNotifications = safeParse('adminNotifications', []);
let subPaymentHistory = safeParse('subPaymentHistory', []);

let selectedLoginRole = 'sotuvchi';
let currentUser = null;
let selectedPaymentType = 'Naqd';
let selectedBranchFilter = 'ALL';

let somsaTypes = safeParse('somsaTypes', [
    { id: 1, name: "Mol go'shtli", price: 10000 },
    { id: 2, name: "Qo'y go'shtli", price: 12000 },
    { id: 3, name: "Avashnoy", price: 6000 },
    { id: 4, name: "Qiyma", price: 8000 },
    { id: 5, name: "Kartoshkali", price: 5000 },
    { id: 6, name: "Qovoqli", price: 5000 },
    { id: 7, name: "Tovuqli", price: 8000 }
]);

let productionLogs = safeParse('productionLogs', []);
let salesLogs = safeParse('salesLogs', []);
let auditRequests = safeParse('auditRequests', []);
let expenseLogs = safeParse('expenseLogs', []);
let kassaReportDays = 7, ownerReportDays = 7;
let cardNumber = localStorage.getItem('cardNumber') || '';
let crmExpensesVal = parseInt(localStorage.getItem('crmExpensesVal')) || 0;

let quickStepQty = 1;
let currentStatus = 'Chiqdi';
let cart = [];
let WORKER_RATE = parseInt(localStorage.getItem('workerRate')) || 1500;
let failedAttempts = 0;
let lockUntil = 0;

if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
let savedFontSize = localStorage.getItem('fontSize') || '14px';
document.documentElement.style.setProperty('--font-size', savedFontSize);

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}
function changeFontSize(size) {
    document.documentElement.style.setProperty('--font-size', size);
    localStorage.setItem('fontSize', size);
}

// ==========================================
// CHAPDAN OCHILADIGAN MENYU (DRAWER)
// ==========================================
function isDrawerOpen() { return document.getElementById('sideDrawer').classList.contains('open'); }
function openDrawer() {
    const d = document.getElementById('sideDrawer');
    d.style.transform = '';
    d.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    document.getElementById('drawerBackdrop').classList.add('show');
    document.body.classList.add('drawer-lock');
}
// TUZATISH: hamma holatni to'liq tozalaydi
function closeDrawer() {
    const d = document.getElementById('sideDrawer');
    d.style.transform = '';
    d.classList.remove('open', 'dragging');
    d.setAttribute('aria-hidden', 'true');
    const bd = document.getElementById('drawerBackdrop');
    bd.classList.remove('show');
    bd.style.opacity = '';
    document.body.classList.remove('drawer-lock');
}
function toggleDrawer() { isDrawerOpen() ? closeDrawer() : openDrawer(); }

document.addEventListener('keydown', e => { if (e.key === 'Escape' && isDrawerOpen()) closeDrawer(); });

// Barmoq bilan surish: chap chetdan o'ngga — ochish, ochiq holatda chapga — yopish
// TUZATISH: touchcancel qo'shildi (Android scrollni o'z qo'liga olganda ham holat tiklanadi)
(function() {
    let startX = 0, startY = 0, tracking = false, mode = null, dx = 0, decided = false;
    const drawer = () => document.getElementById('sideDrawer');
    const backdrop = () => document.getElementById('drawerBackdrop');
    const W = () => drawer().offsetWidth;

    function finish() {
        const wasDecided = decided;
        tracking = false; decided = false;
        drawer().classList.remove('dragging');
        if (!wasDecided) return;
        const w = W();
        if (mode === 'open') (dx > w * 0.33) ? openDrawer() : closeDrawer();
        else (dx < -w * 0.25) ? closeDrawer() : openDrawer();
    }

    document.addEventListener('touchstart', e => {
        if (!currentUser || document.getElementById('mainApp').style.display === 'none') return;
        if (document.querySelector('.modal-overlay[style*="flex"]')) return;
        if (e.touches.length !== 1) { tracking = false; return; }
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY; dx = 0; decided = false;
        if (isDrawerOpen()) { tracking = true; mode = 'close'; }
        else if (startX <= 24) { tracking = true; mode = 'open'; }
        else tracking = false;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (!tracking) return;
        const t = e.touches[0];
        dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (!decided) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            if (Math.abs(dy) > Math.abs(dx) || (mode === 'close' && dx > 0)) { tracking = false; return; }
            decided = true;
            drawer().classList.add('dragging');
        }
        const w = W();
        const pos = mode === 'open' ? Math.min(0, -w + dx) : Math.min(0, Math.max(-w, dx));
        drawer().style.transform = `translateX(${pos}px)`;
        const bd = backdrop();
        bd.classList.add('show');
        bd.style.opacity = String(Math.max(0, Math.min(1, 1 + pos / w)));
    }, { passive: true });

    document.addEventListener('touchend', () => { if (tracking || decided) finish(); }, { passive: true });
    document.addEventListener('touchcancel', () => { if (tracking || decided) finish(); }, { passive: true });
})();

function isSuperAdmin(user) { return !!user && (user.isSuperAdmin === true || user.phone === SUPER_ADMIN_LOGIN); }

function getTekshiruvchiOwnerPhone(user) {
    if (!user) return null;
    if (user.role === 'tekshiruvchi' && !isSuperAdmin(user)) return user.phone;
    if (user.ownerPhone) return user.ownerPhone;
    return null;
}

function getMyBranches(ownerPhone) {
    return branches.filter(b => b.ownerPhone === ownerPhone);
}

function getBranchName(branchId) {
    if (!branchId) return 'Umumiy / Asosiy';
    const b = branches.find(x => String(x.id) === String(branchId));
    return b ? b.name : 'Filial';
}

function checkSubscriptionActive(user) {
    if (!user) return false;
    if (isSuperAdmin(user)) return true;
    if (user.role !== 'tekshiruvchi') return true;
    if (user.frozen) return false;
    if (user.subStatus === 'free') return true;
    if (user.subStatus === '1month' && user.subExpiresAt) return Date.now() < user.subExpiresAt;
    return false;
}

function isPaymentDue(user) {
    if (!user || isSuperAdmin(user) || user.role !== 'tekshiruvchi') return false;
    if (user.subStatus === 'free') return false;
    if (user.subStatus === '1month' && user.subExpiresAt && Date.now() >= user.subExpiresAt) return true;
    return false;
}

function daysUntilExpiry(user) {
    if (!user || !user.subExpiresAt) return null;
    return Math.ceil((user.subExpiresAt - Date.now()) / DAY_MS);
}

function filterLogsByScope(logs, ownerPhone, branchId) {
    return logs.filter(item => {
        if (ownerPhone && item.ownerPhone && item.ownerPhone !== ownerPhone) return false;
        if (branchId && branchId !== 'ALL') {
            return String(item.branchId || '') === String(branchId);
        }
        return true;
    });
}

function getProduced(somsaId, day, ownerPhone, branchId) {
    return filterLogsByScope(productionLogs, ownerPhone, branchId)
        .filter(p => p.date === day && p.somsaId === somsaId && p.status !== 'Brak')
        .reduce((s, p) => s + p.qty, 0);
}
function getBrak(somsaId, day, ownerPhone, branchId) {
    return filterLogsByScope(productionLogs, ownerPhone, branchId)
        .filter(p => p.date === day && p.somsaId === somsaId && p.status === 'Brak')
        .reduce((s, p) => s + p.qty, 0);
}
function getSold(somsaId, day, ownerPhone, branchId) {
    let sold = 0;
    filterLogsByScope(salesLogs, ownerPhone, branchId)
        .filter(sl => sl.date === day)
        .forEach(sl => sl.items.forEach(it => { if (it.id === somsaId) sold += it.qty; }));
    return sold;
}
function getRemain(somsaId, day, ownerPhone, branchId) {
    return getProduced(somsaId, day, ownerPhone, branchId) - getSold(somsaId, day, ownerPhone, branchId);
}
function getInCart(somsaId) { const it = cart.find(c => c.id === somsaId); return it ? it.qty : 0; }

function selectLoginRole(role) {
    selectedLoginRole = role;
    document.querySelectorAll('#loginBox .role-tab-btn').forEach(b => b.classList.remove('active'));
    const map = { sotuvchi: 'tabSotuvchi', somsachi: 'tabSomsachi', tekshiruvchi: 'tabTekshiruvchi' };
    if (map[role]) document.getElementById(map[role]).classList.add('active');
}
function togglePasswordVisibility() {
    const p = document.getElementById('loginPassword');
    p.type = p.type === 'password' ? 'text' : 'password';
}
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openForgotModal() {
    document.getElementById('forgotPhone').value = '';
    document.getElementById('newPassword').value = '';
    openModal('forgotModal');
}

function pushAdminNotif(phone, name, type, message) {
    adminNotifications = adminNotifications.filter(n => !(n.phone === phone && !n.resolved));
    adminNotifications.unshift({ id: Date.now(), phone, name, type, message, time: new Date().toLocaleTimeString(), resolved: false });
    save('adminNotifications', adminNotifications);
}

// ==========================================
// FILIAL QO'SHISH
// ==========================================
function createNewBranch() {
    if (!currentUser || currentUser.role !== 'tekshiruvchi' || isSuperAdmin(currentUser)) {
        alert("Filialni faqat Tekshiruvchi qo'sha oladi!");
        return;
    }
    const branchName = document.getElementById('branchNameInput').value.trim();
    const branchAddr = document.getElementById('branchAddressInput').value.trim();
    const bakerName = document.getElementById('branchBakerName').value.trim();
    const bakerLogin = normalizeLogin(document.getElementById('branchBakerLogin').value);
    const bakerPass = document.getElementById('branchBakerPass').value.trim();
    const sellerName = document.getElementById('branchSellerName').value.trim();
    const sellerLogin = normalizeLogin(document.getElementById('branchSellerLogin').value);
    const sellerPass = document.getElementById('branchSellerPass').value.trim();

    if (!branchName) { alert("Somsaxona / Filial nomini kiriting!"); return; }
    if (!bakerName || !validLogin(bakerLogin) || bakerPass.length < 4) {
        alert("Somsachi ismi, logini (3-30 belgi) va parolini (kamida 4 belgi) to'g'ri kiriting!");
        return;
    }
    if (!sellerName || !validLogin(sellerLogin) || sellerPass.length < 4) {
        alert("Sotuvchi ismi, logini (3-30 belgi) va parolini (kamida 4 belgi) to'g'ri kiriting!");
        return;
    }
    if (sameLogin(bakerLogin, sellerLogin)) {
        alert("Somsachi va Sotuvchi loginlari bir xil bo'lishi mumkin emas!");
        return;
    }
    if (users.some(u => sameLogin(u.phone, bakerLogin) || sameLogin(u.phone, sellerLogin))) {
        alert("Kiritilgan loginlardan biri tizimda allaqachon mavjud! Boshqa login kiriting.");
        return;
    }

    const branchId = 'br_' + Date.now();
    branches.push({
        id: branchId,
        ownerPhone: currentUser.phone,
        name: branchName,
        address: branchAddr,
        createdAt: todayStr()
    });
    save('branches', branches);

    users.push({
        phone: bakerLogin,
        passHash: hashPass(bakerPass),
        plainPass: bakerPass,
        role: 'somsachi',
        name: bakerName,
        ownerPhone: currentUser.phone,
        branchId: branchId,
        subStatus: 'free'
    });

    users.push({
        phone: sellerLogin,
        passHash: hashPass(sellerPass),
        plainPass: sellerPass,
        role: 'sotuvchi',
        name: sellerName,
        ownerPhone: currentUser.phone,
        branchId: branchId,
        subStatus: 'free'
    });
    save('users', users);

    ['branchNameInput', 'branchAddressInput', 'branchBakerName', 'branchBakerLogin', 'branchBakerPass', 'branchSellerName', 'branchSellerLogin', 'branchSellerPass']
        .forEach(id => document.getElementById(id).value = '');

    refreshAllUI();
    alert(`✅ "${branchName}" filiali muvaffaqiyatli yaratildi!\n\n👨‍🍳 Somsachi: ${bakerName} | Login: ${bakerLogin} | Parol: ${bakerPass}\n💰 Sotuvchi: ${sellerName} | Login: ${sellerLogin} | Parol: ${sellerPass}`);
}

function deleteBranch(branchId) {
    const br = branches.find(b => b.id === branchId);
    if (!br) return;
    askConfirm(`"${br.name}" filialini va unga biriktirilgan xodim loginlarini o'chirishni tasdiqlaysizmi?`, () => {
        branches = branches.filter(b => b.id !== branchId);
        users = users.filter(u => u.branchId !== branchId);
        if (selectedBranchFilter === branchId) selectedBranchFilter = 'ALL';
        save('branches', branches);
        save('users', users);
        refreshAllUI();
    });
}

function openBranchReportDirect(branchId) {
    selectedBranchFilter = branchId;
    switchTab('ownerDashboardTab');
    refreshAllUI();
}

function onBranchFilterChange(val) {
    selectedBranchFilter = val;
    refreshAllUI();
}

function renderBranchesList() {
    const box = document.getElementById('branchesListContainer');
    if (!box || !currentUser || currentUser.role !== 'tekshiruvchi') return;
    const myBrs = getMyBranches(currentUser.phone);
    if (myBrs.length === 0) {
        box.innerHTML = `<p style="text-align:center; color:var(--slate); padding:16px;">Hozircha filial qo'shilmagan. Yuqoridagi forma orqali birinchi somsaxona filialingizni qo'shing!</p>`;
        return;
    }
    const today = todayStr();
    box.innerHTML = myBrs.map((br, idx) => {
        const staff = users.filter(u => u.branchId === br.id);
        const prod = filterLogsByScope(productionLogs, currentUser.phone, br.id)
            .filter(p => p.date === today && p.status !== 'Brak').reduce((a, p) => a + p.qty, 0);
        const rev = filterLogsByScope(salesLogs, currentUser.phone, br.id)
            .filter(s => s.date === today).reduce((a, s) => a + s.total, 0);
        const exp = filterLogsByScope(expenseLogs, currentUser.phone, br.id)
            .filter(e => e.date === today).reduce((a, e) => a + e.amount, 0);

        const staffHtml = staff.map(st => `
            <div style="margin-top:4px; font-size:12px;">
                <b>${st.role === 'somsachi' ? '👨‍🍳' : '💰'} ${esc(st.name)}</b> (${ROLE_NAMES[st.role]}):
                <span class="cred-pill">Login: ${esc(st.phone)}</span>
                <span class="cred-pill">Parol: ${esc(st.plainPass || '****')}</span>
                <button class="btn-action-sm" onclick="changeStaffPassword('${esc(st.phone)}')">🔑 Parolni o'zgartirish</button>
            </div>
        `).join('');

        return `<div class="branch-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                <div>
                    <div style="font-size:16px; font-weight:800; color:var(--primary);">${idx + 1}. 🏪 ${esc(br.name)} ${br.address ? `<span style="font-size:11px; color:var(--slate); font-weight:600;">(${esc(br.address)})</span>` : ''}</div>
                    <div style="margin-top:6px;">${staffHtml}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; margin-bottom:6px;">
                        Bugun: <b>${prod} ta</b> | Savdo: <b style="color:var(--success);">${rev.toLocaleString()} so'm</b> | Sof: <b>${(rev - exp).toLocaleString()} so'm</b>
                    </div>
                    <button class="btn-action-sm" style="background:var(--primary); color:#fff;" onclick="openBranchReportDirect('${esc(br.id)}')">📊 Alohida Natijani Ko'rish</button>
                    <button class="btn-action-sm" style="background:var(--danger); color:#fff;" onclick="deleteBranch('${esc(br.id)}')">🗑️ O'chirish</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// BOSH ADMIN: TEKSHIRUVCHILARNI BOSHQARISH
// ==========================================
function switchAdminSubTab(n) {
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById('adminSub' + i);
        const btn = document.getElementById('aSubBtn' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', i === n);
    }
    // Ichki menyu bosilganda Admin paneliga o'tib, menyuni yopamiz
    if (currentUser && isSuperAdmin(currentUser)) {
        const panel = document.getElementById('adminPanelTab');
        if (!panel.classList.contains('active')) switchTab('adminPanelTab');
        else closeDrawer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function addTekshiruvchiByAdmin() {
    const name = document.getElementById('newAdminName').value.trim();
    const phone = normalizeLogin(document.getElementById('newAdminPhone').value);
    const pass = document.getElementById('newAdminPass').value.trim();

    if (!name) { alert("Tekshiruvchi ismini kiriting!"); return; }
    if (!validLogin(phone)) { alert("Login 3-30 belgi bo'lsin: harf, raqam yoki ikkalasi!"); return; }
    if (pass.length < 4) { alert("Parol kamida 4 belgidan iborat bo'lsin!"); return; }
    if (users.some(u => sameLogin(u.phone, phone))) { alert("Bu login allaqachon mavjud!"); return; }

    users.push({
        phone,
        passHash: hashPass(pass),
        plainPass: pass,
        role: 'tekshiruvchi',
        name,
        subStatus: 'unpaid',
        subApprovedAt: null,
        subExpiresAt: null,
        frozen: false
    });
    save('users', users);

    document.getElementById('newAdminName').value = '';
    document.getElementById('newAdminPhone').value = '';
    document.getElementById('newAdminPass').value = '';
    refreshAllUI();
    alert(`✅ Tekshiruvchi yaratildi!\nIsm: ${name}\nLogin: ${phone}\nParol: ${pass}`);
}

function openEditTekCredsModal(phone) {
    const u = users.find(x => x.phone === phone);
    if (!u) return;
    document.getElementById('editTekOldPhone').value = u.phone;
    document.getElementById('editTekCredsSubtitle').innerText = `${u.name} uchun login va parolni tahrirlash`;
    document.getElementById('editTekNameInput').value = u.name;
    document.getElementById('editTekLoginInput').value = u.phone;
    document.getElementById('editTekPassInput').value = u.plainPass || '';
    openModal('editTekCredsModal');
}

function saveEditedTekCredentials() {
    const oldPhone = document.getElementById('editTekOldPhone').value;
    const newName = document.getElementById('editTekNameInput').value.trim();
    const newLogin = normalizeLogin(document.getElementById('editTekLoginInput').value);
    const newPass = document.getElementById('editTekPassInput').value.trim();

    if (!newName) { alert("Ismni kiriting!"); return; }
    if (!validLogin(newLogin)) { alert("Login 3-30 belgi bo'lsin!"); return; }
    if (newPass.length < 4) { alert("Parol kamida 4 belgi bo'lsin!"); return; }
    if (oldPhone !== newLogin && users.some(u => sameLogin(u.phone, newLogin))) {
        alert("Bu yangi login band!");
        return;
    }

    const u = users.find(x => x.phone === oldPhone);
    if (!u) return;
    u.name = newName;
    u.phone = newLogin;
    u.plainPass = newPass;
    u.passHash = hashPass(newPass);

    if (oldPhone !== newLogin) {
        users.forEach(st => { if (st.ownerPhone === oldPhone) st.ownerPhone = newLogin; });
        branches.forEach(b => { if (b.ownerPhone === oldPhone) b.ownerPhone = newLogin; });
        save('branches', branches);
    }
    save('users', users);
    closeModal('editTekCredsModal');
    refreshAllUI();
    alert(`✅ Tekshiruvchi ma'lumotlari yangilandi!\nLogin: ${newLogin}\nParol: ${newPass}`);
}

function approveTekshiruvchiPayment(phone) {
    if (!isSuperAdmin(currentUser)) return;
    const u = users.find(x => x.phone === phone);
    if (!u) return;

    const now = Date.now();
    const expires = now + 30 * DAY_MS;
    const amount = Number(appSubSettings.price || 10000);

    u.subStatus = '1month';
    u.subApprovedAt = now;
    u.subExpiresAt = expires;
    u.frozen = false;

    subPaymentHistory.unshift({
        id: now,
        date: todayStr(),
        time: new Date().toLocaleTimeString(),
        phone: u.phone,
        name: u.name,
        amount: amount,
        expiresAt: expires
    });

    adminNotifications.forEach(n => { if (n.phone === phone) n.resolved = true; });
    save('users', users);
    save('subPaymentHistory', subPaymentHistory);
    save('adminNotifications', adminNotifications);
    refreshAllUI();
    alert(`✅ ${u.name} to'lovi (${amount.toLocaleString()} so'm) tasdiqlandi!\nKun sanash boshlandi. Keyingi to'lov sanasi: ${formatDateUz(expires)}`);
}

function toggleFreezeTekshiruvchi(phone) {
    if (!isSuperAdmin(currentUser)) return;
    const u = users.find(x => x.phone === phone);
    if (!u) return;
    u.frozen = !u.frozen;
    save('users', users);
    refreshAllUI();
    alert(u.frozen
        ? `❄️ ${u.name} hisobi MUZLATILDI (vaqtincha o'chirildi). To'lov qilmaguncha tizimga kira olmaydi.`
        : `☀️ ${u.name} hisobi muzlatishdan chiqarildi!`);
}

function permanentlyDeleteTekshiruvchi(phone) {
    if (!isSuperAdmin(currentUser)) return;
    const u = users.find(x => x.phone === phone);
    if (!u) return;
    askConfirm(`DIQQAT! "${u.name}" (${u.phone}) tekshiruvchisini va uning barcha filiallari hamda xodimlarini BUTUNLAY o'chirmoqchimisiz?`, () => {
        users = users.filter(x => x.phone !== phone && x.ownerPhone !== phone);
        branches = branches.filter(b => b.ownerPhone !== phone);
        adminNotifications = adminNotifications.filter(n => n.phone !== phone);
        save('users', users);
        save('branches', branches);
        save('adminNotifications', adminNotifications);
        refreshAllUI();
        alert(`🗑️ ${u.name} platformadan butunlay o'chirildi!`);
    });
}

// ==========================================
// LOGIN, SESSIYA & RUXSATLAR
// ==========================================
function handleLogin() {
    const now = Date.now();
    const errEl = document.getElementById('loginError');
    if (now < lockUntil) {
        errEl.innerText = `Juda ko'p urinish. ${Math.ceil((lockUntil - now) / 1000)} soniyadan keyin qayta urinib ko'ring.`;
        errEl.style.display = 'block';
        return;
    }

    const rawLogin = normalizeLogin(document.getElementById('loginPhone').value);
    const digitsLogin = /^[\d+\-()]+$/.test(rawLogin) ? onlyDigits(rawLogin) : '';
    const pass = document.getElementById('loginPassword').value;
    const hashed = hashPass(pass);

    const user = users.find(u =>
        (sameLogin(u.phone, rawLogin) || (digitsLogin.length >= 4 && u.phone === digitsLogin)) &&
        u.passHash === hashed
    );

    if (user && !isSuperAdmin(user) && user.role !== selectedLoginRole) {
        errEl.innerText = `Bu hisob "${ROLE_NAMES[user.role]}" lavozimiga tegishli. Yuqoridan "${ROLE_NAMES[user.role]}" tugmasini tanlab kiring.`;
        errEl.style.display = 'block';
        return;
    }

    if (user && user.frozen) {
        errEl.innerText = "❄️ Sizning hisobingiz oylik to'lov sababli MUZLATILGAN (vaqtincha o'chirilgan). Bosh Adminga murojaat qiling.";
        errEl.style.display = 'block';
        return;
    }

    if (user && user.blocked) {
        errEl.innerText = "⛔ Bu hisob bloklangan. Tekshiruvchiga murojaat qiling.";
        errEl.style.display = 'block';
        return;
    }

    if (user && (user.role === 'sotuvchi' || user.role === 'somsachi') && user.ownerPhone) {
        const owner = users.find(o => o.phone === user.ownerPhone);
        if (owner && owner.frozen) {
            errEl.innerText = "❄️ Filial egasining (Tekshiruvchi) hisobi muzlatilgan. Tizimga kirish vaqtincha to'xtatilgan.";
            errEl.style.display = 'block';
            return;
        }
    }

    if (user) {
        failedAttempts = 0;
        errEl.style.display = 'none';
        document.getElementById('loginPassword').value = '';
        // Sessiyani eslab qolish: sahifa yangilansa ham login ekraniga qaytmaydi
        try { localStorage.setItem('session', JSON.stringify({ phone: user.phone })); } catch (e) {}
        localStorage.removeItem('lastTab');
        enterApp(user, null);
    } else {
        failedAttempts++;
        errEl.innerText = `Login yoki parol xato! (Urinish: ${failedAttempts}/15)`;
        if (failedAttempts >= 15) {
            lockUntil = Date.now() + 15000;
            failedAttempts = 0;
            errEl.innerText = "15 marta xato kiritildi. 15 soniya kuting.";
        }
        errEl.style.display = 'block';
    }
}

// Ilovaga kirish (login yoki sessiyani tiklashda ishlatiladi)
function enterApp(user, restoreTab) {
    currentUser = user;
    selectedBranchFilter = 'ALL';
    document.documentElement.removeAttribute('data-has-session');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    const roleBadge = isSuperAdmin(user) ? 'BOSH ADMIN' : (ROLE_NAMES[user.role] || user.role).toUpperCase();
    const brTag = user.branchId ? ` • ${getBranchName(user.branchId)}` : '';
    document.getElementById('currentUserDisplay').innerText = `👤 ${user.name} (${roleBadge}${brTag})`;
    document.getElementById('drawerUserName').innerText = user.name;
    document.getElementById('drawerUserRole').innerText = roleBadge + brTag;
    document.getElementById('drawerAvatar').innerText = (user.name || '?').trim().charAt(0).toUpperCase();

    if (!restoreTab && user.role === 'tekshiruvchi' && !isSuperAdmin(user) && !checkSubscriptionActive(user)) {
        pushAdminNotif(user.phone, user.name, 'new_user', `Tekshiruvchi tizimga kirdi (To'lov kutilmoqda): ${user.name} (${user.phone})`);
    }

    applyRolePermissions(user);

    // Oxirgi ochiq bo'limni tiklash (agar bu rol uchun ruxsat etilgan bo'lsa)
    if (restoreTab) {
        const btn = Array.from(document.querySelectorAll('#mainNav button'))
            .find(b => (b.getAttribute('onclick') || '').includes("'" + restoreTab + "'"));
        if (btn && btn.style.display !== 'none') switchTab(restoreTab);
    }
    closeDrawer();
    refreshAllUI();
}

function clearSession() {
    localStorage.removeItem('session');
    localStorage.removeItem('lastTab');
    document.documentElement.removeAttribute('data-has-session');
}

function restoreSession() {
    const s = safeParse('session', null);
    if (!s || !s.phone) { clearSession(); return; }
    const u = users.find(x => x.phone === s.phone);
    const owner = (u && u.ownerPhone) ? users.find(x => x.phone === u.ownerPhone) : null;
    if (!u || u.frozen || u.blocked || (owner && owner.frozen)) { clearSession(); return; }
    enterApp(u, localStorage.getItem('lastTab'));
}

function handleLogout() {
    clearSession();
    currentUser = null;
    cart = [];
    renderCart();
    closeDrawer();
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
}

function applyRolePermissions(user) {
    ['navYopuvchi', 'navKassa', 'navAdmin', 'navOwner', 'navBranches', 'navSubPay', 'navTarix', 'navSozlama'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    const show = ids => ids.forEach(id => document.getElementById(id).style.display = 'flex');
    document.getElementById('priceCard').style.display = (user.role === 'tekshiruvchi' && !isSuperAdmin(user)) ? 'block' : 'none';
    document.getElementById('adminSubMenu').style.display = isSuperAdmin(user) ? 'block' : 'none';

    if (user.role === 'somsachi') {
        show(['navYopuvchi', 'navTarix']);
        switchTab('yopuvchiTab');
    } else if (user.role === 'sotuvchi') {
        show(['navKassa', 'navTarix']);
        switchTab('kassaTab');
    } else if (isSuperAdmin(user)) {
        show(['navAdmin', 'navSozlama']);
        switchTab('adminPanelTab');
    } else if (user.role === 'tekshiruvchi') {
        show(['navSubPay']);
        if (checkSubscriptionActive(user)) {
            show(['navOwner', 'navBranches', 'navTarix', 'navSozlama']);
            switchTab('ownerDashboardTab');
        } else {
            switchTab('subPaymentTab');
        }
    }
}

// ==========================================
// SMS / OGOHLANTIRISH XABARLARI
// ==========================================
function renderGlobalSmsAlerts() {
    const area = document.getElementById('globalSmsAlertArea');
    if (!area || !currentUser) return;
    let html = '';

    if (isSuperAdmin(currentUser)) {
        const tekList = users.filter(u => u.role === 'tekshiruvchi' && !isSuperAdmin(u));
        const dueTeks = tekList.filter(u => isPaymentDue(u) || (daysUntilExpiry(u) !== null && daysUntilExpiry(u) <= 3 && u.subStatus === '1month'));
        dueTeks.forEach(u => {
            const left = daysUntilExpiry(u);
            const msg = left <= 0
                ? `📩 SMS XABAR: "${u.name}" (${u.phone}) tekshiruvchining oylik to'lov kuni keldi (muddat tugagan)!`
                : `📩 SMS ESLATMA: "${u.name}" (${u.phone}) tekshiruvchining oylik to'loviga ${left} kun qoldi (${formatDateUz(u.subExpiresAt)}).`;
            html += `<div class="sms-banner">
                <div style="font-weight:800; font-size:13px; color:var(--danger);">${esc(msg)}</div>
                <div>
                    <button class="btn-action-sm" style="background:var(--success); color:#fff;" onclick="approveTekshiruvchiPayment('${esc(u.phone)}')">✅ To'lovni Tasdiqlash</button>
                    <button class="btn-action-sm" style="background:var(--warning); color:#fff;" onclick="toggleFreezeTekshiruvchi('${esc(u.phone)}')">${u.frozen ? '☀️ Faollashtirish' : '❄️ Muzlatish'}</button>
                </div>
            </div>`;
        });
    } else if (currentUser.role === 'tekshiruvchi') {
        const left = daysUntilExpiry(currentUser);
        if (isPaymentDue(currentUser)) {
            html += `<div class="sms-banner">
                <div style="font-weight:800; font-size:13px; color:var(--danger);">📩 SMS XABAR: Sizning 1 oylik obuna to'lovingiz muddati keldi! Platformada faol qolish uchun to'lovni amalga oshiring, aks holda hisobingiz vaqtincha muzlatiladi.</div>
                <button class="btn-action-sm" style="background:var(--primary); color:#fff;" onclick="switchTab('subPaymentTab')">💳 Hozir To'lov Qilish</button>
            </div>`;
        } else if (left !== null && left <= 3 && currentUser.subStatus === '1month') {
            html += `<div class="sms-banner" style="border-color:var(--warning);">
                <div style="font-weight:800; font-size:13px; color:var(--warning);">📩 SMS ESLATMA: Oylik to'lov kuningizga ${left} kun qoldi (${formatDateUz(currentUser.subExpiresAt)}).</div>
                <button class="btn-action-sm" style="background:var(--primary); color:#fff;" onclick="switchTab('subPaymentTab')">💳 To'lov Sahifasi</button>
            </div>`;
        }
    }
    area.innerHTML = html;
}

function renderSubPaymentPanel() {
    if (!currentUser || currentUser.role !== 'tekshiruvchi') return;
    document.getElementById('displayAdminCardNum').innerText = appSubSettings.cardNumber || '8600 0000 0000 0000';
    document.getElementById('displayAdminCardOwner').innerText = appSubSettings.cardOwner || 'Asilbek Admin';
    document.getElementById('displayAdminSubPrice').innerText = Number(appSubSettings.price || 10000).toLocaleString() + " so'm";

    const badgeBox = document.getElementById('activeSubBadgeBox');
    const descEl = document.getElementById('subStatusDesc');

    if (currentUser.subStatus === 'free') {
        badgeBox.innerHTML = `<span class="badge badge-success" style="font-size:12px; padding:6px 12px;">♾️ Siz dastur to'lovidan ozod qilingansiz</span>`;
        descEl.innerText = "Bosh Admin tomonidan sizga cheksiz bepul ruxsat berilgan.";
    } else if (checkSubscriptionActive(currentUser)) {
        badgeBox.innerHTML = `<span class="badge badge-success" style="font-size:12px; padding:6px 12px;">✅ Obuna faol! Tasdiqlangan: ${formatDateUz(currentUser.subApprovedAt)} | Keyingi to'lov: ${formatDateUz(currentUser.subExpiresAt)}</span>`;
        descEl.innerText = "Obunangiz faol. Keyingi oy shu kunda oylik to'lov eslatmasi keladi.";
    } else if (currentUser.subStatus === 'pending') {
        badgeBox.innerHTML = `<span class="badge badge-warning" style="font-size:12px; padding:6px 12px;">⏳ To'lov xabari yuborilgan. Admin tasdiqlashi kutilmoqda...</span>`;
        descEl.innerText = "Admin tasdiqlashi bilan shu kundan boshlab 30 kunlik muddat boshlanadi.";
    } else {
        badgeBox.innerHTML = `<span class="badge badge-danger" style="font-size:12px; padding:6px 12px;">🔒 Obuna faol emas (1 oylik to'lov talab qilinadi)</span>`;
        descEl.innerText = "Admin kartasiga to'lov qilib, 'To'lov qildim' tugmasini bosing.";
    }
}

function copyAdminCard() {
    const num = (appSubSettings.cardNumber || '').replace(/\s/g, '');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(num).then(() => alert("✅ Karta raqami nusxalandi: " + appSubSettings.cardNumber));
    } else {
        alert("Karta raqami: " + appSubSettings.cardNumber);
    }
}

function notifyAdminPayment() {
    if (!currentUser) return;
    const u = users.find(x => x.phone === currentUser.phone);
    if (u) { u.subStatus = 'pending'; currentUser = u; save('users', users); }
    const amount = Number(appSubSettings.price || 10000).toLocaleString();
    pushAdminNotif(currentUser.phone, currentUser.name, 'payment_sent', `💰 ${currentUser.name} (${currentUser.phone}) 1 oylik to'lov (${amount} so'm) qilganini bildirdi!`);
    renderSubPaymentPanel();
    alert("✅ Adminga to'lov haqida xabar yuborildi! Admin tasdiqlagan kundan boshlab 30 kunlik muddat boshlanadi.");
}

function saveAdminSubSettings() {
    const price = parseInt(document.getElementById('adminSubPriceInput').value) || 0;
    const digits = onlyDigits(document.getElementById('adminSubCardInput').value.trim());
    const owner = document.getElementById('adminSubOwnerInput').value.trim();
    if (digits.length !== 16) { alert("Karta raqami 16 ta raqamdan iborat bo'lishi kerak!"); return; }
    if (!owner) { alert("Karta egasining ism-familiyasini kiriting!"); return; }
    appSubSettings = { price, cardNumber: digits.replace(/(\d{4})(?=\d)/g, '$1 '), cardOwner: owner };
    save('appSubSettings', appSubSettings);
    refreshAllUI();
    alert("✅ Admin kartasi va oylik to'lov tarifi saqlandi!");
}

function renderAdminNotifications() {
    const area = document.getElementById('adminNotificationsArea');
    if (!area) return;
    if (!currentUser || !isSuperAdmin(currentUser)) { area.innerHTML = ''; return; }
    const active = adminNotifications.filter(n => !n.resolved);
    if (active.length === 0) { area.innerHTML = ''; return; }

    let html = `<div class="card" style="border:2px solid var(--warning); background:var(--warning-light);">
        <div class="card-title" style="color:var(--warning);">
            <span>🔔 Yangi To'lov / Kirish Xabarlari</span>
            <span class="badge badge-danger">${active.length} ta</span>
        </div>`;
    active.forEach(n => {
        html += `<div class="notif-alert">
            <div style="text-align:left;">
                <div style="font-weight:800; font-size:13px; color:var(--text-color);">${esc(n.message)}</div>
                <div style="font-size:11px; color:var(--slate); margin-top:2px;">Vaqt: ${esc(n.time)}</div>
            </div>
            <button type="button" class="btn-action-sm" style="background:var(--success); color:white; white-space:nowrap;" onclick="approveTekshiruvchiPayment('${esc(n.phone)}')">✅ Tasdiqlash (30 kun)</button>
        </div>`;
    });
    area.innerHTML = html + `</div>`;
}

// ==========================================
// SOMSA CHIQARISH & KASSA
// ==========================================
function setStatus(status) {
    currentStatus = status;
    document.getElementById('btnChiqdi').className = "status-btn" + (status === 'Chiqdi' ? " active-chiqdi" : "");
    document.getElementById('btnBrak').className = "status-btn" + (status === 'Brak' ? " active-brak" : "");
    document.getElementById('btnAsarti').className = "status-btn" + (status === 'Asarti' ? " active-asarti" : "");
}

function setStepQty(val) {
    quickStepQty = val;
    [1, 5, 10, 20, 30].forEach(n => {
        const b = document.getElementById('stepBtn' + n);
        if (b) {
            b.style.background = (n === val) ? 'var(--primary)' : 'var(--border)';
            b.style.color = (n === val) ? '#fff' : 'var(--text-color)';
        }
    });
    renderSomsaButtons();
}

function quickAddProduction(somsaId) {
    const somsa = somsaTypes.find(s => s.id === somsaId);
    if (!somsa) return;
    const manualInput = document.getElementById('manualQtyInput');
    let qty = parseInt(manualInput.value);
    if (isNaN(qty) || qty <= 0) qty = quickStepQty || 1;
    else manualInput.value = '';

    productionLogs.unshift({
        id: Date.now(),
        date: todayStr(),
        time: new Date().toLocaleTimeString(),
        worker: currentUser ? currentUser.name : "Somsachi",
        workerPhone: currentUser ? currentUser.phone : '',
        ownerPhone: currentUser ? (currentUser.ownerPhone || '') : '',
        branchId: currentUser ? (currentUser.branchId || '') : '',
        status: currentStatus,
        somsaId: somsa.id,
        somsaName: somsa.name,
        qty: qty,
        price: somsa.price,
        workerFee: currentStatus === 'Brak' ? 0 : (qty * WORKER_RATE)
    });
    save('productionLogs', productionLogs);
    refreshAllUI();
}

function renderSomsaButtons() {
    const workerContainer = document.getElementById('workerSomsaList');
    const kassaContainer = document.getElementById('kassaSomsaList');
    if (!workerContainer || !kassaContainer) return;
    workerContainer.innerHTML = '';
    kassaContainer.innerHTML = '';
    const today = todayStr();
    const myOwner = currentUser ? (currentUser.ownerPhone || '') : '';
    const myBranch = currentUser ? (currentUser.branchId || 'ALL') : 'ALL';

    if (currentUser && currentUser.role === 'somsachi') {
        setText('workerBranchBadge', getBranchName(currentUser.branchId));
    }
    if (currentUser && currentUser.role === 'sotuvchi') {
        setText('sellerBranchBadge', getBranchName(currentUser.branchId));
    }

    somsaTypes.forEach(s => {
        const todayCount = filterLogsByScope(productionLogs, myOwner, myBranch)
            .filter(p => p.date === today && p.somsaId === s.id && p.status !== 'Brak' && (currentUser ? p.worker === currentUser.name : true))
            .reduce((sum, p) => sum + p.qty, 0);

        const wBtn = document.createElement('div');
        wBtn.className = 'somsa-btn';
        wBtn.onclick = () => quickAddProduction(s.id);
        wBtn.innerHTML = `<div style="font-weight:800; font-size:13px;">${esc(s.name)}</div><div style="font-size:11px; color:var(--primary); font-weight:800; margin-top:4px;">+${quickStepQty} Qo'shish</div><div style="font-size:10px; opacity:.8; margin-top:2px;">Bugun: <b>${todayCount} ta</b></div>`;
        workerContainer.appendChild(wBtn);

        const remain = getRemain(s.id, today, myOwner, myBranch);
        const kBtn = document.createElement('div');
        kBtn.className = 'somsa-btn';
        if (remain <= 0) kBtn.style.opacity = '0.45';
        kBtn.onclick = () => addToCart(s);
        kBtn.innerHTML = `<div style="font-weight:700;">${esc(s.name)}</div><div style="font-size:10px; opacity:.8; margin-top:2px;">${s.price.toLocaleString()} so'm</div><div style="font-size:10px; margin-top:2px; font-weight:700;">Qoldi: ${remain}</div>`;
        kassaContainer.appendChild(kBtn);
    });
}

function renderWorkerPersonalStats() {
    if (!currentUser) return;
    const today = todayStr();
    const myLogs = productionLogs.filter(p => p.date === today && p.worker === currentUser.name);
    const totalEarn = myLogs.reduce((sum, p) => sum + p.workerFee, 0);
    const producedQty = myLogs.filter(p => p.status !== 'Brak').reduce((sum, p) => sum + p.qty, 0);
    const brakQty = myLogs.filter(p => p.status === 'Brak').reduce((sum, p) => sum + p.qty, 0);
    setText('workerPersonalEarn', totalEarn.toLocaleString() + " so'm");
    setText('workerPersonalDetail', `Chiqarildi: ${producedQty} ta | Brak: ${brakQty} ta`);
}

function renderWorkerTypeSummary() {
    const box = document.getElementById('workerTypeSummary');
    if (!box) return;
    const today = todayStr();
    const myLogs = productionLogs.filter(p => p.date === today && (currentUser ? p.worker === currentUser.name : true));
    box.innerHTML = somsaTypes.map(s => {
        const good = myLogs.filter(p => p.somsaId === s.id && p.status !== 'Brak').reduce((a, b) => a + b.qty, 0);
        const brak = myLogs.filter(p => p.somsaId === s.id && p.status === 'Brak').reduce((a, b) => a + b.qty, 0);
        return `<div class="type-summary-card"><div class="t-name">${esc(s.name)}</div><div class="t-counts">✅ Chiqdi: <b>${good} ta</b><br>❌ Brak: <b style="color:var(--danger);">${brak} ta</b></div></div>`;
    }).join('');
}

function renderWorkerTodayTable() {
    const tbody = document.getElementById('workerTodayTable');
    if (!tbody) return;
    const today = todayStr();
    const myLogs = productionLogs.filter(p => p.date === today && (currentUser ? p.worker === currentUser.name : true));
    if (myLogs.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--slate);">Bugun hali yozuv yo'q</td></tr>`; return; }
    tbody.innerHTML = myLogs.map(p => {
        const badge = p.status === 'Brak' ? 'badge-danger' : p.status === 'Asarti' ? 'badge-warning' : 'badge-success';
        return `<tr><td>${esc(p.time)}</td><td><span class="badge ${badge}">${esc(p.status)}</span></td><td><b>${esc(p.somsaName)}</b>: ${p.qty} ta</td><td><b>${p.workerFee.toLocaleString()} so'm</b></td><td><button class="btn-action-sm" onclick="openEditModal('production', ${p.id}, 'edit')">✏️</button><button class="btn-action-sm" onclick="openEditModal('production', ${p.id}, 'delete')">🗑️</button></td></tr>`;
    }).join('');
}

function setPaymentType(type) {
    selectedPaymentType = type;
    document.getElementById('btnPayCash').className = "pay-btn" + (type === 'Naqd' ? " active-cash" : "");
    document.getElementById('btnPayCard').className = "pay-btn" + (type === 'Karta' ? " active-card" : "");
}

function addToCart(somsa) {
    const myOwner = currentUser ? (currentUser.ownerPhone || '') : '';
    const myBranch = currentUser ? (currentUser.branchId || 'ALL') : 'ALL';
    const remain = getRemain(somsa.id, todayStr(), myOwner, myBranch);
    if (getInCart(somsa.id) + 1 > remain) { alert(`"${somsa.name}" qoldig'i yetarli emas! Filial qoldig'i: ${remain} ta.`); return; }
    const item = cart.find(c => c.id === somsa.id);
    if (item) item.qty++; else cart.push({ id: somsa.id, name: somsa.name, price: somsa.price, qty: 1 });
    renderCart();
}

function renderCart() {
    const cartDiv = document.getElementById('cartList');
    if (!cartDiv) return;
    let total = 0, html = '';
    if (cart.length === 0) html = `<p style="color:var(--slate); text-align:center; padding:12px; font-size:12px;">Savat bo'sh. Somsa tanlang.</p>`;
    cart.forEach((item, index) => {
        const itemTotal = item.qty * item.price;
        total += itemTotal;
        html += `<div class="cart-item"><div><b>${esc(item.name)}</b><br><small style="color:var(--slate);">${item.price.toLocaleString()} so'm</small></div><div class="cart-controls"><button onclick="changeCartQty(${index}, -1)">-</button><span style="font-weight:700; width:18px; text-align:center;">${item.qty}</span><button onclick="changeCartQty(${index}, 1)">+</button><span style="font-weight:700; width:65px; text-align:right;">${itemTotal.toLocaleString()}</span></div></div>`;
    });
    cartDiv.innerHTML = html;
    document.getElementById('cartTotal').innerText = total.toLocaleString();
}

function changeCartQty(index, delta) {
    const item = cart[index];
    if (!item) return;
    if (delta > 0) {
        const myOwner = currentUser ? (currentUser.ownerPhone || '') : '';
        const myBranch = currentUser ? (currentUser.branchId || 'ALL') : 'ALL';
        const remain = getRemain(item.id, todayStr(), myOwner, myBranch);
        if (item.qty + delta > remain) { alert(`"${item.name}" qoldig'i yetarli emas! Qoldi: ${remain} ta.`); return; }
    }
    item.qty += delta;
    if (item.qty <= 0) cart.splice(index, 1);
    renderCart();
}

function completeSale() {
    if (cart.length === 0) { alert("Savat bo'sh!"); return; }
    const totalSum = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    if (selectedPaymentType === 'Karta') {
        document.getElementById('modalAmount').innerText = totalSum.toLocaleString() + " so'm";
        const info = document.getElementById('paymentCardInfo');
        info.innerHTML = cardNumber
            ? `<div class="card-number-box">${esc(cardNumber)}</div>`
            : `<div class="card-number-box" style="font-size:12px; border-color:var(--warning);">Karta raqami kiritilmagan.</div>`;
        openModal('paymentModal');
    } else {
        saveFinalSale('Naqd');
    }
}

function confirmCardSale() {
    askConfirm("Pul hisobga tushganini tekshirdingizmi?", () => {
        closeModal('paymentModal');
        saveFinalSale('Karta');
    });
}

function saveFinalSale(payType) {
    const custName = document.getElementById('custName').value.trim() || ("Mijoz №" + (salesLogs.length + 1));
    const newSale = {
        id: Date.now(),
        date: todayStr(),
        time: new Date().toLocaleTimeString(),
        seller: currentUser ? currentUser.name : "Sotuvchi",
        ownerPhone: currentUser ? (currentUser.ownerPhone || '') : '',
        branchId: currentUser ? (currentUser.branchId || '') : '',
        customer: custName,
        paymentType: payType,
        items: cart.map(i => ({ ...i })),
        total: cart.reduce((sum, item) => sum + item.qty * item.price, 0)
    };
    salesLogs.unshift(newSale);
    save('salesLogs', salesLogs);
    cart = [];
    document.getElementById('custName').value = '';
    setPaymentType('Naqd');
    renderCart();
    refreshAllUI();
    alert("✅ Sotuv muvaffaqiyatli yopildi!");
}

function renderBalanceTable() {
    const tbody = document.getElementById('balanceTable');
    if (!tbody) return;
    const today = todayStr();
    const myOwner = currentUser ? (currentUser.ownerPhone || '') : '';
    const myBranch = currentUser ? (currentUser.branchId || 'ALL') : 'ALL';
    tbody.innerHTML = somsaTypes.map(s => {
        const chiqdi = getProduced(s.id, today, myOwner, myBranch);
        const brak = getBrak(s.id, today, myOwner, myBranch);
        const sold = getSold(s.id, today, myOwner, myBranch);
        const remain = chiqdi - sold;
        return `<tr><td><b>${esc(s.name)}</b></td><td>${chiqdi}</td><td style="color:var(--danger); font-weight:700;">${brak}</td><td>${sold}</td><td><span class="badge ${remain >= 0 ? 'badge-success' : 'badge-danger'}">${remain} ta</span></td></tr>`;
    }).join('');
}

function addExpense() {
    const title = document.getElementById('expTitle').value.trim();
    const amount = parseInt(document.getElementById('expAmount').value);
    if (!title || !amount || amount <= 0) { alert("Rasxod nomi va summasini kiriting!"); return; }
    expenseLogs.unshift({
        id: Date.now(),
        date: todayStr(),
        time: new Date().toLocaleTimeString(),
        seller: currentUser ? currentUser.name : 'Sotuvchi',
        ownerPhone: currentUser ? (currentUser.ownerPhone || '') : '',
        branchId: currentUser ? (currentUser.branchId || '') : '',
        title,
        amount
    });
    save('expenseLogs', expenseLogs);
    document.getElementById('expTitle').value = '';
    document.getElementById('expAmount').value = '';
    refreshAllUI();
    alert("✅ Rasxod saqlandi!");
}

function renderExpenses() {
    const today = todayStr();
    const myOwner = getTekshiruvchiOwnerPhone(currentUser);
    const branchScope = (currentUser && currentUser.role === 'tekshiruvchi') ? selectedBranchFilter : (currentUser ? (currentUser.branchId || 'ALL') : 'ALL');

    const list = filterLogsByScope(expenseLogs, myOwner, branchScope).filter(e => e.date === today);
    setText('expenseTodayTotal', list.reduce((a, e) => a + e.amount, 0).toLocaleString() + " so'm");

    const tb = document.getElementById('expenseTodayTable');
    if (tb) tb.innerHTML = list.length ? list.map(e => `<tr><td>${esc(e.time)}</td><td><b>${esc(e.title)}</b></td><td><b>${e.amount.toLocaleString()} so'm</b></td><td><button class="btn-action-sm" onclick="openEditModal('expense', ${e.id}, 'delete')">🗑️</button></td></tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color:var(--slate);">Bugun rasxod yo'q</td></tr>`;

    const ot = document.getElementById('ownerExpenseTable');
    if (ot) ot.innerHTML = list.length ? list.map(e => `<tr><td>${esc(e.time)}</td><td><span class="badge badge-blue">${esc(getBranchName(e.branchId))}</span></td><td>${esc(e.seller)}</td><td><b>${esc(e.title)}</b></td><td><b>${e.amount.toLocaleString()} so'm</b></td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--slate);">Bugun rasxod yo'q</td></tr>`;
}

// ==========================================
// DASHBOARDLAR
// ==========================================
function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }

function renderOwnerDashboard() {
    const today = todayStr();

    if (currentUser && currentUser.role === 'tekshiruvchi' && !isSuperAdmin(currentUser)) {
        const myOwner = currentUser.phone;
        const myBrs = getMyBranches(myOwner);

        const filterSel = document.getElementById('ownerBranchFilter');
        if (filterSel) {
            filterSel.innerHTML = `<option value="ALL">🌐 Barcha filiallar (Umumiy)</option>` +
                myBrs.map(b => `<option value="${esc(b.id)}" ${selectedBranchFilter === b.id ? 'selected' : ''}>🏪 ${esc(b.name)}</option>`).join('');
        }
        const addStaffBrSel = document.getElementById('newUserBranch');
        if (addStaffBrSel) {
            addStaffBrSel.innerHTML = myBrs.length
                ? myBrs.map(b => `<option value="${esc(b.id)}">🏪 ${esc(b.name)}</option>`).join('')
                : `<option value="">Avval Filial qo'shing</option>`;
        }

        setText('selectedBranchHeaderLabel', selectedBranchFilter === 'ALL'
            ? `Barcha filiallar (${myBrs.length} ta filial umumiy)`
            : `🏪 ${getBranchName(selectedBranchFilter)} (Alohida hisobot)`);

        const compBody = document.getElementById('ownerBranchComparisonTable');
        if (compBody) {
            if (myBrs.length === 0) {
                compBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--slate);">Hozircha filial qo'shilmagan. "Somsa Filiallari" bo'limidan filial qo'shing.</td></tr>`;
            } else {
                compBody.innerHTML = myBrs.map(b => {
                    const bProd = filterLogsByScope(productionLogs, myOwner, b.id).filter(p => p.date === today && p.status !== 'Brak').reduce((a, p) => a + p.qty, 0);
                    const bRev = filterLogsByScope(salesLogs, myOwner, b.id).filter(s => s.date === today).reduce((a, s) => a + s.total, 0);
                    const bExp = filterLogsByScope(expenseLogs, myOwner, b.id).filter(e => e.date === today).reduce((a, e) => a + e.amount, 0);
                    return `<tr style="${selectedBranchFilter === b.id ? 'background:var(--primary-light);' : ''}">
                        <td><b>🏪 ${esc(b.name)}</b></td>
                        <td>${bProd} ta</td>
                        <td style="color:var(--success); font-weight:700;">${bRev.toLocaleString()} so'm</td>
                        <td style="color:var(--danger);">${bExp.toLocaleString()} so'm</td>
                        <td><b>${(bRev - bExp).toLocaleString()} so'm</b></td>
                        <td><button class="btn-action-sm" style="background:var(--primary); color:#fff;" onclick="onBranchFilterChange('${esc(b.id)}')">Ko'rish</button></td>
                    </tr>`;
                }).join('');
            }
        }

        const scopedSales = filterLogsByScope(salesLogs, myOwner, selectedBranchFilter).filter(s => s.date === today);
        const scopedProd = filterLogsByScope(productionLogs, myOwner, selectedBranchFilter).filter(p => p.date === today);
        const scopedExp = filterLogsByScope(expenseLogs, myOwner, selectedBranchFilter).filter(e => e.date === today);

        const sum = arr => arr.reduce((a, s) => a + s.total, 0);
        const todayExpSum = scopedExp.reduce((a, e) => a + e.amount, 0);
        setText('ownerTodayRevenue', sum(scopedSales).toLocaleString() + " so'm");
        setText('ownerTodayCash', sum(scopedSales.filter(s => (s.paymentType || 'Naqd') === 'Naqd')).toLocaleString() + " so'm");
        setText('ownerTodayCard', sum(scopedSales.filter(s => s.paymentType === 'Karta')).toLocaleString() + " so'm");
        setText('ownerTodayExpense', todayExpSum.toLocaleString() + " so'm");
        setText('ownerTodayNet', (sum(scopedSales) - todayExpSum).toLocaleString() + " so'm");
        setText('ownerTodayProduced', scopedProd.filter(p => p.status !== 'Brak').reduce((a, p) => a + p.qty, 0).toLocaleString() + " ta");
        setText('ownerTodaySalary', scopedProd.reduce((a, p) => a + p.workerFee, 0).toLocaleString() + " so'm");

        const topBody = document.getElementById('topSellingTable');
        if (topBody) {
            const top = somsaTypes.map(s => {
                const qty = getSold(s.id, today, myOwner, selectedBranchFilter);
                return { name: s.name, qty, sum: qty * s.price };
            }).filter(x => x.qty > 0).sort((a, b) => b.qty - a.qty);
            topBody.innerHTML = top.length
                ? top.map((x, i) => `<tr><td><b>${i === 0 ? '🥇 ' : ''}${esc(x.name)}</b></td><td>${x.qty} ta</td><td>${x.sum.toLocaleString()} so'm</td></tr>`).join('')
                : `<tr><td colspan="3" style="text-align:center; color:var(--slate);">Bugun sotuv yo'q</td></tr>`;
        }

        const tbody = document.getElementById('ownerWorkerStatsTable');
        if (tbody) {
            const workerNames = [...new Set(scopedProd.map(p => p.worker))];
            tbody.innerHTML = workerNames.length ? workerNames.map(w => {
                const mine = scopedProd.filter(p => p.worker === w);
                const wProd = mine.filter(p => p.status !== 'Brak').reduce((a, p) => a + p.qty, 0);
                const wBrak = mine.filter(p => p.status === 'Brak').reduce((a, p) => a + p.qty, 0);
                const wFee = mine.reduce((a, p) => a + p.workerFee, 0);
                const brName = getBranchName(mine[0]?.branchId);
                return `<tr><td><b>${esc(w)}</b></td><td><span class="badge badge-blue">${esc(brName)}</span></td><td>${wProd} ta</td><td style="color:var(--danger); font-weight:700;">${wBrak} ta</td><td><b>${wFee.toLocaleString()} so'm</b></td></tr>`;
            }).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--slate);">Bugun ishlab chiqarish yo'q</td></tr>`;
        }
    }

    if (isSuperAdmin(currentUser)) {
        const tekshiruvchilar = users.filter(u => u.role === 'tekshiruvchi' && !isSuperAdmin(u));
        const activeT = tekshiruvchilar.filter(u => checkSubscriptionActive(u));
        const frozenOrDue = tekshiruvchilar.filter(u => !checkSubscriptionActive(u) || u.frozen);

        setText('statTekshiruvchilarCount', tekshiruvchilar.length + " ta");
        setText('statActiveTekCount', activeT.length + " ta");
        setText('statFrozenTekCount', frozenOrDue.length + " ta");
        setText('statTotalBranchesCount', branches.length + " ta");
        setText('statCustomers', users.filter(u => u.role === 'sotuvchi').length + " ta");
        setText('statWorkers', users.filter(u => u.role === 'somsachi').length + " ta");
        setText('statTotalUsers', users.length + " ta");
        setText('statTotalOrders', salesLogs.length + " ta");
        const totalGmv = salesLogs.reduce((a, s) => a + s.total, 0);
        setText('statTotalPlatformGmv', totalGmv.toLocaleString() + " so'm");

        const collectedSum = subPaymentHistory.reduce((a, p) => a + Number(p.amount || 0), 0);
        setText('adminTotalCollectedSum', collectedSum.toLocaleString() + " so'm");
        setText('adminTotalPaymentsCount', subPaymentHistory.length + " ta");
        setText('crmNetProfit', (collectedSum - crmExpensesVal).toLocaleString() + " so'm");

        const payHistBody = document.getElementById('adminPaymentHistoryTable');
        if (payHistBody) {
            payHistBody.innerHTML = subPaymentHistory.length ? subPaymentHistory.map(p => `<tr>
                <td>${esc(p.date)} ${esc(p.time)}</td>
                <td><b>${esc(p.name)}</b></td>
                <td><code>${esc(p.phone)}</code></td>
                <td style="color:var(--success); font-weight:800;">+${Number(p.amount).toLocaleString()} so'm</td>
                <td>${formatDateUz(p.expiresAt)} gacha</td>
            </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--slate);">Hozircha to'lovlar kelib tushmagan</td></tr>`;
        }

        const listBody = document.getElementById('adminTekshiruvchiListTable');
        if (listBody) {
            listBody.innerHTML = tekshiruvchilar.length ? tekshiruvchilar.map(u => {
                const brCount = getMyBranches(u.phone).length;
                const stBadge = u.frozen
                    ? `<span class="badge badge-danger">❄️ Muzlatilgan</span>`
                    : (checkSubscriptionActive(u) ? `<span class="badge badge-success">✅ Faol</span>` : `<span class="badge badge-warning">⏳ To'lov kutilmoqda</span>`);
                return `<tr>
                    <td><b>${esc(u.name)}</b></td>
                    <td><code>${esc(u.phone)}</code></td>
                    <td><code style="background:var(--warning-light); padding:3px 6px; border-radius:4px;">${esc(u.plainPass || '****')}</code></td>
                    <td>${brCount} ta filial</td>
                    <td>${stBadge}</td>
                    <td><button class="btn-action-sm" style="background:var(--primary); color:#fff;" onclick="openEditTekCredsModal('${esc(u.phone)}')">🔐 Login/Parolni O'zgartirish</button></td>
                </tr>`;
            }).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--slate);">Hozircha tekshiruvchi yaratilmagan</td></tr>`;
        }

        const manageBody = document.getElementById('adminManageTekshiruvchiTable');
        if (manageBody) {
            manageBody.innerHTML = tekshiruvchilar.length ? tekshiruvchilar.map(u => {
                let statusHtml = '';
                if (u.frozen) statusHtml = `<span class="badge badge-danger">❄️ Muzlatilgan (Vaqtincha o'chirilgan)</span>`;
                else if (u.subStatus === 'free') statusHtml = `<span class="badge badge-blue">♾️ Bepul / Ozod</span>`;
                else if (checkSubscriptionActive(u)) statusHtml = `<span class="badge badge-success">✅ Faol (30 kun)</span>`;
                else if (u.subStatus === 'pending') statusHtml = `<span class="badge badge-warning">💰 To'lov qildim deb xabar bergan</span>`;
                else statusHtml = `<span class="badge badge-danger">🔒 To'lanmagan / Muddati tugagan</span>`;

                return `<tr>
                    <td><b>${esc(u.name)}</b><br><small style="color:var(--slate);">${esc(u.phone)}</small></td>
                    <td>${statusHtml}</td>
                    <td>${formatDateUz(u.subApprovedAt)}</td>
                    <td><b>${u.subStatus === 'free' ? 'Cheksiz' : formatDateUz(u.subExpiresAt)}</b></td>
                    <td>
                        <button class="btn-action-sm" style="background:var(--success); color:#fff;" onclick="approveTekshiruvchiPayment('${esc(u.phone)}')">✅ To'lovni Tasdiqlash (30 kun)</button>
                        <button class="btn-action-sm" style="background:var(--warning); color:#fff;" onclick="toggleFreezeTekshiruvchi('${esc(u.phone)}')">${u.frozen ? '☀️ Faollashtirish' : '❄️ Muzlatish'}</button>
                        <button class="btn-action-sm" style="background:var(--danger); color:#fff;" onclick="permanentlyDeleteTekshiruvchi('${esc(u.phone)}')">🗑️ Butunlay O'chirish</button>
                    </td>
                </tr>`;
            }).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--slate);">Tekshiruvchilar yo'q</td></tr>`;
        }
    }
}

function addUser() {
    if (!currentUser || currentUser.role !== 'tekshiruvchi' || isSuperAdmin(currentUser)) return;
    const branchId = document.getElementById('newUserBranch').value;
    const name = document.getElementById('newUserName').value.trim();
    const loginCode = normalizeLogin(document.getElementById('newUserPhone').value);
    const role = document.getElementById('newUserRole').value;
    const pass = document.getElementById('newUserPass').value.trim();

    if (!branchId) { alert("Avval 'Somsa Filiallari' bo'limidan kamida bitta filial yarating!"); return; }
    if (!name) { alert("Xodim ismini kiriting!"); return; }
    if (!validLogin(loginCode)) { alert("Login 3-30 belgi bo'lsin!"); return; }
    if (pass.length < 4) { alert("Parol kamida 4 belgi bo'lsin!"); return; }
    if (users.some(u => sameLogin(u.phone, loginCode))) { alert("Bu login allaqachon mavjud!"); return; }

    users.push({
        phone: loginCode,
        passHash: hashPass(pass),
        plainPass: pass,
        role,
        name,
        ownerPhone: currentUser.phone,
        branchId,
        subStatus: 'free'
    });
    save('users', users);
    ['newUserName', 'newUserPhone', 'newUserPass'].forEach(id => document.getElementById(id).value = '');
    refreshAllUI();
    alert(`✅ Xodim qo'shildi!\nFilial: ${getBranchName(branchId)}\nLogin: ${loginCode}\nParol: ${pass}`);
}

function changeStaffPassword(phone) {
    const u = users.find(x => x.phone === phone);
    if (!u) return;
    askInput(`${u.name} (Login: ${u.phone}) uchun yangi parol (kamida 4 belgi):`, u.plainPass || '', p => {
        p = (p || '').trim();
        if (p.length < 4) { alert("Parol kamida 4 belgidan iborat bo'lsin!"); return; }
        u.plainPass = p;
        u.passHash = hashPass(p);
        save('users', users);
        refreshAllUI();
        alert(`✅ ${u.name} paroli yangilandi: ${p}`);
    });
}

function deleteUser(phone) {
    const u = users.find(x => x.phone === phone);
    if (!u || isSuperAdmin(u)) return;
    askConfirm(`${u.name} ni o'chirishni tasdiqlaysizmi?`, () => {
        users = users.filter(x => x.phone !== phone);
        save('users', users);
        refreshAllUI();
    });
}

function renderUsers() {
    const st = document.getElementById('usersTable');
    if (!st || !currentUser || currentUser.role !== 'tekshiruvchi' || isSuperAdmin(currentUser)) return;
    const myStaff = users.filter(u => u.ownerPhone === currentUser.phone);
    st.innerHTML = myStaff.length ? myStaff.map(u => `<tr>
        <td><b>${esc(u.name)}</b></td>
        <td><span class="badge badge-blue">${esc(getBranchName(u.branchId))}</span></td>
        <td><code>${esc(u.phone)}</code></td>
        <td><code>${esc(u.plainPass || '****')}</code></td>
        <td>${esc(ROLE_NAMES[u.role] || u.role)}</td>
        <td>
            <button class="btn-action-sm" onclick="changeStaffPassword('${esc(u.phone)}')">🔑 Parol</button>
            <button class="btn-action-sm" onclick="deleteUser('${esc(u.phone)}')">🗑️</button>
        </td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--slate);">Xodimlar yo'q</td></tr>`;
}

// ==========================================
// HISOBOTLAR, TARIX, AUDIT VA SOZLAMALAR
// ==========================================
function lastNDays(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        out.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()));
    }
    return out;
}

function buildReport(n, ownerPhone, branchId) {
    let totS = 0, totE = 0, rows = '';
    const sList = filterLogsByScope(salesLogs, ownerPhone, branchId);
    const eList = filterLogsByScope(expenseLogs, ownerPhone, branchId);

    lastNDays(n).forEach(day => {
        const s = sList.filter(x => x.date === day).reduce((a, x) => a + x.total, 0);
        const e = eList.filter(x => x.date === day).reduce((a, x) => a + x.amount, 0);
        totS += s; totE += e;
        if (!s && !e) return;
        const net = s - e;
        rows += `<tr><td>${day.split('-').reverse().join('.')}</td><td>${s.toLocaleString()}</td><td style="color:var(--danger);">${e.toLocaleString()}</td><td style="font-weight:800; color:var(${net >= 0 ? '--success' : '--danger'});">${net.toLocaleString()}</td></tr>`;
    });
    if (!rows) rows = `<tr><td colspan="4" style="text-align:center; color:var(--slate);">Bu davrda ma'lumot yo'q</td></tr>`;
    const totNet = totS - totE;
    return `<table><thead><tr><th>Sana</th><th>Savdo</th><th>Rasxod</th><th>Sof</th></tr></thead><tbody>${rows}</tbody><tfoot><tr style="font-weight:800;"><td>JAMI</td><td>${totS.toLocaleString()}</td><td style="color:var(--danger);">${totE.toLocaleString()}</td><td style="color:var(${totNet >= 0 ? '--success' : '--danger'});">${totNet.toLocaleString()} so'm</td></tr></tfoot></table>`;
}

function renderReports() {
    if (!currentUser) return;
    const myOwner = getTekshiruvchiOwnerPhone(currentUser);
    const branchScope = currentUser.role === 'tekshiruvchi' ? selectedBranchFilter : (currentUser.branchId || 'ALL');
    const k = document.getElementById('kassaReport');
    if (k) k.innerHTML = `<div class="table-container">${buildReport(kassaReportDays, myOwner, branchScope)}</div>`;
    const o = document.getElementById('ownerReport');
    if (o) o.innerHTML = `<div class="table-container">${buildReport(ownerReportDays, myOwner, branchScope)}</div>`;
}

function renderRoleHistory() {
    const container = document.getElementById('historyRoleView');
    if (!container || !currentUser) return;
    const today = todayStr();
    const myOwner = getTekshiruvchiOwnerPhone(currentUser);
    const branchScope = currentUser.role === 'tekshiruvchi' ? selectedBranchFilter : (currentUser.branchId || 'ALL');

    const pLogs = filterLogsByScope(productionLogs, myOwner, branchScope).filter(p => p.date === today);
    const sLogs = filterLogsByScope(salesLogs, myOwner, branchScope).filter(s => s.date === today);

    let html = `<div style="font-weight:800; color:var(--primary); margin-bottom:8px;">🥐 Chiqarish Tarixi (Bugun):</div>
    <div class="table-container" style="margin-bottom:16px;"><table><thead><tr><th>Vaqt</th><th>Filial</th><th>Somsachi</th><th>Turi</th><th>Holat</th><th>Soni</th></tr></thead><tbody>
    ${pLogs.length ? pLogs.map(p => `<tr><td>${esc(p.time)}</td><td>${esc(getBranchName(p.branchId))}</td><td>${esc(p.worker)}</td><td><b>${esc(p.somsaName)}</b></td><td>${esc(p.status)}</td><td><b>${p.qty} ta</b></td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--slate);">Yozuv yo'q</td></tr>`}
    </tbody></table></div>`;

    if (currentUser.role !== 'somsachi') {
        html += `<div style="font-weight:800; color:var(--primary); margin-bottom:8px;">💰 Sotuvlar Tarixi (Bugun):</div>
        <div class="table-container"><table><thead><tr><th>Vaqt</th><th>Filial</th><th>Sotuvchi</th><th>Mijoz</th><th>Tafsilot</th><th>Summa</th></tr></thead><tbody>
        ${sLogs.length ? sLogs.map(s => `<tr><td>${esc(s.time)}</td><td>${esc(getBranchName(s.branchId))}</td><td>${esc(s.seller)}</td><td>${esc(s.customer)}</td><td><small>${s.items.map(i => `${esc(i.name)}: ${i.qty}`).join(', ')}</small></td><td><b>${s.total.toLocaleString()} so'm</b></td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--slate);">Sotuv yo'q</td></tr>`}
        </tbody></table></div>`;
    }
    container.innerHTML = html;
}

function saveNewPassword() {
    const rawLogin = normalizeLogin(document.getElementById('forgotPhone').value);
    const newPass = document.getElementById('newPassword').value.trim();
    if (rawLogin.length < 3 || newPass.length < 4) { alert("Login va yangi parolni to'g'ri kiriting!"); return; }
    const user = users.find(u => sameLogin(u.phone, rawLogin));
    if (user && (user.role === 'sotuvchi' || user.role === 'somsachi')) {
        alert("Sotuvchi va Somsachi parolini o'z Tekshiruvchisi tiklab beradi.");
        return;
    }
    if (user) {
        auditRequests.unshift({ id: Date.now(), type: 'password', action: 'reset', phone: user.phone, newPassPlain: newPass, newPassHash: hashPass(newPass), requestedBy: user.name, reason: "Parolni unutdim", status: 'Kutilmoqda' });
        save('auditRequests', auditRequests);
    }
    closeModal('forgotModal');
    alert("✅ So'rov Bosh Adminga yuborildi!");
}

function renderAuditRequests() {
    const fill = (tableId, filterFn) => {
        const tbody = document.getElementById(tableId);
        if (!tbody) return;
        const pending = auditRequests.filter(r => r.status === 'Kutilmoqda' && filterFn(r));
        tbody.innerHTML = pending.length ? pending.map(r => `<tr>
            <td><b>${r.type === 'password' ? 'Parol tiklash' : esc(r.type)}</b></td>
            <td>${esc(r.requestedBy)}</td>
            <td>${r.type === 'password' ? `Login: ${esc(r.phone)}` : 'Yozuv tahriri'}</td>
            <td><i>${esc(r.reason)}</i></td>
            <td>
                <button class="btn-action-sm" style="background:var(--success); color:#fff;" onclick="approveAuditRequest(${r.id}, true)">✅</button>
                <button class="btn-action-sm" style="background:var(--danger); color:#fff;" onclick="approveAuditRequest(${r.id}, false)">❌</button>
            </td>
        </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--slate);">Yangi so'rovlar yo'q</td></tr>`;
    };
    fill('auditRequestsTable', r => r.type !== 'password');
    fill('adminAuditTable', r => r.type === 'password');
}

function approveAuditRequest(reqId, isApproved) {
    const req = auditRequests.find(r => r.id === reqId);
    if (!req) return;
    if (isApproved) {
        if (req.type === 'password') {
            const u = users.find(x => x.phone === req.phone);
            if (u) { u.passHash = req.newPassHash; if (req.newPassPlain) u.plainPass = req.newPassPlain; save('users', users); }
        } else if (req.type === 'production') {
            if (req.action === 'delete') productionLogs = productionLogs.filter(p => p.id !== req.targetId);
            else { const p = productionLogs.find(x => x.id === req.targetId); if (p && req.newQty > 0) { p.qty = req.newQty; p.workerFee = p.status === 'Brak' ? 0 : p.qty * WORKER_RATE; } }
            save('productionLogs', productionLogs);
        } else if (req.type === 'expense') {
            expenseLogs = expenseLogs.filter(e => e.id !== req.targetId);
            save('expenseLogs', expenseLogs);
        }
        req.status = 'Tasdiqlandi';
    } else {
        req.status = 'Rad etildi';
    }
    save('auditRequests', auditRequests);
    refreshAllUI();
}

function openEditModal(type, id, action) {
    document.getElementById('editItemType').value = type;
    document.getElementById('editItemId').value = id;
    document.getElementById('editItemAction').value = action;
    document.getElementById('editReasonInput').value = '';
    document.getElementById('editQtyGroup').style.display = (action === 'edit' && type === 'production') ? 'block' : 'none';
    if (action === 'edit' && type === 'production') {
        const log = productionLogs.find(p => p.id === id);
        if (log) document.getElementById('editQtyInput').value = log.qty;
    }
    openModal('editModal');
}

function submitEditRequest() {
    const type = document.getElementById('editItemType').value;
    const id = parseInt(document.getElementById('editItemId').value);
    const action = document.getElementById('editItemAction').value;
    const reason = document.getElementById('editReasonInput').value.trim();
    if (!reason) { alert("Sababini kiriting!"); return; }
    const req = { id: Date.now(), type, action, targetId: id, requestedBy: currentUser ? currentUser.name : "Xodim", reason, status: 'Kutilmoqda' };
    if (action === 'edit' && type === 'production') req.newQty = parseInt(document.getElementById('editQtyInput').value);
    auditRequests.unshift(req);
    save('auditRequests', auditRequests);
    closeModal('editModal');
    alert("✅ So'rov Tekshiruvchiga yuborildi!");
}

function saveCrmExpenses() {
    crmExpensesVal = parseInt(document.getElementById('crmExpenseInput').value) || 0;
    localStorage.setItem('crmExpensesVal', crmExpensesVal);
    renderOwnerDashboard();
    alert("✅ Xarajat saqlandi!");
}

function changeOwnPassword() {
    if (!currentUser) return;
    const oldP = document.getElementById('oldPassInput').value;
    const newP = document.getElementById('newPassInput').value.trim();
    if (hashPass(oldP) !== currentUser.passHash) { alert("Joriy parol noto'g'ri!"); return; }
    if (newP.length < 4) { alert("Yangi parol kamida 4 belgi bo'lsin!"); return; }
    const u = users.find(x => x.phone === currentUser.phone);
    if (u) { u.passHash = hashPass(newP); u.plainPass = newP; currentUser = u; }
    save('users', users);
    document.getElementById('oldPassInput').value = '';
    document.getElementById('newPassInput').value = '';
    alert("✅ Parol o'zgartirildi!");
}

function renderPrices() {
    const div = document.getElementById('priceSettings');
    if (!div) return;
    div.innerHTML = somsaTypes.map(s => `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span style="font-weight:700; font-size:12px;">${esc(s.name)}</span><input type="number" id="price_input_${s.id}" class="form-control" style="width:110px;" value="${s.price}" min="1"></div>`).join('');
    const wr = document.getElementById('workerRateInput');
    if (wr && document.activeElement !== wr) wr.value = WORKER_RATE;
}

function addSomsaType() {
    const name = document.getElementById('newSomsaName').value.trim();
    const price = parseInt(document.getElementById('newSomsaPrice').value);
    if (!name || !price || price <= 0) { alert("Somsa nomi va narxini kiriting!"); return; }
    const id = somsaTypes.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    somsaTypes.push({ id, name, price });
    save('somsaTypes', somsaTypes);
    document.getElementById('newSomsaName').value = '';
    document.getElementById('newSomsaPrice').value = '';
    refreshAllUI();
}

function savePrices() {
    somsaTypes.forEach(s => {
        const inp = document.getElementById(`price_input_${s.id}`);
        const val = inp ? parseInt(inp.value) : 0;
        if (val && val > 0) s.price = val;
    });
    const rate = parseInt(document.getElementById('workerRateInput').value);
    if (!isNaN(rate) && rate >= 0) { WORKER_RATE = rate; localStorage.setItem('workerRate', rate); }
    save('somsaTypes', somsaTypes);
    refreshAllUI();
    alert("✅ Narxlar yangilandi!");
}

function saveCardNumber() {
    const digits = onlyDigits(document.getElementById('cardNumberInput').value.trim());
    if (digits && digits.length !== 16) { alert("16 ta raqam kiriting!"); return; }
    cardNumber = digits ? digits.replace(/(\d{4})(?=\d)/g, '$1 ') : '';
    localStorage.setItem('cardNumber', cardNumber);
    alert("✅ Karta saqlandi!");
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#mainNav button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const btn = Array.from(document.querySelectorAll('#mainNav button')).find(b => (b.getAttribute('onclick') || '').includes("'" + tabId + "'"));
    if (btn) btn.classList.add('active');
    // Oxirgi ochiq bo'limni eslab qolish (sahifa yangilanganda tiklanadi)
    try { if (currentUser) localStorage.setItem('lastTab', tabId); } catch (e) {}
    closeDrawer();
    window.scrollTo({ top: 0 });
}

function refreshAllUI() {
    renderGlobalSmsAlerts();
    renderSomsaButtons();
    renderPrices();
    renderWorkerPersonalStats();
    renderWorkerTypeSummary();
    renderWorkerTodayTable();
    renderBalanceTable();
    renderAuditRequests();
    renderAdminNotifications();
    renderSubPaymentPanel();
    renderBranchesList();
    renderOwnerDashboard();
    renderExpenses();
    renderReports();
    renderRoleHistory();
    renderUsers();

    const ci = document.getElementById('cardNumberInput');
    if (ci && document.activeElement !== ci) ci.value = cardNumber;
    const cei = document.getElementById('crmExpenseInput');
    if (cei && document.activeElement !== cei) cei.value = crmExpensesVal;
    const sp = document.getElementById('adminSubPriceInput');
    if (sp && document.activeElement !== sp) sp.value = appSubSettings.price;
    const sc = document.getElementById('adminSubCardInput');
    if (sc && document.activeElement !== sc) sc.value = appSubSettings.cardNumber;
    const so = document.getElementById('adminSubOwnerInput');
    if (so && document.activeElement !== so) so.value = appSubSettings.cardOwner;
}

window.onload = function() {
    document.getElementById('fontSizeSelect').value = savedFontSize;
    selectLoginRole('sotuvchi');
    renderCart();
    restoreSession();
};
