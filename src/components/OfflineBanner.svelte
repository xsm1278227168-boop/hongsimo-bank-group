<script lang="ts">
  import { network } from '../lib/network.svelte';
</script>

{#if !network.online}
  <div class="banner" role="status">离线中 · 只能查看，暂时不能记账</div>
{/if}

<style>
  .banner {
    position: sticky;
    top: 0;
    z-index: 30;
    margin: 0 auto;
    max-width: var(--max-w);
    background: var(--warn-bg);
    color: var(--warn-text);
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    padding: calc(9px + var(--safe-t)) 12px 9px;
    border-bottom: 1px solid color-mix(in srgb, var(--warn-text) 22%, transparent);
  }
</style>
