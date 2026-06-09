# API Reference

Complete reference for the storage facade and internal classes.

---

## Facade

```javascript
import { storage } from '@adukiorg/anza/storage';
```

### `storage.configure(options)`

Reconfigure pools before first use.

```javascript
storage.configure({
  idb: { name: 'my-app', version: 2, migrations: [] },
  lru: { maxSize: 500 },
  cache: { name: 'my-cache' }
});
```

### `storage.get(key, tierOrOptions)`

Read from a tier.

```javascript
await storage.get('name');           // default idb
await storage.get('name', 'memory');
await storage.get('name', { tier: 'idb' });
```

### `storage.set(key, value, tierOrOptions)`

Write to a tier.

```javascript
await storage.set('name', 'Alice');
await storage.set('name', 'Alice', 'memory');
await storage.set('name', 'Alice', { tier: 'idb', ttl: 60000 });
```

### `storage.delete(key, tierOrOptions)`

Remove from a tier.

### `storage.query(storeName, filterFn)`

Query IDB store with filter.

---

## Database

```javascript
import { Database } from '@adukiorg/anza/storage';
```

### `new Database(name, version, migrations)`

### `db.open()`

Returns `Promise<IDBDatabase>`.

### `db.get(storeName, key)`

### `db.set(storeName, key, value)`

### `db.delete(storeName, key)`

### `db.clear(storeName)`

### `db.getAll(storeName)`

### `db.keys(storeName)`

### `db.query(storeName, options)`

Options: `{ index, range, direction, limit }`.

### `db.transaction(storeNames, mode, callback)`

Multi-store transactional callback.

---

## CacheStorage

```javascript
import { CacheStorage } from '@adukiorg/anza/storage';
```

### `new CacheStorage(name)`

### `cache.get(request)`

Returns `Promise<Response | null>`.

### `cache.set(request, response, ttlMs)`

### `cache.delete(request)`

### `cache.clear()`

---

## LRUCache

### `new LRUCache(maxSize)`

### `cache.get(key)`

### `cache.set(key, value, ttlMs)`

### `cache.delete(key)`

### `cache.clear()`

---

## WeakLRUCache

### `new WeakLRUCache(maxSize)`

Values must be objects or functions.

---

## QuotaManager

```javascript
import { quota } from '@adukiorg/anza/storage';
```

### `quota.estimate()`

### `quota.persist()`

### `quota.check(onWarning)`

### `quota.onQuotaWarning(handler)`
