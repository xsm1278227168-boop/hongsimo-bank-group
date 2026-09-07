class Network {
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    window.addEventListener('online', () => (this.online = true));
    window.addEventListener('offline', () => (this.online = false));
  }
}

export const network = new Network();
