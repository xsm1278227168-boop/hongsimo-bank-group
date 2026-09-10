import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

class SessionStore {
  /** False until the persisted session is resolved. */
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

  /** Throws on failure; `user` is updated through onAuthStateChange on success. */
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut() {
    await supabase.auth.signOut();
  }
}

export const session = new SessionStore();
