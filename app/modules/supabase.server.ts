import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL=import.meta.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY=import.meta.env.SUPABASE_SERVICE_ROLE_KEY


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export { supabase }