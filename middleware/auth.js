import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Kirish kerak" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Sessiya tugagan, qayta kiring" });
  }
}

export const requireSuperAdmin = (req, res, next) =>
  req.user?.isSuperAdmin ? next() : res.status(403).json({ error: "Faqat Bosh Admin" });

// Eski nom ham ishlashi uchun (boshqa joyda verifyAuth import qilingan bo'lsa)
export const verifyAuth = requireAuth;
