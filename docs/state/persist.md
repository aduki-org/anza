# Persist

`PlatformStorage` provides transactional IndexedDB persistence for reactive state. It supports schema migrations, TTL-based expiry, and automatic eviction when storage quota exceeds 80%.

---

## Basic Use

```javascript
import { state } from '@adukiorg/anza/state';

// Write
await state.storage.set('keyval', 'user', { name: 'Alice' });

// Read
const user = await state.storage.get('keyval', 'user');

// Delete
await state.storage.delete('keyval', 'user');
```

---

## Schema Migrations

Register migration functions before opening the database:

```javascript
state.storage.registerMigrations([
  (db, tx) => {
    // Version 1 -> 2
    db.createObjectStore('settings');
  },
  (db, tx) => {
    // Version 2 -> 3
    db.createObjectStore('sessions');
  }
]);
```

Migrations run sequentially inside `onupgradeneeded`. Each function corresponds to one version step.

---

## TTL

```javascript
// Cache for 60 seconds
await state.storage.set('keyval', 'token', 'abc123', { ttl: 60000 });

// After expiry, get returns null
await state.storage.get('keyval', 'token'); // null if expired
```

---

## Quota-Aware Eviction

When storage usage exceeds 80% of quota:

1. Expired entries are deleted first
2. If still over threshold, least-recently-accessed entries are evicted
3. A `quota` event is dispatched on `window`:

```javascript
window.addEventListener('quota', (e) => {
  console.log('Quota warning:', e.detail.usage, e.detail.quota);
});
```

---

## Query

```javascript
const items = await state.storage.query('keyval', (value) => {
  return value && value.active === true;
});
```

Returns all records matching the filter function.

---

## Persistence

Request durable storage (exempt from browser eviction):

```javascript
const granted = await state.storage.persist();
console.log('Persistent storage:', granted);
```

---

## Database Name

For test isolation:

```javascript
state.storage.setDatabaseName('test-db');
```
