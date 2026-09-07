interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'hsm.installDismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac; touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Getting onto the home screen is the difference between "open the browser and
 * find the tab" and one tap, so the prompt is a first-class part of the app
 * rather than something left to the user to discover.
 */
class Install {
  deferred = $state<BeforeInstallPromptEvent | null>(null);
  installed = $state(false);
  dismissed = $state(false);

  readonly ios = isIOS();

  constructor() {
    this.installed = isStandalone();
    try {
      this.dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      this.dismissed = false;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // keep Chrome's own mini-infobar out of the way
      this.deferred = e as BeforeInstallPromptEvent;
    });

    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferred = null;
    });
  }

  /** Chrome/Edge/Android can install in-place; iOS needs the manual steps. */
  get canPrompt(): boolean {
    return !!this.deferred;
  }

  get available(): boolean {
    return !this.installed && (this.canPrompt || this.ios);
  }

  async prompt() {
    const e = this.deferred;
    if (!e) return;
    this.deferred = null;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') this.installed = true;
  }

  dismiss() {
    this.dismissed = true;
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — it will just ask again next time */
    }
  }
}

export const install = new Install();
