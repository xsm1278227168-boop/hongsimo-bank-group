<script lang="ts">
  import { supabase, configError, redirectTo } from '../lib/supabase';
  import { toasts } from '../lib/toast.svelte';

  let email = $state('');
  let code = $state('');
  let sending = $state(false);
  let verifying = $state(false);
  let sentTo = $state<string | null>(null);

  const emailLooksValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));

  async function sendLink(e: SubmitEvent) {
    e.preventDefault();
    if (!emailLooksValid || sending) return;
    sending = true;
    try {
      const address = email.trim();
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: redirectTo() }
      });
      if (error) throw error;
      sentTo = address;
      toasts.ok('登录邮件已发送');
    } catch (err) {
      toasts.error(err);
    } finally {
      sending = false;
    }
  }

  async function verifyCode(e: SubmitEvent) {
    e.preventDefault();
    if (!sentTo || code.trim().length < 6 || verifying) return;
    verifying = true;
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: sentTo,
        token: code.trim(),
        type: 'email'
      });
      if (error) throw error;
      // onAuthStateChange takes it from here.
    } catch (err) {
      toasts.error(err);
    } finally {
      verifying = false;
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

  <form class="card" onsubmit={sendLink}>
    <label class="field">
      <span class="label">邮箱</span>
      <input
        class="input"
        type="email"
        inputmode="email"
        autocomplete="email"
        placeholder="you@example.com"
        bind:value={email}
        disabled={!!configError}
      />
    </label>
    <button class="btn btn-primary btn-block" disabled={!emailLooksValid || sending || !!configError}>
      {sending ? '发送中…' : sentTo ? '重新发送登录链接' : '发送登录链接'}
    </button>
    <p class="hint muted">无需密码。点击邮件里的链接即可登录。</p>
  </form>

  {#if sentTo}
    <form class="card" onsubmit={verifyCode}>
      <p class="sent">已发送到 <strong>{sentTo}</strong></p>
      <!-- 邮件客户端的内置浏览器和这里不共享存储，链接可能打不开登录态；
           这时候用邮件里的 6 位验证码更稳。 -->
      <label class="field">
        <span class="label">或输入邮件里的 6 位验证码</span>
        <input
          class="input code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="······"
          bind:value={code}
        />
      </label>
      <button class="btn btn-block" disabled={code.trim().length < 6 || verifying}>
        {verifying ? '验证中…' : '用验证码登录'}
      </button>
    </form>
  {/if}
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

  .hint {
    font-size: 13px;
    margin: 12px 0 0;
    text-align: center;
  }

  .sent {
    margin: 0 0 14px;
    font-size: 14px;
    color: var(--text-dim);
  }

  .code {
    letter-spacing: 0.5em;
    text-align: center;
    font-size: 20px;
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
