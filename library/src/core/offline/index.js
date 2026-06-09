/**
 * src/core/offline/index.js
 *
 * Public offline base entry point.
 * Combines Service Worker messaging, IndexedDB task queuing, Background Sync execution,
 * and reliable HEAD-probe connectivity monitors.
 *
 * Source: doc 13 — Offline and Background §1, §3
 */

import { check, subscribe } from './connectivity.js';
import { queue } from './queue.js';
import { sync } from './sync.js';
import { bridge } from './bridge.js';
import { state } from './state.js';
import { actor, tick, sync as clockSync, stamp } from './clock.js';

export const clock = {
  actor,
  tick,
  sync: clockSync,
  stamp
};

export const offline = {
  check,
  subscribe,
  queue,
  sync,
  state,
  clock,
  /**
   * Shorthand to send messages directly to the active Service Worker bridge.
   */
  send(task, payload) {
    return bridge.send(task, payload);
  }
};

export { check, subscribe, queue, sync, bridge, state };

