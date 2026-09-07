<script lang="ts">
  import { router } from '../lib/router.svelte';

  const TABS = [
    { path: '/', label: '首页', d: 'M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { path: '/ledger', label: '流水', d: 'M5 3.5h14v17l-3.5-2-3.5 2-3.5-2-3.5 2zM8.5 9h7M8.5 13h7' },
    { path: '/summary', label: '汇总', d: 'M6 20v-6.5M12 20V4.5M18 20v-9.5' },
    {
      path: '/settings',
      label: '设置',
      d: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.05A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.05A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.05A1.7 1.7 0 0 0 15.1 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.05a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.05a1.7 1.7 0 0 0-1.55 1.02z'
    }
  ];
</script>

<nav>
  {#each TABS as tab (tab.path)}
    <button
      class="tab"
      aria-current={router.path === tab.path ? 'page' : undefined}
      onclick={() => router.go(tab.path)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={tab.d} />
      </svg>
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    margin: 0 auto;
    max-width: var(--max-w);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--nav-bg);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-top: 1px solid var(--border);
    padding-bottom: var(--safe-b);
  }

  .tab {
    border: 0;
    background: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: var(--nav-h);
    color: var(--text-faint);
    font-size: 10.5px;
    letter-spacing: 0.02em;
    transition: color 0.14s ease;
  }

  .tab[aria-current='page'] {
    color: var(--text);
  }

  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tab[aria-current='page'] svg {
    stroke-width: 1.9;
  }

  .tab:active svg {
    transform: scale(0.92);
  }
</style>
