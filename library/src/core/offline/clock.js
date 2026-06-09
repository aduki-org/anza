/**
 * src/core/offline/clock.js
 *
 * Logical Lamport Clock Engine.
 * Manages persistent client actor UUIDs and monotonic logical counters
 * for conflict-free write replication.
 *
 * Source: doc 13 — Offline and Background §4
 */

import { storage } from '../storage/index.js';
import { uuid } from '../security/index.js';

let currentClock = 0;
let currentActor = '';
let initialized = false;
let initPromise = null;

/**
 * Initializes the logical clock engine.
 */
export async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let actorVal = await storage.get('offline:actor', 'idb');
      if (!actorVal) {
        actorVal = uuid();
        await storage.set('offline:actor', actorVal, 'idb');
      }
      currentActor = actorVal;

      const clockVal = await storage.get('offline:clock', 'idb');
      if (typeof clockVal === 'number') {
        currentClock = clockVal;
      } else {
        currentClock = 0;
        await storage.set('offline:clock', 0, 'idb');
      }
      initialized = true;
    } catch (err) {
      console.error('Failed to initialize logical clock:', err);
      if (!currentActor) currentActor = uuid();
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

// Auto-boot init
if (typeof window !== 'undefined') {
  Promise.resolve().then(() => init().catch(console.error));
}

/**
 * Returns the persistent actor UUID for this client.
 */
export async function actor() {
  await init();
  return currentActor;
}

/**
 * Increments and returns the logical clock count.
 */
export async function tick() {
  await init();
  currentClock++;
  storage.set('offline:clock', currentClock, 'idb').catch((err) => {
    console.warn('Failed to persist logical clock:', err);
  });
  return currentClock;
}

/**
 * Synchronizes the local clock against a remote clock.
 */
export async function sync(remoteTime) {
  await init();
  if (remoteTime > currentClock) {
    currentClock = remoteTime + 1;
    storage.set('offline:clock', currentClock, 'idb').catch((err) => {
      console.warn('Failed to persist synchronized logical clock:', err);
    });
  }
  return currentClock;
}

/**
 * Generates a logical clock stamp.
 */
export async function stamp() {
  const act = await actor();
  const clk = await tick();
  return { actor: act, clock: clk };
}
