/**
 * src/core/state/persist.js
 *
 * Transaction-aware IndexedDB persistence engine.
 * Wraps low-level IDBRequest events with a clean Promise-based facade,
 * manages chronologically ordered schema upgrades inside versionchange transactions,
 * and exposes storage manager quota/persistence handlers.
 *
 * Source: doc 08 — State Management §5, §12, §13, §15
 */

class WriteQueue {
  #queue = Promise.resolve();

  enqueue(task) {
    this.#queue = this.#queue.then(async () => {
      let retries = 3;
      let delay = 50;
      while (retries > 0) {
        try {
          return await task();
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    });
    return this.#queue;
  }
}

export class PlatformStorage {
  #db = null;
  #migrations = [];
  #version = 1;
  #dbName = 'platform-db';
  #writeQueue = new WriteQueue();

  /**
   * Configures custom database name (primarily for test isolation).
   */
  setDatabaseName(name) {
    this.#dbName = name;
  }

  /**
   * Registers custom schema migration handlers.
   * Migrations are index-mapped to the sequential schema upgrades (oldVersion -> N).
   */
  registerMigrations(migrations) {
    this.#migrations = migrations;
    this.#version = migrations.length + 1;
  }

  /**
   * Connects to IndexedDB, evaluating upgrades sequentially inside transactions.
   */
  async open() {
    if (this.#db) return this.#db;

    return new Promise((resolve, reject) => {
      const request = this.#migrations.length > 0
        ? indexedDB.open(this.#dbName, this.#version)
        : indexedDB.open(this.#dbName);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;
        const oldVersion = event.oldVersion;

        for (let i = oldVersion; i < this.#migrations.length; i++) {
          try {
            this.#migrations[i](db, tx);
          } catch (err) {
            console.error(`Storage schema migration failed for version v${i + 1}:`, err);
            tx.abort();
            return reject(err);
          }
        }
      };

      request.onsuccess = (event) => {
        this.#db = event.target.result;
        resolve(this.#db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Retrieves a record from a specific store by its key.
   */
  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = async () => {
        const res = request.result;
        if (res && typeof res === 'object' && 'value' in res && 'lastAccessed' in res) {
          try {
            await this.#updateAccess(storeName, key, res);
          } catch (err) {
            console.error('Failed to update access timestamp:', err);
          }
          resolve(res.value);
        } else {
          resolve(res || null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async #updateAccess(storeName, key, envelope) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      envelope.lastAccessed = Date.now();
      const req = store.put(envelope, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Adds or updates a record inside a specific store.
   */
  async set(storeName, key, value, options = {}) {
    return this.#writeQueue.enqueue(async () => {
      const db = await this.open();
      await this.#checkAndEvict(storeName);

      const envelope = {
        value,
        lastAccessed: Date.now(),
        expires: options.ttl ? Date.now() + options.ttl : null
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        // key is optional if store has inline keyPath
        const request = key ? store.put(envelope, key) : store.put(envelope);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async #checkAndEvict(storeName) {
    const estimate = await this.estimate();
    if (!estimate.quota || !estimate.usage) return;

    const ratio = estimate.usage / estimate.quota;
    if (ratio > 0.8) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('quota', {
          detail: { usage: estimate.usage, quota: estimate.quota }
        }));
      }

      const db = await this.open();
      if (!db.objectStoreNames.contains(storeName)) return;

      const records = await new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const list = [];
        store.openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            list.push({ key: cursor.key, envelope: cursor.value });
            cursor.continue();
          } else {
            resolve(list);
          }
        };
      });

      const now = Date.now();
      const expired = records.filter(
        (r) => r.envelope && typeof r.envelope === 'object' && r.envelope.expires && r.envelope.expires < now
      );

      if (expired.length > 0) {
        await Promise.all(expired.map((r) => this.delete(storeName, r.key)));
        const newEst = await this.estimate();
        if ((newEst.usage / newEst.quota) <= 0.8) return;
      }

      const activeWrapped = records
        .filter((r) => r.envelope && typeof r.envelope === 'object' && 'lastAccessed' in r.envelope)
        .sort((a, b) => a.envelope.lastAccessed - b.envelope.lastAccessed);

      for (const record of activeWrapped) {
        await this.delete(storeName, record.key);
        const newEst = await this.estimate();
        if ((newEst.usage / newEst.quota) <= 0.8) break;
      }
    }
  }

  /**
   * Deletes a record from a specific store.
   */
  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Resolves a filtered list of records from a specific store.
   */
  async query(storeName, queryFn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const unwrapped = results.map((res) => {
          if (res && typeof res === 'object' && 'value' in res && 'lastAccessed' in res) {
            return res.value;
          }
          return res;
        });
        resolve(queryFn ? unwrapped.filter(queryFn) : unwrapped);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Fetches browser disk space allocation parameters for this origin.
   */
  async estimate() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate();
    }
    return { quota: 0, usage: 0 };
  }

  /**
   * Requests origin storage to be marked as persistent (exempt from browser eviction).
   */
  async persist() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      return navigator.storage.persist();
    }
    return false;
  }

  /**
   * Checks whether the origin has persistent storage enabled.
   */
  async isPersisted() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return navigator.storage.persisted();
    }
    return false;
  }
}

export const storage = new PlatformStorage();
