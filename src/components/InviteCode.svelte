<script lang="ts">
  import { toasts } from '../lib/toast.svelte';

  let { code }: { code: string } = $props();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toasts.ok('邀请码已复制');
    } catch {
      // Clipboard API needs a secure context; the code is on screen anyway.
      toasts.error('复制失败，请手动记下邀请码。');
    }
  }
</script>

<div class="row">
  <div>
    <span class="label">邀请码</span>
    <code>{code}</code>
  </div>
  <button class="btn" onclick={copy}>复制</button>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .label {
    display: block;
    font-size: 13px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 22px;
    letter-spacing: 0.16em;
    user-select: all;
  }
</style>
