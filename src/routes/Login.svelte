<script lang="ts">
  import { configError } from '../lib/supabase';
  import { session } from '../lib/session.svelte';
  import { humanError } from '../lib/errors';

  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  const canSubmit = $derived(
    email.trim().length > 0 && password.length > 0 && !busy && !configError
  );

  // Enter in either field submits: this is a real <form> with a submit button.
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    busy = true;
    error = null;
    try {
      await session.signIn(email.trim(), password);
      // onAuthStateChange takes it from here.
    } catch (err) {
      error = humanError(err);
    } finally {
      busy = false;
    }
  }
</script>

<main class="wrap">
  <header>
    <h1>洪撕膜之银行集团</h1>
    <p class="muted">两个人的共享账本</p>
  </header>

  {#if configError}
    <p class="config-error">{configError}</p>
  {/if}

  <form class="card" onsubmit={submit}>
    <label class="field">
      <span class="label">邮箱</span>
      <input
        class="input"
        type="email"
        inputmode="email"
        autocomplete="username"
        placeholder="you@example.com"
        bind:value={email}
        oninput={() => (error = null)}
        disabled={!!configError}
      />
    </label>

    <label class="field">
      <span class="label">密码</span>
      <input
        class="input"
        type="password"
        autocomplete="current-password"
        bind:value={password}
        oninput={() => (error = null)}
        disabled={!!configError}
      />
    </label>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button class="btn btn-primary btn-block" disabled={!canSubmit}>
      {busy ? '登录中…' : '登录'}
    </button>
    <p class="hint muted">账号由管理员创建，没有注册入口。</p>
  </form>
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
    margin-bottom: 8px;
  }

  header h1 {
    font-size: 22px;
    letter-spacing: 0.01em;
  }

  header p {
    margin: 6px 0 0;
    font-size: 14px;
  }

  .error {
    margin: -6px 0 14px;
    font-size: 13.5px;
    color: var(--negative);
  }

  .hint {
    font-size: 13px;
    margin: 12px 0 0;
    text-align: center;
  }

  .config-error {
    background: var(--warn-bg);
    color: var(--warn-text);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 13px;
    margin: 0;
  }
</style>
