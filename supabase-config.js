const SUPABASE_URL = 'https://ccnhpixvvicwqcagypuk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sDu66QZkAPBYTWMS28muoQ_8x0wYGA3';

const supabaseClient = (SUPABASE_URL.startsWith('https'))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabaseClient) {
  console.warn('[Education Hub] Supabase not configured.');
}
