<script lang="ts">
  import { toasts } from '../lib/toast.svelte';
</script>

<div class="wrap" role="status" aria-live="polite">
  {#each toasts.items as t (t.id)}
    <button class="toast {t.kind}" onclick={() => toasts.dismiss(t.id)}>{t.text}</button>
  {/each}
</div>

<style>
  .wrap {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(76px + env(safe-area-inset-bottom, 0px));
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    width: 100%;
    max-width: 456px;
    text-align: left;
    border-radius: 10px;
    padding: 11px 14px;
    font-size: 14px;
    line-height: 1.45;
    border: 1px solid;
    box-shadow: 0 6px 20px rgba(17, 24, 39, 0.16);
  }

  .toast.error {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .toast.ok {
    background: #ecfdf5;
    border-color: #6ee7b7;
    color: #065f46;
  }
</style>
