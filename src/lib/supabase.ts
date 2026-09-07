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
    detectSessionInUrl: true,
    // PKCE returns the magic-link result as a ?code= query parameter. The
    // implicit flow would put it in the URL fragment, which is exactly where
    // our hash router lives.
    flowType: 'pkce'
  }
});

/** Where Supabase should send the user back after a magic link. */
export function redirectTo(): string {
  return location.origin + location.pathname;
}
