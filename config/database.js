import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("DIQQAT: SUPABASE_URL yoki SUPABASE_KEY .env faylida topilmadi!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
