import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { session } from './session.svelte';
import { household } from './household.svelte';
import { toNum } from './format';
import type { NetBalance, Transaction, UUID } from './types';

/** A row that has been sent but not yet acknowledged by the server. */
export type Row = Transaction & { pending?: boolean };

export interface NewTx {
  occurred_on: string;
  amount: number;
  payer_id: UUID;
  payer_share: number;
  category: string | null;
  note: string | null;
}

/** Realtime and PostgREST can both hand numerics back as strings. */
function normalize(raw: Record<string, unknown>): Row {
  return {
    ...(raw as unknown as Transaction),
    amount: toNum(raw.amount),
    payer_share: toNum(raw.payer_share),
    direction: Number(raw.direction) === -1 ? -1 : 1
  };
}

/** Newest first: by day, then by insertion order within the day. */
function cmp(a: Row, b: Row): number {
  if (a.occurred_on !== b.occurred_on) return a.occurred_on < b.occurred_on ? 1 : -1;
  return a.created_at < b.created_at ? 1 : -1;
}

class LedgerStore {
  items = $state<Row[]>([]);
  net = $state<NetBalance | null>(null);
  loaded = $state(false);

  /** ids of records that have been reversed — rendered struck through. */
  reversedIds = $derived(
    new Set(this.items.filter((t) => t.reverses_id).map((t) => t.reverses_id as string))
  );

  byId = $derived(new Map(this.items.map((t) => [t.id, t])));

  /** id → the reversal that cancels it, for cross-linking in the ledger. */
  reversalOf = $derived(
    new Map(this.items.filter((t) => t.reverses_id).map((t) => [t.reverses_id as string, t]))
  );

  private channel: RealtimeChannel | null = null;

  async load() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      this.loaded = true;
      throw error;
    }
    this.items = ((data as Record<string, unknown>[]) ?? []).map(normalize);
    this.loaded = true;
  }

  async refreshNet() {
    const hid = household.household?.id;
    if (!hid) return;
    const { data, error } = await supabase.rpc('household_net', { p_hid: hid });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    this.net = row
      ? {
          creditor: (row.creditor as string) ?? null,
          debtor: (row.debtor as string) ?? null,
          amount: toNum(row.amount)
        }
      : null;
  }

  async refresh() {
    await Promise.all([this.load(), this.refreshNet()]);
  }

  private upsert(row: Row) {
    const i = this.items.findIndex((t) => t.id === row.id);
    if (i === -1) this.items = [...this.items, row].sort(cmp);
    else this.items = this.items.map((t) => (t.id === row.id ? row : t)).sort(cmp);
  }

  private async pull(id: UUID) {
    const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
    if (error) throw error;
    this.upsert(normalize(data as Record<string, unknown>));
  }

  /**
   * Optimistic insert: the row appears immediately and is replaced by the
   * server's copy, or removed again if the write is rejected.
   */
  async add(input: NewTx) {
    const hh = household.household;
    const uid = session.userId;
    if (!hh || !uid) throw new Error('not authenticated');

    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: Row = {
      id: tempId,
      household_id: hh.id,
      type: 'expense',
      occurred_on: input.occurred_on,
      amount: input.amount,
      currency: hh.currency,
      payer_id: input.payer_id,
      payer_share: input.payer_share,
      category: input.category,
      note: input.note,
      direction: 1,
      reverses_id: null,
      created_by: uid,
      created_at: new Date().toISOString(),
      pending: true
    };
    this.items = [optimistic, ...this.items].sort(cmp);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          household_id: hh.id,
          type: 'expense',
          occurred_on: input.occurred_on,
          amount: input.amount,
          currency: hh.currency,
          payer_id: input.payer_id,
          payer_share: input.payer_share,
          category: input.category,
          note: input.note,
          created_by: uid
        })
        .select()
        .single();
      if (error) throw error;

      const saved = normalize(data as Record<string, unknown>);
      // Realtime may have delivered the same row already; drop the placeholder
      // and upsert by real id rather than blindly swapping.
      this.items = this.items.filter((t) => t.id !== tempId);
      this.upsert(saved);
      await this.refreshNet();
    } catch (err) {
      this.items = this.items.filter((t) => t.id !== tempId);
      throw err;
    }
  }

  async reverse(id: UUID) {
    const { data, error } = await supabase.rpc('reverse_transaction', { p_id: id });
    if (error) throw error;
    if (typeof data === 'string') await this.pull(data);
    await this.refreshNet();
  }

  /**
   * "Edit" in an append-only ledger: cancel the old record, then write the new
   * one. The reversal is deliberately deferred to submit time — reversing when
   * the edit sheet opens would leave a dangling reversal every time the user
   * changes their mind and closes it.
   */
  async replace(id: UUID, input: NewTx) {
    await this.reverse(id);
    await this.add(input);
  }

  async settle() {
    const hid = household.household?.id;
    if (!hid) throw new Error('no household');
    const { data, error } = await supabase.rpc('settle_up', { p_hid: hid });
    if (error) throw error;
    if (typeof data === 'string') await this.pull(data);
    await this.refreshNet();
  }

  /** Live updates for the other phone's entries. INSERT is the only event the ledger can produce. */
  subscribe(householdId: UUID) {
    this.unsubscribe();
    this.channel = supabase
      .channel(`tx:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `household_id=eq.${householdId}`
        },
        (payload) => {
          this.upsert(normalize(payload.new as Record<string, unknown>));
          void this.refreshNet();
        }
      )
      .subscribe();
  }

  unsubscribe() {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  reset() {
    this.unsubscribe();
    this.items = [];
    this.net = null;
    this.loaded = false;
  }
}

export const ledger = new LedgerStore();
