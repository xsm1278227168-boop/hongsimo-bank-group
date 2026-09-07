<script lang="ts">
  import { supabase } from '../lib/supabase';
  import { household } from '../lib/household.svelte';
  import { ledger } from '../lib/ledger.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { money, toNum, monthLabel, currentMonthKey, shiftMonth } from '../lib/format';
  import CategoryChart from '../components/CategoryChart.svelte';
  import type { MonthlyCategoryTotal, MonthlyPersonTotal } from '../lib/types';

  let month = $state(currentMonthKey());
  let cats = $state<MonthlyCategoryTotal[]>([]);
  let persons = $state<MonthlyPersonTotal[]>([]);
  let loading = $state(true);

  const thisMonth = currentMonthKey();
  const atLatest = $derived(month >= thisMonth);

  // Refetch on month change and whenever the ledger grows (own entry or realtime).
  $effect(() => {
    const m = month;
    const hid = household.household?.id;
    void ledger.items.length;
    if (!hid) return;

    let cancelled = false;
    loading = true;
    (async () => {
      try {
        const first = `${m}-01`;
        const [c, p] = await Promise.all([
          supabase.from('monthly_category_totals').select('*').eq('month', first),
          supabase.from('monthly_person_totals').select('*').eq('month', first)
        ]);
        if (cancelled) return;
        if (c.error) throw c.error;
        if (p.error) throw p.error;
        cats = (c.data as MonthlyCategoryTotal[]) ?? [];
        persons = (p.data as MonthlyPersonTotal[]) ?? [];
      } catch (err) {
        if (!cancelled) toasts.error(err);
      } finally {
        if (!cancelled) loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const total = $derived(cats.reduce((s, c) => s + toNum(c.total), 0));

  /** Driven by members, not by the view, so a member with no activity still shows. */
  const table = $derived(
    household.members.map((m) => {
      const row = persons.find((p) => p.user_id === m.user_id);
      return {
        user_id: m.user_id,
        name: m.display_name,
        paid: toNum(row?.paid),
        borne: toNum(row?.borne)
      };
    })
  );

  const paidTotal = $derived(table.reduce((s, r) => s + r.paid, 0));
  const borneTotal = $derived(table.reduce((s, r) => s + r.borne, 0));
</script>

<div class="page">
  <header class="page-head">
    <h1>月度汇总</h1>
  </header>

  <div class="monthbar card">
    <button class="arrow" aria-label="上个月" onclick={() => (month = shiftMonth(month, -1))}>‹</button>
    <span class="month">{monthLabel(month)}</span>
    <button
      class="arrow"
      aria-label="下个月"
      disabled={atLatest}
      onclick={() => (month = shiftMonth(month, 1))}>›</button
    >
  </div>

  <div class="card total-card">
    <p class="cap">本月支出总额</p>
    <p class="total num">{money(total, household.currency)}</p>
    {#if !atLatest}
      <button class="jump" onclick={() => (month = thisMonth)}>回到本月</button>
    {/if}
  </div>

  <span class="section-title">按类别</span>
  <div class="card">
    {#if loading}
      <p class="empty">载入中…</p>
    {:else if cats.length === 0}
      <p class="empty">这个月还没有支出。</p>
    {:else}
      <CategoryChart data={cats} currency={household.currency} />
    {/if}
  </div>

  <span class="section-title">按人</span>
  <div class="card card-flush">
    <table>
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col">实付</th>
          <th scope="col">实担</th>
        </tr>
      </thead>
      <tbody>
        {#each table as r (r.user_id)}
          <tr>
            <th scope="row">{r.name}</th>
            <td class="num">{money(r.paid, household.currency)}</td>
            <td class="num">{money(r.borne, household.currency)}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">合计</th>
          <td class="num">{money(paidTotal, household.currency)}</td>
          <td class="num">{money(borneTotal, household.currency)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <p class="footnote">
    只统计支出，结算记录不计入；冲销与被冲销的记录互相抵消。数字由数据库视图计算。
  </p>
</div>

<style>
  .monthbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
  }

  .arrow {
    border: 0;
    background: none;
    color: var(--text-dim);
    font-size: 24px;
    line-height: 1;
    width: 44px;
    height: 40px;
    border-radius: var(--radius-sm);
  }

  .arrow:disabled {
    opacity: 0.28;
  }

  .month {
    font-size: 16px;
    font-weight: 600;
  }

  .total-card {
    text-align: center;
    padding: 18px 16px;
  }

  .cap {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .total {
    margin: 6px 0 0;
    font-size: 32px;
    font-weight: 650;
    letter-spacing: -0.03em;
  }

  .jump {
    margin-top: 10px;
    border: 0;
    background: none;
    font-size: 13px;
    color: var(--text-dim);
    text-decoration: underline;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: 12px 16px;
    text-align: right;
  }

  thead th {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-faint);
    padding-bottom: 6px;
    padding-top: 14px;
  }

  tbody th,
  tfoot th {
    text-align: left;
    font-weight: 500;
  }

  tbody tr {
    border-top: 1px solid var(--border);
  }

  tfoot tr {
    border-top: 1px solid var(--border-strong);
  }

  tfoot th,
  tfoot td {
    font-weight: 600;
  }

  .footnote {
    margin: 2px 4px 0;
    font-size: 12px;
    line-height: 1.65;
    color: var(--text-faint);
  }
</style>
