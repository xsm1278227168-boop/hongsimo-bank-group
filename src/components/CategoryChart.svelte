<script lang="ts">
  import { money, toNum } from '../lib/format';

  let {
    data,
    currency
  }: { data: { category: string; total: number }[]; currency: string } = $props();

  const ROW = 40;
  const BAR = 15;
  const LABEL_H = 17;

  let width = $state(0);

  const rows = $derived([...data].sort((a, b) => toNum(b.total) - toNum(a.total)));
  const height = $derived(rows.length * ROW);

  // A reversal is dated the day it is made, so it can land in a later month
  // than the expense it cancels and push a category negative. Anchor the axis
  // at zero so those read as what they are instead of as small positives.
  const min = $derived(Math.min(0, ...rows.map((r) => toNum(r.total))));
  const max = $derived(Math.max(0, ...rows.map((r) => toNum(r.total))));
  const span = $derived(max - min || 1);

  const x = $derived((v: number) => ((v - min) / span) * width);
  const zero = $derived(x(0));
</script>

<div class="wrap" bind:clientWidth={width}>
  {#if width > 0 && rows.length}
    <svg {width} height={height} viewBox="0 0 {width} {height}" role="img" aria-label="按类别的本月支出">
      {#each rows as r, i (r.category)}
        {@const v = toNum(r.total)}
        {@const xv = x(v)}
        {@const y = i * ROW}
        <text class="cat" x="0" y={y + 12}>{r.category}</text>
        <text class="val" x={width} y={y + 12} text-anchor="end">{money(v, currency)}</text>
        <rect class="track" x="0" y={y + LABEL_H} width={width} height={BAR} rx={BAR / 2} />
        <!-- A small radius, not a pill: SVG clamps rx to half the width, which
             turns a narrow bar into a lozenge. -->
        <rect
          class="bar"
          class:neg={v < 0}
          x={Math.min(zero, xv)}
          y={y + LABEL_H}
          width={Math.max(3, Math.abs(xv - zero))}
          height={BAR}
          rx="3"
        />
      {/each}
      {#if min < 0}
        <line class="axis" x1={zero} y1="0" x2={zero} y2={height} />
      {/if}
    </svg>
  {/if}
</div>

<style>
  .wrap {
    width: 100%;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .cat {
    font-size: 13px;
    fill: var(--text);
  }

  .val {
    font-size: 12.5px;
    fill: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .track {
    fill: var(--surface-sunken);
  }

  .bar {
    fill: var(--text);
  }

  .bar.neg {
    fill: var(--negative);
  }

  .axis {
    stroke: var(--border-strong);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
</style>
