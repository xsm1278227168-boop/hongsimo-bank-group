<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { Snippet } from 'svelte';

  let {
    open = false,
    title,
    confirmText = '确定',
    cancelText = '取消',
    danger = false,
    busy = false,
    onconfirm,
    oncancel,
    children
  }: {
    open?: boolean;
    title: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    busy?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
    children?: Snippet;
  } = $props();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !busy) oncancel();
  }
</script>

<svelte:window onkeydown={open ? onkeydown : undefined} />

{#if open}
  <div class="scrim" role="presentation" onclick={() => !busy && oncancel()} transition:fade={{ duration: 140 }}></div>
  <div class="dialog" role="alertdialog" aria-modal="true" aria-label={title} transition:scale={{ duration: 160, start: 0.94 }}>
    <h2>{title}</h2>
    {#if children}
      <div class="body">{@render children()}</div>
    {/if}
    <div class="actions">
      <button class="btn" onclick={oncancel} disabled={busy}>{cancelText}</button>
      <button class="btn" class:btn-danger={danger} class:btn-primary={!danger} onclick={onconfirm} disabled={busy}>
        {busy ? '处理中…' : confirmText}
      </button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(10, 11, 13, 0.42);
    z-index: 55;
  }

  .dialog {
    position: fixed;
    z-index: 56;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(calc(100vw - 48px), 360px);
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: 0 24px 60px rgba(10, 11, 13, 0.34);
    padding: 20px;
  }

  h2 {
    font-size: 17px;
    margin: 0 0 8px;
  }

  .body {
    font-size: 14px;
    color: var(--text-dim);
    line-height: 1.6;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 20px;
  }
</style>
