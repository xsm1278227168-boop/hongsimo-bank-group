<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { ledger } from '../lib/ledger.svelte';
  import { router } from '../lib/router.svelte';
  import BalanceCard from '../components/BalanceCard.svelte';
  import EntryForm from '../components/EntryForm.svelte';
  import TxRow from '../components/TxRow.svelte';

  const recent = $derived(ledger.items.slice(0, 5));
</script>

<div class="page">
  <header class="page-head">
    <h1>{household.household?.name}</h1>
    <p>{household.members.map((m) => m.display_name).join(' 与 ')}</p>
  </header>

  <BalanceCard />

  <EntryForm autofocus />

  <div class="recent-head">
    <span class="section-title">最近</span>
    {#if ledger.items.length > 5}
      <button class="more" onclick={() => router.go('/ledger')}>全部流水</button>
    {/if}
  </div>

  <div class="card card-flush rows">
    {#if !ledger.loaded}
      <p class="empty">载入中…</p>
    {:else if recent.length === 0}
      <p class="empty">还没有记录。<br />在上面记下第一笔吧。</p>
    {:else}
      {#each recent as tx (tx.id)}
        <TxRow {tx} onclick={() => router.go('/ledger')} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .recent-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-top: 2px;
  }

  .more {
    border: 0;
    background: none;
    font-size: 13px;
    color: var(--text-dim);
    padding: 2px 4px;
  }
</style>
