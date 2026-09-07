<script lang="ts">
  import { household } from '../lib/household.svelte';
  import { session } from '../lib/session.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { MEMBER_NAMES, type MemberName } from '../lib/members';

  const CURRENCIES = ['CNY', 'HKD', 'TWD', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'];

  let mode = $state<'create' | 'join'>('create');
  let busy = $state(false);

  // create
  let name = $state('我们的账本');
  let currency = $state('CNY');
  let who = $state<MemberName | null>(null);

  // join
  let code = $state('');

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !who || !name.trim()) return;
    busy = true;
    try {
      // On success the household exists, so App unmounts this screen and Home
      // takes over — including showing the invite code.
      await household.create(name.trim(), currency, who);
    } catch (err) {
      toasts.error(err);
    } finally {
      busy = false;
    }
  }

  async function submitJoin(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    busy = true;
    try {
      await household.join(code.trim().toLowerCase());
      toasts.ok('已加入账本');
    } catch (err) {
      toasts.error(err);
    } finally {
      busy = false;
    }
  }
</script>

<main class="wrap">
  <header>
    <h1>洪撕膜之银行集团</h1>
    <p class="muted">{session.user?.email}</p>
  </header>

  <div class="tabs" role="tablist">
    <button
      role="tab"
      aria-selected={mode === 'create'}
      class="tab"
      onclick={() => (mode = 'create')}>创建账本</button
    >
    <button
      role="tab"
      aria-selected={mode === 'join'}
      class="tab"
      onclick={() => (mode = 'join')}>加入账本</button
    >
  </div>

  {#if mode === 'create'}
    <form class="card" onsubmit={submitCreate}>
      <label class="field">
        <span class="label">账本名称</span>
        <input class="input" bind:value={name} maxlength="40" />
      </label>

      <label class="field">
        <span class="label">币种</span>
        <select class="input" bind:value={currency}>
          {#each CURRENCIES as c (c)}
            <option value={c}>{c}</option>
          {/each}
        </select>
        <span class="note">v1 是单币种账本，创建后不再修改。</span>
      </label>

      <div class="field">
        <span class="label">我是</span>
        <div class="segmented">
          {#each MEMBER_NAMES as n (n)}
            <button type="button" aria-pressed={who === n} onclick={() => (who = n)}>{n}</button>
          {/each}
        </div>
        <span class="note">对方加入时会自动成为另一个。</span>
      </div>

      <button class="btn btn-primary btn-block" disabled={busy || !who}>
        {busy ? '创建中…' : '创建'}
      </button>
    </form>
  {:else}
    <form class="card" onsubmit={submitJoin}>
      <label class="field">
        <span class="label">邀请码</span>
        <input
          class="input code"
          bind:value={code}
          maxlength="8"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          placeholder="8 位字符"
        />
      </label>

      <p class="note join-note">
        名字不用填 —— 账本里剩下的那个就是你（{MEMBER_NAMES.join(' 或 ')}）。
      </p>

      <button class="btn btn-primary btn-block" disabled={busy || !code.trim()}>
        {busy ? '加入中…' : '加入'}
      </button>
    </form>
  {/if}

  <button class="link" onclick={() => session.signOut()}>换一个账号登录</button>
</main>

<style>
  .wrap {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    padding: 24px 16px calc(40px + env(safe-area-inset-bottom, 0px));
  }

  header {
    text-align: center;
  }

  header h1 {
    font-size: 20px;
  }

  header p {
    margin: 6px 0 0;
    font-size: 13px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px;
  }

  .tab {
    flex: 1;
    border: 0;
    background: transparent;
    border-radius: 7px;
    padding: 9px 0;
    font-size: 14px;
    color: var(--text-dim);
    min-height: 40px;
  }

  .tab[aria-selected='true'] {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: var(--shadow);
  }

  .note {
    display: block;
    font-size: 12px;
    color: var(--text-faint);
    margin-top: 6px;
  }

  .join-note {
    margin: 0 2px 18px;
    line-height: 1.6;
  }

  .code {
    letter-spacing: 0.22em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .link {
    border: 0;
    background: none;
    color: var(--text-dim);
    font-size: 13px;
    text-decoration: underline;
    padding: 8px;
    align-self: center;
  }
</style>
