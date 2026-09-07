<script lang="ts">
  import { untrack } from 'svelte';
  import { household } from '../lib/household.svelte';
  import { ledger } from '../lib/ledger.svelte';
  import { network } from '../lib/network.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { todayISO } from '../lib/format';
  import type { UUID } from '../lib/types';

  export interface EntryInit {
    amount?: number;
    payer_id?: UUID;
    payer_share?: number;
    category?: string | null;
    occurred_on?: string;
    note?: string | null;
  }

  let {
    initial,
    submitText = '记一笔',
    autofocus = false,
    onDone
  }: {
    initial?: EntryInit;
    submitText?: string;
    autofocus?: boolean;
    onDone?: () => void;
  } = $props();

  type SplitMode = 'even' | 'payer' | 'other' | 'custom';

  const LAST_CATEGORY_KEY = 'hsm.lastCategory';

  function readLastCategory(): string | null {
    try {
      return localStorage.getItem(LAST_CATEGORY_KEY);
    } catch {
      return null;
    }
  }

  function rememberCategory(name: string | null) {
    try {
      if (name) localStorage.setItem(LAST_CATEGORY_KEY, name);
    } catch {
      /* private mode — the default just won't stick */
    }
  }

  function modeOf(share: number | undefined): SplitMode {
    if (share === undefined) return 'even';
    if (share === 0.5) return 'even';
    if (share === 1) return 'payer';
    if (share === 0) return 'other';
    return 'custom';
  }

  // `initial` seeds the form once. Reading it untracked says so explicitly:
  // later changes should not clobber what the user has already typed.
  const seed: EntryInit = untrack(() => initial ?? {});

  function initialCategory(): string | null {
    if (seed.category !== undefined) return seed.category;
    const active = household.activeCategories;
    const last = readLastCategory();
    if (last && active.some((c) => c.name === last)) return last;
    return active[0]?.name ?? null;
  }

  const meId = household.me?.user_id ?? '';

  let amountText = $state(seed.amount != null ? String(seed.amount) : '');
  let payerId = $state<string>(seed.payer_id ?? meId);
  let split = $state<SplitMode>(modeOf(seed.payer_share));
  let customPct = $state(
    seed.payer_share != null && modeOf(seed.payer_share) === 'custom'
      ? Math.round(seed.payer_share * 1000) / 10
      : 50
  );
  let category = $state<string | null>(initialCategory());
  let occurredOn = $state(seed.occurred_on ?? todayISO());
  let note = $state(seed.note ?? '');
  let busy = $state(false);

  const partner = $derived(household.partner);

  const amount = $derived.by(() => {
    const cleaned = amountText.replace(/[^\d.]/g, '');
    if (!cleaned || cleaned === '.') return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  });

  const payerShare = $derived(
    split === 'even'
      ? 0.5
      : split === 'payer'
        ? 1
        : split === 'other'
          ? 0
          : Math.min(100, Math.max(0, customPct)) / 100
  );

  const payerIsMe = $derived(payerId === meId);
  const canSubmit = $derived(amount !== null && !busy && network.online && !!payerId);

  /** Who ends up owing whom, spelled out so the split choice is unambiguous. */
  const preview = $derived.by(() => {
    if (amount === null) return '';
    const owed = Math.round(amount * (1 - payerShare) * 100) / 100;
    const payerName = payerIsMe ? '你' : (partner?.display_name ?? '对方');
    const otherName = payerIsMe ? (partner?.display_name ?? '对方') : '你';
    if (owed === 0) return `${payerName}自己承担全部`;
    if (owed === amount) return `${otherName}承担全部`;
    return `${otherName} 承担 ${owed.toFixed(2)}`;
  });

  function focusOnMount(el: HTMLInputElement) {
    if (autofocus) el.focus();
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit || amount === null) return;
    busy = true;
    try {
      await ledger.add({
        occurred_on: occurredOn,
        amount,
        payer_id: payerId,
        payer_share: payerShare,
        category,
        note: note.trim() || null
      });
      rememberCategory(category);
      toasts.ok('已记一笔');
      // Keep payer / split / category: the next entry is usually similar.
      amountText = '';
      note = '';
      occurredOn = todayISO();
      onDone?.();
    } catch (err) {
      toasts.error(err);
    } finally {
      busy = false;
    }
  }
</script>

<form class="card" onsubmit={submit}>
  <div class="amount-row">
    <span class="sym">{household.currency === 'CNY' ? '¥' : household.currency}</span>
    <input
      class="amount num"
      type="text"
      inputmode="decimal"
      enterkeyhint="done"
      placeholder="0.00"
      autocomplete="off"
      bind:value={amountText}
      use:focusOnMount
      aria-label="金额"
    />
  </div>

  <div class="block">
    <span class="label">付款人</span>
    <div class="segmented">
      <button type="button" aria-pressed={payerIsMe} onclick={() => (payerId = meId)}>我</button>
      <button
        type="button"
        aria-pressed={!payerIsMe}
        disabled={!partner}
        onclick={() => partner && (payerId = partner.user_id)}
      >
        {partner?.display_name ?? '对方'}
      </button>
    </div>
  </div>

  <div class="block">
    <span class="label">拆分</span>
    <div class="chips">
      <button type="button" class="chip" aria-pressed={split === 'even'} onclick={() => (split = 'even')}>
        平摊
      </button>
      <button type="button" class="chip" aria-pressed={split === 'payer'} onclick={() => (split = 'payer')}>
        全归付款人
      </button>
      <button type="button" class="chip" aria-pressed={split === 'other'} onclick={() => (split = 'other')}>
        全归对方
      </button>
      <button type="button" class="chip" aria-pressed={split === 'custom'} onclick={() => (split = 'custom')}>
        自定义
      </button>
    </div>
    {#if split === 'custom'}
      <div class="pct">
        <span>付款人承担</span>
        <input
          class="input pct-input num"
          type="number"
          inputmode="numeric"
          min="0"
          max="100"
          step="1"
          bind:value={customPct}
          aria-label="付款人承担百分比"
        />
        <span>%</span>
      </div>
    {/if}
    {#if preview}
      <p class="preview">{preview}</p>
    {/if}
  </div>

  {#if household.activeCategories.length}
    <div class="block">
      <span class="label">类别</span>
      <div class="chips">
        {#each household.activeCategories as c (c.id)}
          <button
            type="button"
            class="chip"
            aria-pressed={category === c.name}
            onclick={() => (category = c.name)}>{c.name}</button
          >
        {/each}
      </div>
    </div>
  {/if}

  <div class="meta">
    <input class="input date" type="date" bind:value={occurredOn} aria-label="日期" />
    <input class="input" type="text" placeholder="备注（可选）" maxlength="80" bind:value={note} />
  </div>

  <button class="btn btn-primary btn-block" disabled={!canSubmit}>
    {busy ? '保存中…' : !network.online ? '离线中，暂时不能记账' : submitText}
  </button>
</form>

<style>
  .amount-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }

  .sym {
    font-size: 22px;
    color: var(--text-faint);
    font-weight: 500;
  }

  input.amount {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    padding: 0;
    font-size: 38px;
    font-weight: 650;
    letter-spacing: -0.03em;
    outline: none;
  }

  input.amount::placeholder {
    color: var(--text-faint);
    opacity: 0.55;
  }

  .block {
    margin-bottom: 16px;
  }

  .pct {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    font-size: 14px;
    color: var(--text-dim);
  }

  .pct-input {
    width: 88px;
    text-align: center;
    min-height: 42px;
  }

  .preview {
    margin: 9px 2px 0;
    font-size: 12.5px;
    color: var(--text-faint);
  }

  .meta {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .date {
    flex: 0 0 auto;
    width: 46%;
  }

  .meta > .input:last-child {
    flex: 1;
    min-width: 0;
  }
</style>
