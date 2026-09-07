import { supabase } from './supabase';
import { session } from './session.svelte';
import type { MemberName } from './members';
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

  async create(name: string, currency: string, displayName: MemberName) {
    const { error } = await supabase.rpc('create_household', {
      p_name: name,
      p_currency: currency,
      p_display_name: displayName
    });
    if (error) throw error;
    await this.load();
  }

  /** No name to pass: the database assigns whichever of the pair is still free. */
  async join(code: string) {
    const { error } = await supabase.rpc('join_household', { p_code: code });
    if (error) throw error;
    await this.load();
  }

  async addCategory(name: string) {
    const hid = this.household?.id;
    if (!hid) return;
    const maxOrder = this.categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const { error } = await supabase
      .from('categories')
      .insert({ household_id: hid, name, sort_order: maxOrder + 1 });
    if (error) throw error;
    await this.reloadCategories();
  }

  async renameCategory(id: UUID, name: string) {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id);
    if (error) throw error;
    await this.reloadCategories();
  }

  async setArchived(id: UUID, archived: boolean) {
    const { error } = await supabase.from('categories').update({ archived }).eq('id', id);
    if (error) throw error;
    await this.reloadCategories();
  }

  /**
   * Reorder by swapping sort_order with the neighbour. Existing transactions
   * store the category *name*, so reordering never touches historical records.
   */
  async moveCategory(id: UUID, delta: -1 | 1) {
    const list = this.activeCategories;
    const i = list.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= list.length) return;

    const a = list[i];
    const b = list[j];
    // Equal sort_order values would make the swap a no-op; renumber instead.
    const [aOrder, bOrder] = a.sort_order === b.sort_order ? [j + 1, i + 1] : [b.sort_order, a.sort_order];

    const results = await Promise.all([
      supabase.from('categories').update({ sort_order: aOrder }).eq('id', a.id),
      supabase.from('categories').update({ sort_order: bOrder }).eq('id', b.id)
    ]);
    const err = results.find((r) => r.error)?.error;
    if (err) throw err;
    await this.reloadCategories();
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
