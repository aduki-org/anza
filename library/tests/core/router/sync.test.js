/**
 * tests/core/router/sync.test.js
 *
 * Test suite for tab synchronization and network connection pool coordination.
 */

import { router } from '../../../src/core/router/index.js';
import {
  coordinateConnections,
  getActiveConnections,
  clearConnections
} from '../../../src/core/router/sync/index.js';

describe('Router Sync and Connection Coordination', () => {
  beforeEach(() => {
    clearConnections();
    router.links.clear();
    router.sync.stop();
  });

  afterEach(() => {
    clearConnections();
    router.links.clear();
    router.sync.stop();
  });

  it('should register connection factories and spawn connections on path match', async () => {
    let connectionOpened = false;
    let targetReceived = null;

    router.links.add('/dashboard/:section', async ({ url, params }) => {
      connectionOpened = true;
      targetReceived = url;
      return {
        close() {
          connectionOpened = false;
        }
      };
    });

    await coordinateConnections('/dashboard/analytics');

    if (!connectionOpened) {
      throw new Error('Expected background connection to be opened on matching path');
    }
    if (!targetReceived || !targetReceived.pathname.includes('/dashboard/analytics')) {
      throw new Error('Expected factory function to receive the correct destination URL');
    }

    const active = getActiveConnections();
    if (active.size !== 1) {
      throw new Error(`Expected 1 active connection, got ${active.size}`);
    }
  });

  it('should automatically close stale connections when navigating to non-matching paths', async () => {
    let connectionClosed = false;

    router.links.add('/admin/*', async () => {
      return {
        close() {
          connectionClosed = true;
        }
      };
    });

    // 1. Match path
    await coordinateConnections('/admin/users');
    const activeBefore = getActiveConnections();
    if (activeBefore.size !== 1) {
      throw new Error('Expected connection to be active');
    }

    // 2. Navigate away to non-matching path
    await coordinateConnections('/settings');

    if (!connectionClosed) {
      throw new Error('Expected connection to be closed when navigating away');
    }
    const activeAfter = getActiveConnections();
    if (activeAfter.size !== 0) {
      throw new Error('Expected active connections to be cleared');
    }
  });

  it('provides active status and has idempotent start/stop/close sync controls', () => {
    // 1. Initially stopped
    if (router.sync.active() !== false) {
      throw new Error('Expected sync to be inactive initially');
    }

    // 2. Start
    router.sync.start();
    if (router.sync.active() !== true) {
      throw new Error('Expected sync to be active after start');
    }

    // 3. Idempotent start
    router.sync.start();
    if (router.sync.active() !== true) {
      throw new Error('Expected sync to remain active');
    }

    // 4. Stop
    router.sync.stop();
    if (router.sync.active() !== false) {
      throw new Error('Expected sync to be inactive after stop');
    }

    // 5. Close
    router.sync.close();
    if (router.sync.active() !== false) {
      throw new Error('Expected sync to be inactive after close');
    }
  });

  it('supports links.add, links.remove, and links.clear', async () => {
    let closed1 = false;
    let closed2 = false;

    const dispose1 = router.links.add('/path*', async () => ({
      close() { closed1 = true; }
    }));

    router.links.add('/*', async () => ({
      close() { closed2 = true; }
    }));

    // Spawn both connections by matching both patterns on /path1
    await coordinateConnections('/path1');

    const activeBefore = getActiveConnections();
    if (activeBefore.size !== 2) {
      throw new Error(`Expected 2 active connections, got ${activeBefore.size}`);
    }

    // Remove first link via disposer
    dispose1();
    if (!closed1) {
      throw new Error('Expected connection 1 to close on link disposer call');
    }

    // Remove second link via links.remove
    router.links.remove('/*');
    if (!closed2) {
      throw new Error('Expected connection 2 to close on links.remove');
    }

    // Clear all remaining links
    router.links.clear();
    const activeAfter = getActiveConnections();
    if (activeAfter.size !== 0) {
      throw new Error('Expected no active connections after clear');
    }
  });
});
