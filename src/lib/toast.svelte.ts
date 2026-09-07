import { humanError } from './errors';

export type ToastKind = 'error' | 'ok';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

let seq = 0;

class Toasts {
  items = $state<Toast[]>([]);

  private push(kind: ToastKind, text: string, ms: number) {
    const id = ++seq;
    this.items = [...this.items, { id, kind, text }];
    setTimeout(() => this.dismiss(id), ms);
  }

  /** Errors linger: they are the one thing the user must not miss. */
  error(err: unknown) {
    this.push('error', humanError(err), 6000);
  }

  ok(text: string) {
    this.push('ok', text, 2500);
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new Toasts();
