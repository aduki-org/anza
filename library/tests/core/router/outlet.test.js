/**
 * tests/core/router/outlet.test.js
 *
 * Test suite for <route-outlet> nested route view component.
 */

import { ui } from '../../../src/core/ui/index.js';
import { router } from '../../../src/core/router/index.js';

describe('Nested Route Outlet Coordinator', () => {
  let container;

  beforeEach(() => {
    router.clear();
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    router.clearContainers();
    if (container) {
      container.remove();
    }
  });

  it('should support hierarchical layout matching and child segment auto-mounting', async () => {
    // 1. Define parent layout component containing <route-outlet>
    ui.element('test-nested-parent', {
      url: '/nested',
      container: '#test-container',
      template: '<div>Parent Layout <route-outlet></route-outlet></div>'
    });

    // 2. Define child page component
    ui.element('test-nested-child', {
      url: '/nested/child',
      meta: { parent: '/nested' },
      template: '<span>Child Page</span>'
    });

    // Register container in router
    router.registerContainer('#test-container', container);

    // Navigate to child route
    await new Promise((resolve, reject) => {
      router.nav.to('/nested/child')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Assert parent layout is mounted
    const parentEl = container.querySelector('test-nested-parent');
    if (!parentEl) {
      throw new Error('Expected parent component to be mounted');
    }

    // Assert child page is mounted inside <route-outlet> in the parent shadow root
    const outletEl = parentEl.shadowRoot.querySelector('route-outlet');
    if (!outletEl) {
      throw new Error('Expected route-outlet to be present in shadow root');
    }

    const childEl = outletEl.querySelector('test-nested-child');
    if (!childEl) {
      throw new Error('Expected child component to be mounted inside route-outlet');
    }
  });

  it('should clear child outlet when navigating back to the parent-only route', async () => {
    ui.element('test-parent-clear', {
      url: '/clear',
      container: '#test-container',
      template: '<div><route-outlet></route-outlet></div>'
    });

    ui.element('test-child-clear', {
      url: '/clear/child',
      meta: { parent: '/clear' },
      template: '<span>Child</span>'
    });

    router.registerContainer('#test-container', container);

    // 1. Go to child first
    await new Promise((resolve, reject) => {
      router.nav.to('/clear/child')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    const parentEl = container.querySelector('test-parent-clear');
    const outletEl = parentEl.shadowRoot.querySelector('route-outlet');
    if (!outletEl.querySelector('test-child-clear')) {
      throw new Error('Expected child component to be mounted');
    }

    // 2. Go back to parent only
    await new Promise((resolve, reject) => {
      router.nav.to('/clear')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Child component should be removed from the outlet
    if (outletEl.querySelector('test-child-clear')) {
      throw new Error('Expected child component to be cleared from route-outlet');
    }
  });

  it('should support parameter, query, and hash casting in child outlets', async () => {
    ui.element('test-parent-cast', {
      url: '/castparent',
      container: '#test-container',
      template: '<div><route-outlet></route-outlet></div>'
    });

    ui.element('test-child-cast', {
      url: '/castparent/:id',
      meta: { parent: '/castparent' },
      query: ['q'],
      props: {
        id: { type: Number },
        q: { type: String },
        hash: { type: String }
      },
      template: '<span>Child</span>'
    });

    router.registerContainer('#test-container', container);

    await new Promise((resolve, reject) => {
      router.nav.to('/castparent/456?q=searchterm#part-2')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    const parentEl = container.querySelector('test-parent-cast');
    const outletEl = parentEl.shadowRoot.querySelector('route-outlet');
    const childEl = outletEl.querySelector('test-child-cast');

    if (!childEl) {
      throw new Error('Expected child component to be mounted');
    }

    // Assert casted properties are populated on the child element
    if (childEl.id !== 456) {
      throw new Error(`Expected id parameter to be cast to 456, got ${childEl.id}`);
    }
    if (childEl.q !== 'searchterm') {
      throw new Error(`Expected q query param to be "searchterm", got ${childEl.q}`);
    }
    if (childEl.hash !== '#part-2') {
      throw new Error(`Expected hash to be "#part-2", got ${childEl.hash}`);
    }
  });
});
