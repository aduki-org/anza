# Troubleshooting

Common problems and their solutions.

---

## storage.get returns null

**Cause:** Key never set, expired, or wrong tier.

**Fix:** Check tier and TTL:

```javascript
// Wrong tier — wrote to 'memory', reading from default 'idb'
await storage.set('temp', data, 'memory');
await storage.get('temp'); // null — reads from idb

// Correct
await storage.get('temp', 'memory');
```

---

## IndexedDB blocked

**Cause:** Another tab has an older version open.

**Fix:** Listen for blocked events and close other tabs:

```javascript
window.addEventListener('storage:blocked', () => {
  alert('Please close other tabs to update storage');
});
```

---

## OPFS not available

**Cause:** Not a secure context, or browser lacks support.

**Fix:** Check support first:

```javascript
import { supports } from '@adukiorg/anza/platform';

if (!supports.opfs) {
  // Fall back to idb
  await storage.set('file', data, 'idb');
}
```

---

## Data not persisting

**Cause:** Using `memory` tier, or private browsing mode.

**Fix:** Use `idb` or `opfs` for durable storage. Private browsing may disable IndexedDB.

---

## Compression failed

**Cause:** Compression Streams API unavailable, or non-serializable value.

**Fix:** The facade falls back to uncompressed storage automatically. Check that values are serializable (no circular references, no functions).

---

## Quota exceeded

**Cause:** Storage is full.

**Fix:** The facade auto-evicts expired and oldest entries when over 80%. For manual cleanup:

```javascript
await storage.delete('old-key');
```

Or request persistent storage:

```javascript
import { quota } from '@adukiorg/anza/storage';
await quota.persist();
```

---

## Write journal not replaying

**Cause:** `localStorage` is disabled or full.

**Fix:** The journal is a best-effort crash recovery mechanism. Critical writes should be confirmed:

```javascript
await storage.set('critical', data);
const confirmed = await storage.get('critical');
```

---

## Still stuck?

Inspect storage state:

```javascript
const est = await quota.estimate();
console.log('Usage:', est.usage, 'Quota:', est.quota);

// List all IDB keys
const db = new Database('platform-db', 1);
const keys = await db.keys('keyval');
console.log(keys);
```
