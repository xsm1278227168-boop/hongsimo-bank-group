<script lang="ts">
  import { install } from '../lib/install.svelte';

  let { dismissible = false }: { dismissible?: boolean } = $props();

  const visible = $derived(install.available && (!dismissible || !install.dismissed));
</script>

{#if visible}
  <section class="card install">
    <div class="text">
      <p class="title">添加到主屏幕</p>
      <p class="body">
        {#if install.canPrompt}
          装到桌面上，以后一点就开，不用再翻浏览器。
        {:else}
          在 Safari 里点底部的「分享」<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12M12 3 8.5 6.5M12 3l3.5 3.5" />
            <path d="M6 12H4.5v8.5h15V12H18" />
          </svg>，选「添加到主屏幕」，以后一点就开，不用再翻浏览器。
        {/if}
      </p>
    </div>

    <div class="actions">
      {#if install.canPrompt}
        <button class="btn btn-primary btn-sm" onclick={() => install.prompt()}>安装</button>
      {/if}
      {#if dismissible}
        <button class="btn btn-sm btn-quiet" onclick={() => install.dismiss()}>知道了</button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .install {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface-2);
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .body {
    margin: 4px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-dim);
  }

  .glyph {
    width: 13px;
    height: 13px;
    vertical-align: -1px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 0 0 auto;
  }
</style>
