<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { ledger } from '../lib/ledger.svelte';
  import { session } from '../lib/session.svelte';
  import { money } from '../lib/format';

  let { children }: { children?: import('svelte').Snippet } = $props();

  const net = $derived(ledger.net);
  const amount = $derived(net?.amount ?? 0);
  const settled = $derived(!net || amount <= 0);
  const iAmCreditor = $derived(net?.creditor === session.userId);
  const soloHousehold = $derived(household.members.length < 2);
</script>

<section class="balance card card-lg" class:owed={!settled && iAmCreditor} class:owing={!settled && !iAmCreditor}>
  <p class="cap">当前结余</p>

  {#if soloHousehold}
    <p class="amount num">{money(0, household.currency)}</p>
    <p class="who">等对方用邀请码加入后开始</p>
  {:else if settled}
    <p class="amount num">{money(0, household.currency)}</p>
    <p class="who">已结清</p>
  {:else}
    <p class="amount num">{money(amount, household.currency)}</p>
    <p class="who">
      {#if iAmCreditor}
        <strong>{household.nameOf(net?.debtor)}</strong> 欠你
      {:else}
        你欠 <strong>{household.nameOf(net?.creditor)}</strong>
      {/if}
    </p>
  {/if}

  {#if children}
    <div class="action">{@render children()}</div>
  {/if}
</section>

<style>
  .balance {
    text-align: center;
    padding: 22px 20px 20px;
  }

  .cap {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .amount {
    margin: 8px 0 0;
    font-size: 40px;
    line-height: 1.15;
    font-weight: 650;
    letter-spacing: -0.03em;
  }

  .owed .amount {
    color: var(--positive);
  }

  .owing .amount {
    color: var(--negative);
  }

  .who {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--text-dim);
  }

  .who strong {
    color: var(--text);
    font-weight: 600;
  }

  .action {
    margin-top: 16px;
  }
</style>
