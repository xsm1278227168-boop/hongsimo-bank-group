import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

class SessionStore {
  /** False until the persisted session (or the magic-link ?code=) is resolved. */
  ready = $state(false);
  user = $state<User | null>(null);

  async init() {
    const { data } = await supabase.auth.getSession();
    this.user = data.session?.user ?? null;
    this.ready = true;

    supabase.auth.onAuthStateChange((_event, sess) => {
      this.user = sess?.user ?? null;
    });
  }

  get userId(): string | null {
    return this.user?.id ?? null;
  }

  async signOut() {
    await supabase.auth.signOut();
  }
}

export const session = new SessionStore();
