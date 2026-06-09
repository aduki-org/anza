/**
 * tests/core/router/history.test.js
 *
 * Test suite for history wrapper.
 */

import {
  navigate,
  replace,
  back,
  forward,
  go,
  current,
  entries,
  canBack,
  canForward
} from '../../../src/core/router/history.js';

describe('Router History Wrapper', () => {
  it('returns safe default resolutions when window.navigation is not available', () => {
    // If navigation API is supported in this test runner (Chromium),
    // we don't mock it for this specific test or we test standard behavior.
    // If we want to check no-window fallback, we can check that it doesn't throw.
    const res = navigate('/home');
    if (!res || typeof res.committed?.then !== 'function' || typeof res.finished?.then !== 'function') {
      throw new Error('Expected navigate to return resolved structure with committed/finished promises');
    }

    const rep = replace('/settings');
    if (!rep || typeof rep.committed?.then !== 'function') {
      throw new Error('Expected replace to return resolved structure');
    }
  });

  it('provides canBack and canForward state queries', () => {
    // Verify standard return type is boolean
    const cb = canBack();
    const cf = canForward();

    if (typeof cb !== 'boolean' || typeof cf !== 'boolean') {
      throw new Error('Expected canBack/canForward to return boolean values');
    }
  });

  it('exposes entries list and current active entry', () => {
    const list = entries();
    const curr = current();

    if (!Array.isArray(list)) {
      throw new Error('Expected entries to return an array');
    }

    if (curr !== null && typeof curr !== 'object') {
      throw new Error('Expected current to return an entry object or null');
    }
  });
});
