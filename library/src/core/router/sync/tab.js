/**
 * src/core/router/sync/tab.js
 *
 * Cross-tab routing synchronization using BroadcastChannel.
 * Monitors local navigation success events to broadcast route updates,
 * and processes incoming remote broadcasts to keep duplicate tabs in sync.
 *
 * Public controls: start(), stop(), active(), close()
 *
 * Source: doc 09 — Routing §10, plan.md §6
 */

let isSyncing = false;
let sent = ''; // Tracks last sent/received synchronization URL

let channel = null;
let running = false;
let navHandler = null;

function openChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel('native-router-sync');
}

/**
 * Starts cross-tab navigation state synchronization. Idempotent.
 */
export function start(router) {
  if (running) return;
  if (typeof window === 'undefined' || !window.navigation) return;

  channel = channel ?? openChannel();
  if (!channel) return;

  running = true;

  channel.onmessage = (event) => {
    const { type, url, state } = event.data || {};
    if (type === 'sync-navigate') {
      const currentUrl = window.navigation.currentEntry?.url;
      if (currentUrl === url || sent === url) return;

      sent = url;
      isSyncing = true;
      const navResult = router.navigate(url, { state });

      // Delay clearing isSyncing by one macrotask so a guard-triggered redirect
      // (whose URL differs from `sent`) does not slip past the echo guard and
      // re-broadcast, amplifying across every open tab (RT bug 8.5).
      const finish = () => setTimeout(() => { isSyncing = false; }, 0);
      if (navResult?.finished) {
        navResult.finished.then(finish, finish);
      } else {
        finish();
      }
    }
  };

  navHandler = () => {
    if (isSyncing) return;
    const entry = window.navigation.currentEntry;
    if (entry?.url) {
      if (sent === entry.url) return;
      sent = entry.url;
      channel.postMessage({
        type: 'sync-navigate',
        url: entry.url,
        state: typeof entry.getState === 'function' ? entry.getState() : null
      });
    }
  };

  window.navigation.addEventListener('navigatesuccess', navHandler);
}

/**
 * Stops broadcasting and listening without closing the channel.
 * Use start() to resume.
 */
export function stop() {
  if (!running) return;
  running = false;

  if (channel) channel.onmessage = null;
  if (navHandler && typeof window !== 'undefined' && window.navigation) {
    window.navigation.removeEventListener('navigatesuccess', navHandler);
  }
  navHandler = null;
}

/**
 * Returns whether sync is currently active.
 */
export function active() {
  return running;
}

/**
 * Closes the BroadcastChannel and resets all state.
 * Called by router.destroy().
 */
export function close() {
  stop();
  if (channel) {
    channel.close();
    channel = null;
  }
  sent = '';
}

/**
 * Bootstraps cross-tab navigation state synchronization.
 * Kept for back-compat; delegates to start().
 */
export function setupTabSync(router) {
  start(router);
}
