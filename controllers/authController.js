import { supabase } from '../config/database.js';

export async function loginUser(req, res) {
  try {
    const { phone, passHash } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('pass_hash', passHash)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: "Login yoki parol xato!" });
    }

    if (data.frozen) {
      return res.status(403).json({ error: "Hisob muzlatilgan!" });
    }

    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function registerUser(req, res) {
  try {
    const userData = req.body;
    const { data, error } = await supabase.from('users').insert([userData]).select();
    if (error) throw error;
    res.json({ success: true, user: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
