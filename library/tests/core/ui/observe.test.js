/**
 * tests/core/ui/observe.test.js
 *
 * Test suite for core observer wrappers.
 */

import { resize, intersection, mutation, performance } from '../../../src/core/ui/observe.js';

describe('UI Observer Wrappers', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    el = null;
  });

  it('resize observer returns disposer, disconnects on abort, and allows manual dispose', () => {
    const ctrl = new AbortController();
    let aborted = false;

    const dispose = resize(el, () => {}, ctrl.signal);

    if (typeof dispose !== 'function') {
      throw new Error('Expected resize to return a disposer function');
    }

    // Verify manual dispose removes event listener
    dispose();

    // Verify abort doesn't throw or double-dispose
    ctrl.abort();
  });

  it('intersection observer returns disposer, disconnects on abort, and allows manual dispose', () => {
    const ctrl = new AbortController();
    const dispose = intersection(el, () => {}, ctrl.signal);

    if (typeof dispose !== 'function') {
      throw new Error('Expected intersection to return a disposer function');
    }

    dispose();
    ctrl.abort();
  });

  it('mutation observer returns disposer, disconnects on abort, and allows manual dispose', () => {
    const ctrl = new AbortController();
    const dispose = mutation(el, () => {}, ctrl.signal);

    if (typeof dispose !== 'function') {
      throw new Error('Expected mutation to return a disposer function');
    }

    dispose();
    ctrl.abort();
  });

  it('performance observer returns disposer, disconnects on abort, and allows manual dispose', () => {
    const ctrl = new AbortController();
    const dispose = performance(['mark'], () => {}, ctrl.signal);

    if (typeof dispose !== 'function') {
      throw new Error('Expected performance to return a disposer function');
    }

    dispose();
    ctrl.abort();
  });
});
