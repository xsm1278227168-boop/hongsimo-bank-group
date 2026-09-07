<script lang="ts">
  import { session } from './lib/session.svelte';
  import { household } from './lib/household.svelte';
  import { router } from './lib/router.svelte';
  import { toasts } from './lib/toast.svelte';
  import Login from './routes/Login.svelte';
  import Onboarding from './routes/Onboarding.svelte';
  import Toast from './components/Toast.svelte';

  session.init();

  // Load (or clear) the household whenever the signed-in user changes.
  let loadedFor: string | null = null;
  $effect(() => {
    const uid = session.userId;
    if (uid === loadedFor) return;
    loadedFor = uid;
    household.reset();
    if (!uid) return;
    household.load().catch((err) => {
      household.loaded = true;
      toasts.error(err);
    });
  });

  // Keep the URL honest about which gate the user is behind. What actually
  // renders is driven by state, so a stale hash can never show the wrong page.
  $effect(() => {
    if (!session.ready) return;
    if (!session.user) {
      router.go('/login', true);
      return;
    }
    if (router.path === '/login') router.go('/', true);
    if (!household.loaded) return;
    if (!household.household) router.go('/onboarding', true);
    else if (router.path === '/onboarding') router.go('/', true);
  });
</script>

{#if !session.ready}
  <div class="splash">载入中…</div>
{:else if !session.user}
  <Login />
{:else if !household.loaded}
  <div class="splash">载入账本…</div>
{:else if !household.household}
  <Onboarding />
{:else}
  <main class="page">
    <h1>{household.household.name}</h1>
    <p class="muted">
      {household.members.map((m) => m.display_name).join(' · ')} · {household.currency}
    </p>
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
