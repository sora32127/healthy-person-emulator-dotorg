import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Supabase Anon Key is missing.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase }