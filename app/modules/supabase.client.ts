import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL="https://brysfoqwgflysjyvymlz.supabase.co"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyeXNmb3F3Z2ZseXNqeXZ5bWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTExMDg2MzQsImV4cCI6MjAyNjY4NDYzNH0.eW2quj-T8UyHyaBhJm3FPCqZl10LHPoViAEVTkRaKHA"

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Supabase Anon Key is missing.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase }