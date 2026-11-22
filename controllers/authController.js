import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET o\'zgaruvchisi topilmadi! Render > Environment bo\'limiga qo\'shing.');

const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72; // bcrypt faqat birinchi 72 baytni hisobga oladi

const normLogin = s => String(s ?? '').trim().toLowerCase();
const validLogin = s => /^[a-z0-9_.\-]{3,30}$/.test(s);

function safeUser(u) {
  const { pass_hash, ...rest } = u;
  return rest;
}

function subActive(u) {
  if (u.is_super_admin || u.role !== 'tekshiruvchi') return true;
  if (u.frozen) return false;
  if (u.sub_status === 'free') return true;
  if (u.sub_status === '1month' && u.sub_expires_at)
    return Date.now() < new Date(u.sub_expires_at).getTime();
  return false;
}

// Foydalanuvchi topilmaganda ham bcrypt vaqti sarflansin (login mavjudligini bildirmaslik uchun)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export async function loginUser(req, res) {
  try {
    const login = normLogin(req.body?.login);
    const password = String(req.body?.password ?? '');
    const role = req.body?.role;

    if (!login || !password || password.length > MAX_PASSWORD)
      return res.status(401).json({ error: "Login yoki parol xato!" });

    const { data: user, error: dbErr } = await supabase
      .from('users').select('*').eq('login', login).maybeSingle();
    if (dbErr) throw dbErr;

    const ok = await bcrypt.compare(password, user?.pass_hash || DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Login yoki parol xato!" });

    if (!user.is_super_admin && user.role !== role)
      return res.status(403).json({ error: `Bu hisob "${user.role}" lavozimiga tegishli.` });
    if (user.frozen) return res.status(403).json({ error: "Hisob muzlatilgan!" });
    if (user.blocked) return res.status(403).json({ error: "Hisob bloklangan!" });

    if (user.owner_login) {
      const { data: owner, error: ownerErr } = await supabase
        .from('users').select('frozen').eq('login', user.owner_login).maybeSingle();
      if (ownerErr) throw ownerErr;
      if (owner?.frozen)
        return res.status(403).json({ error: "Filial egasining hisobi muzlatilgan!" });
    }

    const token = jwt.sign({
      login: user.login,
      role: user.role,
      isSuperAdmin: !!user.is_super_admin,
      owner: user.role === 'tekshiruvchi' ? user.login : user.owner_login,
      branchId: user.branch_id || null
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { ...safeUser(user), sub_active: subActive(user) }
    });
  } catch (err) {
    console.error('loginUser xatosi:', err);
    res.status(500).json({ error: "Server xatosi" });
  }
}

// Faqat tizimga kirgan foydalanuvchi chaqira oladi (requireAuth bilan)
export async function registerUser(req, res) {
  try {
    const me = req.user;
    if (!me) return res.status(401).json({ error: "Avval tizimga kiring!" });

    const name = String(req.body?.name ?? '').trim();
    const login = normLogin(req.body?.login);
    const password = String(req.body?.password ?? '');
    const role = req.body?.role;

    if (!name || name.length > 60)
      return res.status(400).json({ error: "Ismni to'g'ri kiriting (1-60 belgi)!" });
    if (!validLogin(login))
      return res.status(400).json({ error: "Login 3-30 belgi bo'lsin (a-z, 0-9, _ . -)!" });
    if (password.length < MIN_PASSWORD)
      return res.status(400).json({ error: `Parol kamida ${MIN_PASSWORD} belgi bo'lsin!` });
    if (password.length > MAX_PASSWORD)
      return res.status(400).json({ error: `Parol ko'pi bilan ${MAX_PASSWORD} belgi bo'lsin!` });

    const row = { login, name, pass_hash: await bcrypt.hash(password, 10), role };

    if (me.isSuperAdmin) {
      if (role !== 'tekshiruvchi')
        return res.status(403).json({ error: "Bosh Admin faqat Tekshiruvchi yaratadi" });
      row.sub_status = 'unpaid';
    } else if (me.role === 'tekshiruvchi') {
      if (!['sotuvchi', 'somsachi'].includes(role))
        return res.status(403).json({ error: "Faqat Sotuvchi yoki Somsachi qo'sha olasiz" });

      const branchId = req.body?.branchId;
      if (!branchId) return res.status(400).json({ error: "Filialni tanlang!" });

      const { data: br, error: brErr } = await supabase.from('branches').select('id')
        .eq('id', branchId).eq('owner_login', me.login).maybeSingle();
      if (brErr) throw brErr;
      if (!br) return res.status(400).json({ error: "Bunday filial sizda yo'q" });

      row.owner_login = me.login;
      row.branch_id = br.id;
      row.sub_status = 'free';
    } else {
      return res.status(403).json({ error: "Ruxsat yo'q" });
    }

    const { data, error } = await supabase.from('users').insert([row]).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: "Bu login band!" });
      throw error;
    }
    res.json({ success: true, user: safeUser(data) });
  } catch (err) {
    console.error('registerUser xatosi:', err);
    res.status(500).json({ error: "Server xatosi" });
  }
}
