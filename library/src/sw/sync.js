/**
 * src/sw/sync.js
 *
 * Background Sync Queue Replayer.
 * Replays persistent IndexedDB tasks chronologically, re-executes serialized Requests,
 * coordinates retries, handles dead-letter limits, and broadcasts results.
 *
 * Source: doc 13 — Offline and Background §5
 */

import { queue } from '../core/offline/queue.js';
import { deserializeRequest } from './queue.js';

/**
 * Replays all queued offline tasks chronologically in FIFO order.
 */
export async function replayQueue() {
  const list = await queue.list();

  for (const entry of list) {
    if (entry.failed) continue; // Skip permanently failed items in the DLQ

    try {
      const request = deserializeRequest(entry.payload);
      const response = await fetch(request);

      if (response && response.ok) {
        // Success: evict from queue
        await queue.delete(entry.id);

        // Broadcast success to all controlled clients
        const clientsList = await self.clients.matchAll();
        for (const client of clientsList) {
          client.postMessage({
            type: 'sync-success',
            id: entry.id,
            task: entry.task
          });
        }
      } else {
        // Server returned a failure (e.g. 5xx)
        await requeueFailed(entry, new Error(`Server returned HTTP status ${response.status}`));
      }
    } catch (err) {
      // Network failure (device went offline again or timeout)
      await requeueFailed(entry, err);
      // Halt execution immediately to preserve causal ordering of subsequent actions
      throw err;
    }
  }
}

/**
 * Increments task retry counts and transitions them to dead-letter states at the limit.
 */
export async function requeueFailed(entry, error) {
  entry.retries = (entry.retries ?? 0) + 1;
  const maxRetries = entry.maxRetries ?? 5;

  if (entry.retries >= maxRetries) {
    // Dead Letter Queue transition
    entry.failed = true;
    entry.error = error?.message || 'Maximum sync retries exceeded';
    await queue.update(entry);

    // Broadcast permanent failure to controlled clients
    const clientsList = await self.clients.matchAll();
    for (const client of clientsList) {
      client.postMessage({
        type: 'sync-failed',
        id: entry.id,
        task: entry.task,
        error: entry.error
      });
    }
  } else {
    // Update incremented retries
    await queue.update(entry);
  }
}
