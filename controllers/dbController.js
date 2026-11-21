import bcrypt from 'bcryptjs';
import { supabase } from '../config/database.js';

const DAY = 86400000;
const TZ = 'Asia/Tashkent';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const daysAgo = n => new Date(Date.now() - n * DAY).toLocaleDateString('en-CA', { timeZone: TZ });
const nowTime = () => new Date().toLocaleTimeString('en-GB', { timeZone: TZ });
const stripHash = ({ pass_hash, ...rest }) => rest;
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const fail = (res, err) => { console.error(err); res.status(500).json({ error: 'Server xatosi' }); };
const isTek = me => me.role === 'tekshiruvchi' && !me.isSuperAdmin;

const DEFAULT_TYPES = [
  ["Mol go'shtli", 10000], ["Qo'y go'shtli", 12000], ["Avashnoy", 6000],
  ["Qiyma", 8000], ["Kartoshkali", 5000], ["Qovoqli", 5000], ["Tovuqli", 8000]
].map(([name, price]) => ({ name, price }));

async function ensureTypes(owner) {
  const { data } = await supabase.from('somsa_types').select('*').eq('owner_login', owner).order('id');
  if (data?.length) return data;
  const { data: ins } = await supabase.from('somsa_types')
    .insert(DEFAULT_TYPES.map(t => ({ ...t, owner_login: owner }))).select().order('id');
  return ins || [];
}

async function ensureSettings(owner) {
  const { data } = await supabase.from('owner_settings').select('*').eq('owner_login', owner).maybeSingle();
  if (data) return data;
  const { data: ins } = await supabase.from('owner_settings').insert([{ owner_login: owner }]).select().single();
  return ins;
}

// ================= MA'LUMOTLARNI OLISH (rolga qarab filtrlanadi) =================
export async function getAppData(req, res) {
  try {
    const me = req.user;
    const since = daysAgo(35);
    const { data: appSettings } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();

    if (me.isSuperAdmin) {
      const [teks, allUsers, brs, hist, orders] = await Promise.all([
        supabase.from('users').select('*').eq('role', 'tekshiruvchi').eq('is_super_admin', false),
        supabase.from('users').select('role'),
        supabase.from('branches').select('id, owner_login'),
        supabase.from('sub_payment_history').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('sales_logs').select('id', { count: 'exact', head: true })
      ]);
      return res.json({
        role: 'superadmin',
        tekshiruvchilar: (teks.data || []).map(stripHash),
        branchesCount: (brs.data || []).length,
        branchCountByOwner: (brs.data || []).reduce((m, b) => (m[b.owner_login] = (m[b.owner_login] || 0) + 1, m), {}),
        userCounts: (allUsers.data || []).reduce((m, u) => (m[u.role] = (m[u.role] || 0) + 1, m), {}),
        ordersCount: orders.count || 0,
        subPaymentHistory: hist.data || [],
        appSettings
      });
    }

    const owner = me.owner;
    const branchScope = isTek(me) ? null : me.branchId;
    const scoped = q => {
      q = q.eq('owner_login', owner);
      return branchScope ? q.eq('branch_id', branchScope) : q;
    };

    const [somsaTypes, settings, branches, prod, sales, exp, audit, staff, meRow] = await Promise.all([
      ensureTypes(owner),
      ensureSettings(owner),
      isTek(me)
        ? supabase.from('branches').select('*').eq('owner_login', owner)
        : supabase.from('branches').select('*').eq('id', me.branchId),
      scoped(supabase.from('production_logs').select('*').gte('date', since)).order('id', { ascending: false }).limit(5000),
      scoped(supabase.from('sales_logs').select('*').gte('date', since)).order('id', { ascending: false }).limit(5000),
      scoped(supabase.from('expense_logs').select('*').gte('date', since)).order('id', { ascending: false }).limit(5000),
      isTek(me)
        ? supabase.from('audit_requests').select('*').eq('owner_login', owner).eq('status', 'Kutilmoqda')
        : supabase.from('audit_requests').select('*').eq('owner_login', owner).eq('requested_by', me.login),
      isTek(me) ? supabase.from('users').select('*').eq('owner_login', owner) : { data: [] },
      supabase.from('users').select('*').eq('login', me.login).single()
    ]);

    res.json({
      role: me.role,
      me: stripHash(meRow.data),
      branches: branches.data || [],
      somsaTypes,
      settings: isTek(me) ? settings : { worker_rate: settings.worker_rate, card_number: settings.card_number },
      productionLogs: prod.data || [],
      salesLogs: sales.data || [],
      expenseLogs: exp.data || [],
      auditRequests: audit.data || [],
      staff: (staff.data || []).map(stripHash),
      appSettings: isTek(me) ? appSettings : undefined
    });
  } catch (err) { fail(res, err); }
}

// ================= SOMSACHI: CHIQARISH =================
export async function addProduction(req, res) {
  try {
    const me = req.user;
    if (me.role !== 'somsachi') return bad(res, "Faqat Somsachi", 403);
    const qty = parseInt(req.body.qty);
    const status = req.body.status;
    if (!['Chiqdi', 'Brak', 'Asarti'].includes(status)) return bad(res, "Holat noto'g'ri");
    if (!(qty > 0 && qty <= 10000)) return bad(res, "Miqdor noto'g'ri");

    const { data: type } = await supabase.from('somsa_types').select('*')
      .eq('id', req.body.somsaId).eq('owner_login', me.owner).maybeSingle();
    if (!type) return bad(res, "Somsa turi topilmadi");

    const settings = await ensureSettings(me.owner);
    const { data, error } = await supabase.from('production_logs').insert([{
      owner_login: me.owner, branch_id: me.branchId, worker_login: me.login,
      date: today(), time: nowTime(), status,
      somsa_id: type.id, somsa_name: type.name, qty, price: type.price,
      worker_fee: status === 'Brak' ? 0 : qty * settings.worker_rate
    }]).select().single();
    if (error) throw error;
    res.json({ success: true, log: data });
  } catch (err) { fail(res, err); }
}

// ================= SOTUVCHI: SAVDO =================
export async function addSale(req, res) {
  try {
    const me = req.user;
    if (me.role !== 'sotuvchi') return bad(res, "Faqat Sotuvchi", 403);
    const payType = req.body.paymentType === 'Karta' ? 'Karta' : 'Naqd';
    const wanted = Array.isArray(req.body.items) ? req.body.items : [];
    if (!wanted.length) return bad(res, "Savat bo'sh");

    const types = await ensureTypes(me.owner);
    const d = today();
    const [prod, sold] = await Promise.all([
      supabase.from('production_logs').select('somsa_id, qty').eq('branch_id', me.branchId).eq('date', d).neq('status', 'Brak'),
      supabase.from('sales_logs').select('items').eq('branch_id', me.branchId).eq('date', d)
    ]);
    const remain = {};
    (prod.data || []).forEach(p => remain[p.somsa_id] = (remain[p.somsa_id] || 0) + p.qty);
    (sold.data || []).forEach(s => s.items.forEach(i => remain[i.id] = (remain[i.id] || 0) - i.qty));

    const items = [];
    for (const w of wanted) {
      const qty = parseInt(w.qty);
      const t = types.find(x => x.id === Number(w.id));
      if (!t || !(qty > 0)) return bad(res, "Savatda noto'g'ri mahsulot bor");
      if (qty > (remain[t.id] || 0)) return bad(res, `"${t.name}" qoldig'i yetarli emas! Qoldi: ${remain[t.id] || 0} ta`);
      items.push({ id: t.id, name: t.name, price: t.price, qty });
    }

    const total = items.reduce((s, i) => s + i.qty * i.price, 0);
    const { data, error } = await supabase.from('sales_logs').insert([{
      owner_login: me.owner, branch_id: me.branchId, seller_login: me.login,
      date: d, time: nowTime(),
      customer: String(req.body.customer || '').trim().slice(0, 40) || null,
      payment_type: payType, items, total
    }]).select().single();
    if (error) throw error;
    res.json({ success: true, sale: data });
  } catch (err) { fail(res, err); }
}

export async function addExpense(req, res) {
  try {
    const me = req.user;
    if (me.role !== 'sotuvchi') return bad(res, "Faqat Sotuvchi", 403);
    const title = String(req.body.title || '').trim().slice(0, 60);
    const amount = parseInt(req.body.amount);
    if (!title || !(amount > 0)) return bad(res, "Rasxod nomi va summasini kiriting");
    const { data, error } = await supabase.from('expense_logs').insert([{
      owner_login: me.owner, branch_id: me.branchId, seller_login: me.login,
      date: today(), time: nowTime(), title, amount
    }]).select().single();
    if (error) throw error;
    res.json({ success: true, expense: data });
  } catch (err) { fail(res, err); }
}

// ================= TEKSHIRUVCHI: FILIAL, NARX, SOZLAMA =================
export async function createBranch(req, res) {
  let branchId = null;
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const { name, address, baker, seller } = req.body;
    if (!String(name || '').trim()) return bad(res, "Filial nomini kiriting");

    const valid = p => p && String(p.name || '').trim() &&
      /^[A-Za-z0-9_.\-]{3,30}$/.test(String(p.login || '').trim()) && String(p.password || '').length >= 4;
    if (!valid(baker) || !valid(seller)) return bad(res, "Xodim ismi, logini (3-30 belgi) va paroli (kamida 4) to'g'ri bo'lsin");
    const bl = baker.login.trim().toLowerCase(), sl = seller.login.trim().toLowerCase();
    if (bl === sl) return bad(res, "Loginlar bir xil bo'lmasin");

    branchId = 'br_' + Date.now();
    const { error: e1 } = await supabase.from('branches').insert([{
      id: branchId, owner_login: me.login, name: name.trim(), address: String(address || '').trim()
    }]);
    if (e1) throw e1;

    const mk = async (p, login, role) => ({
      login, name: p.name.trim(), pass_hash: await bcrypt.hash(p.password, 10),
      role, owner_login: me.login, branch_id: branchId, sub_status: 'free'
    });
    const { error: e2 } = await supabase.from('users').insert([
      await mk(baker, bl, 'somsachi'), await mk(seller, sl, 'sotuvchi')
    ]);
    if (e2) {
      await supabase.from('branches').delete().eq('id', branchId); // orqaga qaytarish
      if (e2.code === '23505') return bad(res, "Loginlardan biri band!", 409);
      throw e2;
    }
    res.json({ success: true, branchId });
  } catch (err) { fail(res, err); }
}

export async function deleteBranch(req, res) {
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const id = req.params.id;
    const { data: br } = await supabase.from('branches').select('id').eq('id', id).eq('owner_login', me.login).maybeSingle();
    if (!br) return bad(res, "Filial topilmadi", 404);
    await supabase.from('users').delete().eq('branch_id', id);
    await supabase.from('branches').delete().eq('id', id);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

export async function savePrices(req, res) {
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const { types = [], workerRate, cardNumber } = req.body;
    for (const t of types) {
      const price = parseInt(t.price);
      if (price > 0) await supabase.from('somsa_types').update({ price }).eq('id', t.id).eq('owner_login', me.login);
    }
    const upd = {};
    if (Number.isInteger(workerRate) && workerRate >= 0) upd.worker_rate = workerRate;
    if (cardNumber !== undefined) {
      const digits = String(cardNumber).replace(/\D/g, '');
      if (digits && digits.length !== 16) return bad(res, "Karta 16 ta raqam bo'lsin");
      upd.card_number = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    }
    if (Object.keys(upd).length) await supabase.from('owner_settings').update(upd).eq('owner_login', me.login);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

export async function addSomsaType(req, res) {
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const name = String(req.body.name || '').trim().slice(0, 30);
    const price = parseInt(req.body.price);
    if (!name || !(price > 0)) return bad(res, "Nom va narxni kiriting");
    const { data, error } = await supabase.from('somsa_types').insert([{ owner_login: me.login, name, price }]).select().single();
    if (error) throw error;
    res.json({ success: true, type: data });
  } catch (err) { fail(res, err); }
}

export async function setStaffPassword(req, res) {
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const password = String(req.body.password || '');
    if (password.length < 4) return bad(res, "Parol kamida 4 belgi");
    const { data, error } = await supabase.from('users')
      .update({ pass_hash: await bcrypt.hash(password, 10) })
      .eq('login', req.params.login).eq('owner_login', me.login).select('login');
    if (error) throw error;
    if (!data?.length) return bad(res, "Xodim topilmadi", 404);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

// ================= TAHRIR / O'CHIRISH SO'ROVLARI =================
export async function createAudit(req, res) {
  try {
    const me = req.user;
    if (!['somsachi', 'sotuvchi'].includes(me.role)) return bad(res, "Ruxsat yo'q", 403);
    const { type, action, targetId, newQty, reason } = req.body;
    if (!['production', 'expense'].includes(type) || !['edit', 'delete'].includes(action)) return bad(res, "So'rov noto'g'ri");
    if (!String(reason || '').trim()) return bad(res, "Sababini kiriting");
    const table = type === 'production' ? 'production_logs' : 'expense_logs';
    const { data: target } = await supabase.from(table).select('id').eq('id', targetId).eq('branch_id', me.branchId).maybeSingle();
    if (!target) return bad(res, "Yozuv topilmadi", 404);
    const { error } = await supabase.from('audit_requests').insert([{
      owner_login: me.owner, requested_by: me.login, type, action, target_id: targetId,
      new_qty: action === 'edit' ? parseInt(newQty) : null, reason: String(reason).trim().slice(0, 120), status: 'Kutilmoqda'
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

export async function resolveAudit(req, res) {
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const { data: r } = await supabase.from('audit_requests').select('*')
      .eq('id', req.params.id).eq('owner_login', me.login).eq('status', 'Kutilmoqda').maybeSingle();
    if (!r) return bad(res, "So'rov topilmadi", 404);

    if (req.body.approve) {
      const table = r.type === 'production' ? 'production_logs' : 'expense_logs';
      if (r.action === 'delete') {
        await supabase.from(table).delete().eq('id', r.target_id).eq('owner_login', me.login);
      } else if (r.type === 'production' && r.new_qty > 0) {
        const { data: log } = await supabase.from(table).select('*').eq('id', r.target_id).eq('owner_login', me.login).maybeSingle();
        if (log) {
          const s = await ensureSettings(me.login);
          await supabase.from(table).update({
            qty: r.new_qty, worker_fee: log.status === 'Brak' ? 0 : r.new_qty * s.worker_rate
          }).eq('id', log.id);
        }
      }
    }
    await supabase.from('audit_requests').update({ status: req.body.approve ? 'Tasdiqlandi' : 'Rad etildi' }).eq('id', r.id);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

// ================= OBUNA =================
export async function reportPayment(req, res) {
  try {
    const me = req.user;
    if (!isTek(me)) return bad(res, "Faqat Tekshiruvchi", 403);
    const { data: u } = await supabase.from('users').select('sub_status').eq('login', me.login).single();
    if (u.sub_status === 'free') return bad(res, "Siz to'lovdan ozodsiz");
    await supabase.from('users').update({ pay_reported: true }).eq('login', me.login); // sub_status tegilmaydi
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

export async function approvePayment(req, res) {
  try {
    const { data: u } = await supabase.from('users').select('*')
      .eq('login', req.params.login).eq('role', 'tekshiruvchi').eq('is_super_admin', false).maybeSingle();
    if (!u) return bad(res, "Tekshiruvchi topilmadi", 404);
    const { data: s } = await supabase.from('app_settings').select('price').eq('id', 1).maybeSingle();
    const now = Date.now();
    const cur = u.sub_expires_at ? new Date(u.sub_expires_at).getTime() : 0;
    const expires = new Date(Math.max(now, cur) + 30 * DAY); // erta to'lagan kunlar kuymaydi
    await supabase.from('users').update({
      sub_status: '1month', sub_approved_at: new Date(now), sub_expires_at: expires, pay_reported: false, frozen: false
    }).eq('login', u.login);
    await supabase.from('sub_payment_history').insert([{
      login: u.login, name: u.name, amount: s?.price || 10000, expires_at: expires
    }]);
    res.json({ success: true, expiresAt: expires });
  } catch (err) { fail(res, err); }
}

export async function toggleFreeze(req, res) {
  try {
    const { data: u } = await supabase.from('users').select('frozen').eq('login', req.params.login).eq('is_super_admin', false).maybeSingle();
    if (!u) return bad(res, "Topilmadi", 404);
    await supabase.from('users').update({ frozen: !u.frozen }).eq('login', req.params.login);
    res.json({ success: true, frozen: !u.frozen });
  } catch (err) { fail(res, err); }
}

export async function deleteTekshiruvchi(req, res) {
  try {
    // users.owner_login ON DELETE CASCADE: xodimlar, filiallar va loglar ham o'chadi
    await supabase.from('users').delete().eq('login', req.params.login).eq('is_super_admin', false);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}

export async function saveAppSettings(req, res) {
  try {
    const price = parseInt(req.body.price) || 0;
    const digits = String(req.body.cardNumber || '').replace(/\D/g, '');
    const owner = String(req.body.cardOwner || '').trim();
    if (digits.length !== 16 || !owner) return bad(res, "Karta (16 raqam) va egasi kerak");
    await supabase.from('app_settings').upsert({
      id: 1, price, card_number: digits.replace(/(\d{4})(?=\d)/g, '$1 '), card_owner: owner
    });
    res.json({ success: true });
  } catch (err) { fail(res, err); }
}
