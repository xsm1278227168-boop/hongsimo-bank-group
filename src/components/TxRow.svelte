<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { ledger, type Row } from '../lib/ledger.svelte';
  import { session } from '../lib/session.svelte';
  import { money, splitLabel, dayLabel } from '../lib/format';

  let {
    tx,
    showDate = true,
    onclick
  }: { tx: Row; showDate?: boolean; onclick?: (tx: Row) => void } = $props();

  const isReversal = $derived(tx.direction === -1);
  const isReversed = $derived(ledger.reversedIds.has(tx.id));
  const voided = $derived(isReversal || isReversed);
  const isSettlement = $derived(tx.type === 'settlement');
  const payerName = $derived(tx.payer_id === session.userId ? '我' : household.nameOf(tx.payer_id));

  const title = $derived(
    tx.note?.trim() || (isSettlement ? '结算' : tx.category?.trim() || '未分类')
  );

  // Assembled in JS rather than markup: interleaved {#if} blocks make the
  // spacing around the separators unpredictable.
  const sub = $derived(
    [
      showDate ? dayLabel(tx.occurred_on) : null,
      `${payerName}付`,
      isSettlement ? null : splitLabel(tx.payer_share),
      !isSettlement && tx.category && tx.note ? tx.category : null
    ]
      .filter(Boolean)
      .join(' · ')
  );
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  class="row"
  class:voided
  class:tappable={!!onclick}
  role={onclick ? 'button' : undefined}
  onclick={onclick ? () => onclick(tx) : undefined}
>
  <div class="main">
    <p class="title">
      <span class="text">{title}</span>
      {#if isReversal}
        <span class="tag">冲销</span>
      {:else if isReversed}
        <span class="tag">已冲销</span>
      {:else if isSettlement}
        <span class="tag accent">结算</span>
      {/if}
      {#if tx.pending}
        <span class="tag">保存中</span>
      {/if}
    </p>
    <p class="sub">{sub}</p>
  </div>
  <span class="amount num">{money(tx.amount, tx.currency)}</span>
</svelte:element>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 13px 16px;
    background: var(--surface);
    border: 0;
    color: inherit;
    font: inherit;
    min-height: 62px;
  }

  .tappable {
    transition: background 0.12s ease;
  }

  .tappable:active {
    background: var(--surface-2);
  }

  .main {
    flex: 1;
    min-width: 0;
  }

  .title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.35;
  }

  .title .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    margin: 3px 0 0;
    font-size: 12.5px;
    color: var(--text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .amount {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .tag {
    flex: 0 0 auto;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.02em;
    padding: 2px 6px;
    border-radius: 5px;
    background: var(--surface-sunken);
    color: var(--text-dim);
  }

  .tag.accent {
    background: var(--positive-soft);
    color: var(--positive);
  }

  .voided .title .text,
  .voided .amount {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }

  .voided {
    color: var(--text-faint);
  }

  .voided .amount {
    font-weight: 500;
  }
</style>
