export function verifyAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: "Token topilmadi, ruxsat yo'q!" });
  }
  // Oddiy tekshiruv yoki JWT implementatsiyasi shu yerda bajariladi
  next();
}
