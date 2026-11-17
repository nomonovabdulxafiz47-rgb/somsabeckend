import express from 'express';
import { loginUser, registerUser } from '../controllers/authController.js';
import { getAppData } from '../controllers/dbController.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', registerUser);
router.get('/data', getAppData);

export default router;
