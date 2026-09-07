<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { ledger } from '../lib/ledger.svelte';
  import { network } from '../lib/network.svelte';
  import { router } from '../lib/router.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { money } from '../lib/format';
  import BalanceCard from '../components/BalanceCard.svelte';
  import EntryForm from '../components/EntryForm.svelte';
  import TxRow from '../components/TxRow.svelte';
  import Confirm from '../components/Confirm.svelte';
  import InstallPrompt from '../components/InstallPrompt.svelte';
  import InviteCode from '../components/InviteCode.svelte';

  let confirmSettle = $state(false);
  let settling = $state(false);

  const recent = $derived(ledger.items.slice(0, 5));
  const net = $derived(ledger.net);
  const canSettle = $derived(
    !!net && net.amount > 0 && household.members.length === 2 && network.online
  );

  async function doSettle() {
    settling = true;
    try {
      await ledger.settle();
      toasts.ok('已结算');
      confirmSettle = false;
    } catch (err) {
      toasts.error(err);
    } finally {
      settling = false;
    }
  }
</script>

<div class="page">
  <header class="page-head">
    <h1>{household.household?.name}</h1>
    <p>{household.members.map((m) => m.display_name).join(' 与 ')}</p>
  </header>

  <BalanceCard action={canSettle ? settleAction : undefined} />

  {#snippet settleAction()}
    <button class="btn btn-block" onclick={() => (confirmSettle = true)}>结算</button>
  {/snippet}

  <!-- The invite code lives here, not on a post-creation screen: the route
       guard unmounts onboarding the moment the household exists, and this is
       the one thing the first user needs before the app is useful at all. -->
  {#if household.members.length < 2 && household.household}
    <section class="card invite">
      <InviteCode code={household.household.invite_code} />
      <p class="invite-hint">把邀请码发给对方，TA 登录后在「加入账本」里填这个码。</p>
    </section>
  {/if}

  <EntryForm autofocus />

  <InstallPrompt dismissible />

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

<Confirm
  open={confirmSettle}
  title="确认结算？"
  confirmText="确认结算"
  busy={settling}
  onconfirm={doSettle}
  oncancel={() => (confirmSettle = false)}
>
  {#if net}
    <p class="line">
      <strong>{household.nameOf(net.debtor)}</strong> 付给
      <strong>{household.nameOf(net.creditor)}</strong>
      <strong class="num">{money(net.amount, household.currency)}</strong>
    </p>
    <p class="small">
      金额由数据库计算。确认后会新增一条结算记录，余额归零；不会删除任何已有记录。
    </p>
  {/if}
</Confirm>

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

  .invite-hint {
    margin: 12px 2px 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-faint);
  }

  .line {
    margin: 0;
    color: var(--text);
    font-size: 15px;
    line-height: 1.7;
  }

  .small {
    margin: 10px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-faint);
  }
</style>
