/**
 * Hash routing. GitHub Pages has no rewrite rules, and a hash route needs no
 * 404.html fallback; it also keeps deep links working under the /<repo>/ base.
 */

export type Path = '/login' | '/onboarding' | '/' | '/ledger' | '/summary' | '/settings';

function read(): string {
  const raw = location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/';
}

class Router {
  path = $state(read());

  constructor() {
    window.addEventListener('hashchange', () => {
      this.path = read();
    });
  }

  go(path: string, replace = false) {
    if (read() === path) return;
    if (replace) location.replace('#' + path);
    else location.hash = path;
    this.path = read();
  }
}

export const router = new Router();
