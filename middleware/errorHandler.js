export function notFound(req, res) {
  res.status(404).json({ error: "Manzil topilmadi" });
}

export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err.stack || err);

  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: "So'rov formati noto'g'ri" });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: "So'rov hajmi juda katta" });
  }

  res.status(err.status || 500).json({ error: "Serverda xatolik yuz berdi!" });
}
