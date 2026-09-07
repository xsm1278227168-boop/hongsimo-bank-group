<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { ledger, type Row } from '../lib/ledger.svelte';
  import { session } from '../lib/session.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { money, monthKey, monthLabel } from '../lib/format';
  import TxRow from '../components/TxRow.svelte';
  import TxDetail from '../components/TxDetail.svelte';
  import Drawer from '../components/Drawer.svelte';
  import Confirm from '../components/Confirm.svelte';
  import EntryForm from '../components/EntryForm.svelte';

  type Kind = 'all' | 'expense' | 'settlement';

  let month = $state<string | null>(null);
  let category = $state<string | null>(null);
  let payer = $state<string | null>(null);
  let kind = $state<Kind>('all');

  let filterOpen = $state(false);
  let selected = $state<Row | null>(null);
  let editing = $state<Row | null>(null);
  let confirmReverse = $state(false);
  let busy = $state(false);

  const months = $derived(
    [...new Set(ledger.items.map((t) => monthKey(t.occurred_on)))].sort().reverse()
  );

  /** Categories seen in the data, so a filter still works after one is archived. */
  const categories = $derived(
    [
      ...new Set([
        ...household.activeCategories.map((c) => c.name),
        ...ledger.items.map((t) => t.category).filter((c): c is string => !!c)
      ])
    ].sort()
  );

  const filtered = $derived(
    ledger.items.filter((t) => {
      if (month && monthKey(t.occurred_on) !== month) return false;
      if (category && t.category !== category) return false;
      if (payer && t.payer_id !== payer) return false;
      if (kind !== 'all' && t.type !== kind) return false;
      return true;
    })
  );

  const activeCount = $derived(
    (month ? 1 : 0) + (category ? 1 : 0) + (payer ? 1 : 0) + (kind !== 'all' ? 1 : 0)
  );

  // ledger.items is already newest-first, so a single pass groups by month.
  const groups = $derived.by(() => {
    const out: { key: string; items: Row[]; total: number }[] = [];
    for (const t of filtered) {
      const k = monthKey(t.occurred_on);
      let g = out[out.length - 1];
      if (!g || g.key !== k) {
        g = { key: k, items: [], total: 0 };
        out.push(g);
      }
      g.items.push(t);
      if (t.type === 'expense') g.total += t.direction * t.amount;
    }
    return out;
  });

  function clearAll() {
    month = null;
    category = null;
    payer = null;
    kind = 'all';
  }

  async function doReverse() {
    if (!selected) return;
    busy = true;
    try {
      await ledger.reverse(selected.id);
      toasts.ok('已冲销');
      confirmReverse = false;
      selected = null;
    } catch (err) {
      toasts.error(err);
    } finally {
      busy = false;
    }
  }

  function startEdit() {
    editing = selected;
    selected = null;
  }
</script>

<div class="page">
  <header class="page-head">
    <h1>流水</h1>
    <p>{filtered.length} 条记录</p>
  </header>

  <div class="filters">
    <button class="chip filter-btn" onclick={() => (filterOpen = true)}>
      筛选{#if activeCount}<span class="badge">{activeCount}</span>{/if}
    </button>
    {#if month}
      <button class="chip" aria-pressed="true" onclick={() => (month = null)}>
        {monthLabel(month)} ✕
      </button>
    {/if}
    {#if category}
      <button class="chip" aria-pressed="true" onclick={() => (category = null)}>
        {category} ✕
      </button>
    {/if}
    {#if payer}
      <button class="chip" aria-pressed="true" onclick={() => (payer = null)}>
        {household.nameOf(payer)}付 ✕
      </button>
    {/if}
    {#if kind !== 'all'}
      <button class="chip" aria-pressed="true" onclick={() => (kind = 'all')}>
        {kind === 'expense' ? '支出' : '结算'} ✕
      </button>
    {/if}
  </div>

  {#if !ledger.loaded}
    <p class="empty">载入中…</p>
  {:else if groups.length === 0}
    <p class="empty">
      {activeCount ? '没有符合筛选条件的记录。' : '还没有记录。'}
    </p>
  {:else}
    {#each groups as g (g.key)}
      <section>
        <div class="group-head">
          <span class="section-title">{monthLabel(g.key)}</span>
          <span class="group-total num">支出 {money(g.total, household.currency)}</span>
        </div>
        <div class="card card-flush rows">
          {#each g.items as tx (tx.id)}
            <TxRow {tx} onclick={(t) => (selected = t)} />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<!-- 筛选 -->
<Drawer open={filterOpen} title="筛选" onclose={() => (filterOpen = false)}>
  <div class="group">
    <span class="label">月份</span>
    <div class="chips">
      <button class="chip" aria-pressed={month === null} onclick={() => (month = null)}>全部</button>
      {#each months as m (m)}
        <button class="chip" aria-pressed={month === m} onclick={() => (month = m)}>
          {monthLabel(m)}
        </button>
      {/each}
    </div>
  </div>

  <div class="group">
    <span class="label">类别</span>
    <div class="chips">
      <button class="chip" aria-pressed={category === null} onclick={() => (category = null)}>
        全部
      </button>
      {#each categories as c (c)}
        <button class="chip" aria-pressed={category === c} onclick={() => (category = c)}>{c}</button>
      {/each}
    </div>
  </div>

  <div class="group">
    <span class="label">付款人</span>
    <div class="segmented">
      <button aria-pressed={payer === null} onclick={() => (payer = null)}>全部</button>
      <button
        aria-pressed={payer === session.userId}
        onclick={() => (payer = session.userId)}>我</button
      >
      <button
        aria-pressed={!!household.partner && payer === household.partner.user_id}
        disabled={!household.partner}
        onclick={() => household.partner && (payer = household.partner.user_id)}
      >
        {household.partner?.display_name ?? '对方'}
      </button>
    </div>
  </div>

  <div class="group">
    <span class="label">类型</span>
    <div class="segmented">
      <button aria-pressed={kind === 'all'} onclick={() => (kind = 'all')}>全部</button>
      <button aria-pressed={kind === 'expense'} onclick={() => (kind = 'expense')}>支出</button>
      <button aria-pressed={kind === 'settlement'} onclick={() => (kind = 'settlement')}>结算</button>
    </div>
  </div>

  <div class="sheet-actions">
    <button class="btn" onclick={clearAll} disabled={activeCount === 0}>清除筛选</button>
    <button class="btn btn-primary" onclick={() => (filterOpen = false)}>查看 {filtered.length} 条</button>
  </div>
</Drawer>

<!-- 记录详情 -->
<Drawer open={!!selected} title="记录详情" onclose={() => (selected = null)}>
  {#if selected}
    <TxDetail
      tx={selected}
      onreverse={() => (confirmReverse = true)}
      onedit={startEdit}
      onopen={(t) => (selected = t)}
    />
  {/if}
</Drawer>

<!-- 修改 = 冲销原记录 + 新增一条 -->
<Drawer open={!!editing} title="修改记录" onclose={() => (editing = null)}>
  {#if editing}
    <p class="edit-note">
      提交后会先冲销原记录，再新增一条。两条都会留在流水里。
    </p>
    <EntryForm
      replaces={editing.id}
      submitText="冲销并保存"
      initial={{
        amount: editing.amount,
        payer_id: editing.payer_id,
        payer_share: editing.payer_share,
        category: editing.category,
        occurred_on: editing.occurred_on,
        note: editing.note
      }}
      onDone={() => (editing = null)}
    />
  {/if}
</Drawer>

<Confirm
  open={confirmReverse}
  title="冲销这条记录？"
  confirmText="冲销"
  danger
  {busy}
  onconfirm={doReverse}
  oncancel={() => (confirmReverse = false)}
>
  {#if selected}
    会新增一条金额相同、方向相反的记录来抵消它。原记录会保留在流水里，不会被删除。
  {/if}
</Confirm>

<style>
  .filters {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px 14px 2px 0;
    margin-right: -14px;
  }

  .filters::-webkit-scrollbar {
    display: none;
  }

  .filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 2px 4px 8px;
  }

  .group-total {
    font-size: 12px;
    color: var(--text-faint);
  }

  section + section {
    margin-top: 4px;
  }

  .group {
    margin-bottom: 20px;
  }

  .sheet-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 4px;
  }

  .edit-note {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-dim);
    background: var(--surface-sunken);
    border-radius: var(--radius-sm);
    padding: 11px 13px;
  }
</style>
