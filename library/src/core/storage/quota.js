/**
 * src/core/storage/quota.js
 *
 * Storage Quota Manager.
 * Wraps browser StorageManager API, providing space estimations,
 * persistence requests, and an active 80% usage eviction warning trigger.
 *
 * Source: doc 22 — Storage Architecture §6
 */

import { supports } from '../platform/index.js';

export class QuotaManager {
  #listeners = new Set();

  /**
   * Subscribes a handler to quota warning events.
   */
  onQuotaWarning(handler) {
    this.#listeners.add(handler);
    return () => {
      this.#listeners.delete(handler);
    };
  }

  /**
   * Fetches the current storage usage and quota estimates.
   */
  async estimate() {
    if (supports.storageManager && navigator.storage?.estimate) {
      return navigator.storage.estimate();
    }
    return { usage: 0, quota: 0 };
  }

  /**
   * Requests the browser to allow persistent storage (avoiding auto-eviction).
   */
  async persist() {
    if (supports.storagePersistence) {
      return navigator.storage.persist();
    }
    return false;
  }

  /**
   * Assesses usage against the threshold. Calls trigger hook if capacity > 80%.
   */
  async check(onEvictionWarning) {
    const { usage, quota } = await this.estimate();
    if (quota > 0 && usage / quota > 0.8) {
      const data = { usage, quota };
      if (typeof onEvictionWarning === 'function') {
        onEvictionWarning(data);
      }
      for (const listener of this.#listeners) {
        try {
          listener(data);
        } catch (err) {
          console.error('Error invoking quota warning listener:', err);
        }
      }
      return true;
    }
    return false;
  }
}

export const quota = new QuotaManager();
