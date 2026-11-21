import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." }
}));

app.use('/api', apiRoutes);
app.use('/api', notFound);
app.use(express.static(path.join(__dirname, 'public')));
app.use(errorHandler);

process.on('unhandledRejection', e => console.error('unhandledRejection:', e));
process.on('uncaughtException', e => console.error('uncaughtException:', e));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ${PORT}-portda ishga tushdi!`);
});
