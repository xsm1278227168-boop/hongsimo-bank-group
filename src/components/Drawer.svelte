<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';

  let {
    open = false,
    title,
    onclose,
    children
  }: { open?: boolean; title?: string; onclose: () => void; children: Snippet } = $props();

  // Keep the page behind the sheet from scrolling under the finger.
  $effect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={open ? onkeydown : undefined} />

{#if open}
  <div
    class="scrim"
    role="presentation"
    onclick={onclose}
    transition:fade={{ duration: 160 }}
  ></div>

  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    transition:fly={{ y: 420, duration: 240, opacity: 1 }}
  >
    <div class="grip" aria-hidden="true"></div>
    {#if title}
      <header>
        <h2>{title}</h2>
        <button class="close" onclick={onclose} aria-label="关闭">✕</button>
      </header>
    {/if}
    <div class="body">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(10, 11, 13, 0.42);
    z-index: 50;
  }

  .sheet {
    position: fixed;
    z-index: 51;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0 auto;
    max-width: var(--max-w);
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    box-shadow: var(--shadow-lg);
    padding-bottom: var(--safe-b);
  }

  .grip {
    width: 38px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-strong);
    margin: 9px auto 2px;
    flex: 0 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px 12px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
  }

  .close {
    border: 0;
    background: var(--surface-sunken);
    color: var(--text-dim);
    width: 32px;
    height: 32px;
    border-radius: 999px;
    font-size: 13px;
    line-height: 1;
    display: grid;
    place-items: center;
  }

  .body {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
  }
</style>
