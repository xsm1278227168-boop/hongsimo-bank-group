/** PostgREST can hand numerics back as strings; normalise before any display. */
export function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const fmtCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  let f = fmtCache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } catch {
      // Unknown ISO code: fall back to a bare number rather than throwing.
      f = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    fmtCache.set(currency, f);
  }
  return f;
}

const plainFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/** 千分位 + 2 位小数 + 货币符号。 */
export function money(v: unknown, currency: string): string {
  return currencyFormatter(currency).format(toNum(v));
}

/** 千分位 + 2 位小数，不带符号（表格、CSV 之外的紧凑场合）。 */
export function plain(v: unknown): string {
  return plainFormatter.format(toNum(v));
}

/**
 * 'YYYY-MM-DD' → local Date. Avoids the UTC shift of new Date('YYYY-MM-DD').
 * Slices first so a full timestamp does not silently render as NaN月NaN日.
 */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → '9月7日 周一' */
export function dayLabel(iso: string): string {
  const d = parseDay(iso);
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
}

/** 'YYYY-MM-DD' or 'YYYY-MM' → '2026年9月' */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${y}年${m}月`;
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 'YYYY-MM' → ['YYYY-MM-01', 'YYYY-MM-01' of the next month) */
export function monthRange(key: string): { from: string; toExclusive: string } {
  const [y, m] = key.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return { from: `${y}-${pad(m)}-01`, toExclusive: `${nextY}-${pad(nextM)}-01` };
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** payer_share → 拆分预设的 UI 标签 */
export function splitLabel(share: unknown): string {
  const s = toNum(share);
  if (s === 0.5) return '平摊';
  if (s === 1) return '全归付款人';
  if (s === 0) return '全归对方';
  return `付款人担 ${Math.round(s * 1000) / 10}%`;
}
