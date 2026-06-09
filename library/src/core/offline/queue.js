/**
 * src/core/offline/queue.js
 *
 * Offline Operations Journal.
 * Manages an IndexedDB-backed task queue to serialize, buffer, and track background
 * tasks when offline, enforcing idempotency keys and retry limits.
 *
 * Source: doc 13 — Offline and Background §5
 */

import { Database } from '../storage/idb.js';
import { state } from './state.js';
import { quota } from '../storage/quota.js';
import { uuid } from '../security/index.js';

const db = new Database('platform-offline-queue', 1, [
  (dbInstance) => {
    dbInstance.createObjectStore('tasks');
  }
]);

// Replay uncommitted tasks from localStorage journal
async function replayJournal() {
  if (typeof localStorage === 'undefined') return;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('offline:journal:')) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const item = JSON.parse(raw);
          console.log(`Replaying offline queue journal task: ${item.id}`);
          await db.set('tasks', item.id, item);
        }
      } catch (err) {
        console.error(`Failed to replay offline journal entry ${k}:`, err);
      }
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }
}

// Update the reactive state pending task count
async function syncPending() {
  try {
    const list = await db.getAll('tasks');
    state.set('pending', list.length);
  } catch (err) {
    console.error('Failed to sync pending queue count:', err);
  }
}

// Boot setup
if (typeof window !== 'undefined') {
  Promise.resolve().then(async () => {
    try {
      await db.open();
      await replayJournal();
      await syncPending();
    } catch (err) {
      console.error('Failed to initialize offline queue boot setup:', err);
    }
  });
}

export class OfflineQueue {
  /**
   * Enqueues an offline task with idempotency controls.
   */
  async push(taskName, payload = null, options = {}) {
    // Proactive quota check; usage > 80% blocks enqueuing
    const isExceeded = await quota.check();
    if (isExceeded) {
      throw new DOMException('Storage quota limit exceeded (usage > 80%)', 'QuotaExceededError');
    }

    await db.open();
    const id = options.idempotencyKey || uuid();

    const item = {
      id,
      task: taskName,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries ?? 5
    };

    const journalKey = `offline:journal:${id}`;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(journalKey, JSON.stringify(item));
      } catch (err) {
        console.warn('Failed to write offline journal:', err);
      }
    }

    try {
      await db.set('tasks', id, item);
      await syncPending();
    } finally {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(journalKey);
      }
    }

    return id;
  }

  /**
   * Retrieves all items currently stored in the queue.
   */
  async list() {
    await db.open();
    const list = await db.getAll('tasks');
    // Sort oldest tasks first for chronological processing
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Updates a task state in the queue.
   */
  async update(task) {
    await db.open();
    const journalKey = `offline:journal:${task.id}`;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(journalKey, JSON.stringify(task));
      } catch (err) {
        console.warn('Failed to write offline journal on update:', err);
      }
    }

    try {
      await db.set('tasks', task.id, task);
      await syncPending();
    } finally {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(journalKey);
      }
    }
  }

  /**
   * Evicts a resolved task from the queue.
   */
  async delete(id) {
    await db.open();
    await db.delete('tasks', id);
    await syncPending();
  }

  /**
   * Fully clears the queue.
   */
  async clear() {
    await db.open();
    await db.clear('tasks');
    await syncPending();
  }
}

export const queue = new OfflineQueue();

