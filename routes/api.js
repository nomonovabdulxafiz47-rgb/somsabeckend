import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { loginUser, registerUser } from '../controllers/authController.js';
import * as db from '../controllers/dbController.js';

const r = Router();
r.post('/auth/login', loginUser);                         // faqat shu ochiq
r.post('/auth/register', requireAuth, registerUser);

r.use(requireAuth);                                       // pastdagilar hammasi tokenni talab qiladi
r.get('/data', db.getAppData);
r.post('/production', db.addProduction);
r.post('/sales', db.addSale);
r.post('/expenses', db.addExpense);
r.post('/branches', db.createBranch);
r.delete('/branches/:id', db.deleteBranch);
r.post('/prices', db.savePrices);
r.post('/somsa-types', db.addSomsaType);
r.post('/staff/:login/password', db.setStaffPassword);
r.post('/audit', db.createAudit);
r.post('/audit/:id/resolve', db.resolveAudit);
r.post('/subscription/report', db.reportPayment);

r.post('/admin/tek/:login/approve', requireSuperAdmin, db.approvePayment);
r.post('/admin/tek/:login/freeze', requireSuperAdmin, db.toggleFreeze);
r.delete('/admin/tek/:login', requireSuperAdmin, db.deleteTekshiruvchi);
r.post('/admin/settings', requireSuperAdmin, db.saveAppSettings);

export default r;
