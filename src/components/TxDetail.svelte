<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { ledger, type Row } from '../lib/ledger.svelte';
  import { money, splitLabel, dayLabel } from '../lib/format';

  let {
    tx,
    onreverse,
    onedit,
    onopen
  }: {
    tx: Row;
    onreverse: () => void;
    onedit: () => void;
    onopen: (tx: Row) => void;
  } = $props();

  const isReversal = $derived(tx.direction === -1);
  const reversal = $derived(ledger.reversalOf.get(tx.id));
  const original = $derived(tx.reverses_id ? ledger.byId.get(tx.reverses_id) : undefined);
  const isSettlement = $derived(tx.type === 'settlement');
  const voided = $derived(isReversal || !!reversal);

  /** 付款人对另一方的应收 = direction × amount × (1 − payer_share) */
  const receivable = $derived(
    Math.round(tx.direction * tx.amount * (1 - tx.payer_share) * 100) / 100
  );

  const payerName = $derived(household.nameOf(tx.payer_id));
  const otherName = $derived(
    household.members.find((m) => m.user_id !== tx.payer_id)?.display_name ?? '对方'
  );
</script>

<div class="head" class:voided>
  <p class="amount num">{money(tx.amount, tx.currency)}</p>
  <p class="kind">
    {isSettlement ? '结算' : '支出'}{#if isReversal} · 冲销记录{:else if reversal} · 已被冲销{/if}
  </p>
</div>

{#if isReversal && original}
  <button class="link-row" onclick={() => onopen(original)}>
    冲销的是 · {dayLabel(original.occurred_on)} {money(original.amount, original.currency)} →
  </button>
{:else if reversal}
  <button class="link-row" onclick={() => onopen(reversal)}>
    冲销记录 · {dayLabel(reversal.occurred_on)} →
  </button>
{/if}

<dl>
  <div><dt>日期</dt><dd>{dayLabel(tx.occurred_on)}</dd></div>
  <div><dt>付款人</dt><dd>{payerName}</dd></div>
  <div><dt>拆分</dt><dd>{splitLabel(tx.payer_share)}</dd></div>
  <div>
    <dt>{receivable >= 0 ? `${otherName} 应付` : `${otherName} 应收`}</dt>
    <dd class="num">{money(Math.abs(receivable), tx.currency)}</dd>
  </div>
  <div><dt>类别</dt><dd>{tx.category ?? '未分类'}</dd></div>
  <div><dt>备注</dt><dd>{tx.note?.trim() || '—'}</dd></div>
  <div><dt>记录人</dt><dd>{household.nameOf(tx.created_by)}</dd></div>
  <div>
    <dt>记录时间</dt>
    <dd>{new Date(tx.created_at).toLocaleString('zh-CN', { hour12: false })}</dd>
  </div>
  <div><dt>ID</dt><dd class="id">{tx.id}</dd></div>
</dl>

{#if voided}
  <p class="note">
    {isReversal ? '冲销记录不能再被冲销。' : '这条记录已经冲销过了，不能再改。'}
  </p>
{:else if tx.pending}
  <p class="note">这条记录还在保存中。</p>
{:else}
  <!-- 结算只能冲销：它记录的是"钱确实付过了"，改成一笔支出没有意义。 -->
  <div class="actions" class:single={isSettlement}>
    <button class="btn btn-danger" onclick={onreverse}>冲销</button>
    {#if !isSettlement}
      <button class="btn" onclick={onedit}>修改</button>
    {/if}
  </div>
  <p class="note">
    {#if isSettlement}
      账本只能追加，不能改写。结算记录只能冲销。
    {:else}
      账本只能追加，不能改写。「修改」= 冲销这条 + 新增一条；两条都会留在流水里。
    {/if}
  </p>
{/if}

<style>
  .head {
    text-align: center;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }

  .amount {
    margin: 0;
    font-size: 32px;
    font-weight: 650;
    letter-spacing: -0.03em;
  }

  .kind {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-dim);
  }

  .voided .amount {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .link-row {
    width: 100%;
    text-align: left;
    border: 0;
    background: var(--surface-sunken);
    border-radius: var(--radius-sm);
    padding: 11px 13px;
    margin-top: 14px;
    font-size: 13px;
    color: var(--text-dim);
  }

  dl {
    margin: 6px 0 0;
  }

  dl > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 0;
    border-bottom: 1px solid var(--border);
  }

  dt {
    font-size: 13px;
    color: var(--text-dim);
    flex: 0 0 auto;
  }

  dd {
    margin: 0;
    font-size: 14px;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    color: var(--text-faint);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 18px;
  }

  .actions.single {
    grid-template-columns: 1fr;
  }

  .note {
    margin: 12px 2px 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-faint);
  }
</style>
