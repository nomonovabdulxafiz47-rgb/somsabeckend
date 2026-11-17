import { supabase } from '../config/database.js';

// Umumiy ma'lumotlarni olish (Filiallar, Somsa turlari, Loglar)
export async function getAppData(req, res) {
  try {
    const [branches, somsaTypes, productionLogs, salesLogs, expenseLogs, auditRequests, subHistory, users] = await Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('somsa_types').select('*'),
      supabase.from('production_logs').select('*'),
      supabase.from('sales_logs').select('*'),
      supabase.from('expense_logs').select('*'),
      supabase.from('audit_requests').select('*'),
      supabase.from('sub_payment_history').select('*'),
      supabase.from('users').select('*')
    ]);

    res.json({
      branches: branches.data || [],
      somsaTypes: somsaTypes.data || [],
      productionLogs: productionLogs.data || [],
      salesLogs: salesLogs.data || [],
      expenseLogs: expenseLogs.data || [],
      auditRequests: auditRequests.data || [],
      subPaymentHistory: subHistory.data || [],
      users: users.data || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Yangi ishlab chiqarish yoki savdo qo'shish uchun umumiy metodlar ham shu yerga yoziladi.
