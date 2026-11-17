import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // public papkasi ichidagi index.html uchun

// API marshrutlari
app.use('/api', apiRoutes);

// Xatoliklarni ushlash middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi!`);
});
