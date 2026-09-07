import { supabase } from './supabase';
import { household } from './household.svelte';
import type { Transaction } from './types';

const COLUMNS = [
  'id',
  'occurred_on',
  'type',
  'amount',
  'currency',
  'payer_name',
  'payer_share',
  'category',
  'note',
  'direction',
  'reverses_id',
  'created_at'
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Pulls the whole ledger and hands back a CSV. Excel only detects UTF-8 from a
 * BOM, and without one the Chinese notes come out as mojibake.
 */
export async function exportCsv(): Promise<{ filename: string; blob: Blob }> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('occurred_on', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (data as Transaction[]) ?? [];
  const lines = [COLUMNS.join(',')];

  for (const t of rows) {
    lines.push(
      [
        t.id,
        t.occurred_on,
        t.type,
        t.amount,
        t.currency,
        household.nameOf(t.payer_id),
        t.payer_share,
        t.category,
        t.note,
        t.direction,
        t.reverses_id,
        t.created_at
      ]
        .map(cell)
        .join(',')
    );
  }

  const csv = '﻿' + lines.join('\r\n') + '\r\n';
  const today = new Date().toISOString().slice(0, 10);
  return {
    filename: `ledger-${today}.csv`,
    blob: new Blob([csv], { type: 'text/csv;charset=utf-8' })
  };
}

export function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
