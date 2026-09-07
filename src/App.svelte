<script lang="ts">
  import { session } from './lib/session.svelte';
  import { household } from './lib/household.svelte';
  import { ledger } from './lib/ledger.svelte';
  import { router } from './lib/router.svelte';
  import { toasts } from './lib/toast.svelte';
  import Login from './routes/Login.svelte';
  import Onboarding from './routes/Onboarding.svelte';
  import Home from './routes/Home.svelte';
  import Ledger from './routes/Ledger.svelte';
  import Summary from './routes/Summary.svelte';
  import Settings from './routes/Settings.svelte';
  import Nav from './components/Nav.svelte';
  import Toast from './components/Toast.svelte';
  import OfflineBanner from './components/OfflineBanner.svelte';

  session.init();

  // Load (or clear) the household whenever the signed-in user changes.
  let loadedFor: string | null = null;
  $effect(() => {
    const uid = session.userId;
    if (uid === loadedFor) return;
    loadedFor = uid;
    household.reset();
    ledger.reset();
    if (!uid) return;
    household.load().catch((err) => {
      household.loaded = true;
      toasts.error(err);
    });
  });

  // Load the ledger and open the realtime channel once a household exists.
  let ledgerFor: string | null = null;
  $effect(() => {
    const hid = household.household?.id ?? null;
    if (hid === ledgerFor) return;
    ledgerFor = hid;
    ledger.reset();
    if (!hid) return;
    ledger.subscribe(hid);
    ledger.refresh().catch((err) => toasts.error(err));
  });

  // Coming back from the lock screen can outlive the socket. Re-pull rather
  // than trusting that every INSERT arrived while we were backgrounded.
  $effect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && household.household) {
        ledger.refresh().catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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
  <OfflineBanner />
  {#if router.path === '/ledger'}
    <Ledger />
  {:else if router.path === '/summary'}
    <Summary />
  {:else if router.path === '/settings'}
    <Settings />
  {:else}
    <Home />
  {/if}
  <Nav />
{/if}

<Toast />

<style>
  .splash {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    font-size: 14px;
  }
</style>
