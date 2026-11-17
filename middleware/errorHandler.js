export function errorHandler(err, req, res, next) {
  console.error("Xatolik yuz berdi:", err.stack);
  res.status(500).json({ error: "Serverda xatolik yuz berdi!", details: err.message });
}
