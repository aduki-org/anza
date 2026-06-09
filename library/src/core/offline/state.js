/**
 * src/core/offline/state.js
 *
 * Reactive state store for connectivity and queue metrics.
 *
 * Source: doc 08 — State Management, doc 13 — Offline and Background
 */

import { ReactiveStore } from '../state/store.js';

const isBrowser = typeof navigator !== 'undefined';
const initOnline = isBrowser ? navigator.onLine : true;

export const state = new ReactiveStore({
  online: initOnline,
  status: initOnline ? 'online' : 'offline',
  pending: 0
});
