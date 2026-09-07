import { supabase } from './supabase';
import { session } from './session.svelte';
import type { Category, Household, Member, UUID } from './types';

class HouseholdStore {
  /** False until the first load settles, so the shell never flashes onboarding. */
  loaded = $state(false);
  household = $state<Household | null>(null);
  members = $state<Member[]>([]);
  categories = $state<Category[]>([]);

  get me(): Member | null {
    const uid = session.userId;
    return this.members.find((m) => m.user_id === uid) ?? null;
  }

  get partner(): Member | null {
    const uid = session.userId;
    return this.members.find((m) => m.user_id !== uid) ?? null;
  }

  get currency(): string {
    return this.household?.currency ?? 'CNY';
  }

  get activeCategories(): Category[] {
    return this.categories.filter((c) => !c.archived);
  }

  nameOf(userId: UUID | null | undefined): string {
    if (!userId) return '—';
    return this.members.find((m) => m.user_id === userId)?.display_name ?? '（已退出）';
  }

  /**
   * Every table is scoped by RLS to the caller's household, so no filters are
   * needed here: an empty households result means "not in a household yet".
   */
  async load() {
    if (!session.userId) {
      this.reset();
      this.loaded = true;
      return;
    }

    const [hh, mem, cat] = await Promise.all([
      supabase.from('households').select('*').limit(1),
      supabase.from('members').select('*'),
      supabase.from('categories').select('*').order('sort_order').order('name')
    ]);

    const err = hh.error ?? mem.error ?? cat.error;
    if (err) {
      this.loaded = true;
      throw err;
    }

    this.household = (hh.data?.[0] as Household) ?? null;
    this.members = (mem.data as Member[]) ?? [];
    this.categories = (cat.data as Category[]) ?? [];
    this.loaded = true;
  }

  reset() {
    this.household = null;
    this.members = [];
    this.categories = [];
    this.loaded = false;
  }

  async create(name: string, currency: string, displayName: string) {
    const { error } = await supabase.rpc('create_household', {
      p_name: name,
      p_currency: currency,
      p_display_name: displayName
    });
    if (error) throw error;
    await this.load();
  }

  async join(code: string, displayName: string) {
    const { error } = await supabase.rpc('join_household', {
      p_code: code,
      p_display_name: displayName
    });
    if (error) throw error;
    await this.load();
  }

  async renameMe(displayName: string) {
    const uid = session.userId;
    if (!uid) return;
    const { error } = await supabase
      .from('members')
      .update({ display_name: displayName })
      .eq('user_id', uid);
    if (error) throw error;
    this.members = this.members.map((m) =>
      m.user_id === uid ? { ...m, display_name: displayName } : m
    );
  }

  async reloadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .order('name');
    if (error) throw error;
    this.categories = (data as Category[]) ?? [];
  }
}

export const household = new HouseholdStore();
