import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Surfaced on the login screen instead of failing with an opaque network error. */
export const configError =
  !url || !anonKey
    ? '缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，请检查 .env.local 或 GitHub Actions secrets。'
    : null;

export const supabase = createClient(url ?? 'http://invalid.local', anonKey ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Password sign-in never round-trips through the URL, and the hash router
    // owns the fragment. Nothing should be parsed out of it.
    detectSessionInUrl: false
  }
});
