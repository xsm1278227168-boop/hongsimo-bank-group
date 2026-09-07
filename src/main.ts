import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { session } from './lib/session.svelte';
import { household } from './lib/household.svelte';
import { ledger } from './lib/ledger.svelte';
import { router } from './lib/router.svelte';

if (import.meta.env.DEV) {
  // Dev-only handle for poking at state from the console. Stripped from builds.
  Object.assign(window, { __stores: { session, household, ledger, router } });
}

export default mount(App, { target: document.getElementById('app')! });
