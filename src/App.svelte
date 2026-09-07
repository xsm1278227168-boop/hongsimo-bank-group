<script lang="ts">
  import { session } from './lib/session.svelte';
  import { router } from './lib/router.svelte';
  import Login from './routes/Login.svelte';
  import Toast from './components/Toast.svelte';

  session.init();

  // Route guard. Everything except /login requires a session.
  $effect(() => {
    if (!session.ready) return;
    if (!session.user) {
      if (router.path !== '/login') router.go('/login', true);
    } else if (router.path === '/login') {
      router.go('/', true);
    }
  });
</script>

{#if !session.ready}
  <div class="splash">载入中…</div>
{:else if !session.user}
  <Login />
{:else}
  <main class="page">
    <h1>已登录</h1>
    <p class="muted">{session.user.email}</p>
    <button class="btn" onclick={() => session.signOut()}>退出登录</button>
  </main>
{/if}

<Toast />

<style>
  .splash {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    font-size: 14px;
  }
</style>
