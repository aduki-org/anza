/**
 * tests/core/router/outlet.test.js
 *
 * Test suite for nested route mounting via ui.dock() + ui.page().
 * The legacy <route-outlet> element was superseded by dock.
 */

import { ui } from '../../../src/core/ui/index.js';
import { router } from '../../../src/core/router/index.js';

describe('Nested Route Outlet Coordinator', () => {
  let container;
  let mainEl;

  beforeEach(() => {
    router.clear();

    // Framework requires <main id="main"> for anchor().
    mainEl = document.createElement('main');
    mainEl.id = 'main';
    document.body.appendChild(mainEl);

    container = document.createElement('div');
    container.id = 'test-container';
    mainEl.appendChild(container);

    router.registerContainer('#test-container', container);
  });

  afterEach(() => {
    router.clearContainers();
    if (mainEl) {
      mainEl.remove();
      mainEl = null;
    }
    container = null;
  });

  it('should cast parameters, query variables, and hash onto child element props', async () => {
    ui.element('outlet-child-cast', {
      url: '/outlet-cast/:id',
      container: '#test-container',
      query: ['q'],
      props: {
        id:   { type: Number },
        q:    { type: String },
        hash: { type: String }
      },
      template: '<span>Child</span>'
    });

    await new Promise((resolve, reject) => {
      router.nav.to('/outlet-cast/456?q=searchterm#part-2')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    const childEl = container.querySelector('outlet-child-cast');
    if (!childEl) {
      throw new Error('Expected child component to be mounted inside container');
    }
    if (childEl.id !== 456) {
      throw new Error(`Expected id to be cast to 456, got ${childEl.id}`);
    }
    if (childEl.q !== 'searchterm') {
      throw new Error(`Expected q to be "searchterm", got ${childEl.q}`);
    }
    if (childEl.hash !== '#part-2') {
      throw new Error(`Expected hash to be "#part-2", got ${childEl.hash}`);
    }
  });

  it('should replace child when navigating between sibling routes', async () => {
    ui.element('outlet-sibling-a', {
      url: '/outlet-sib-a',
      container: '#test-container',
      template: '<div>Sibling A</div>'
    });

    ui.element('outlet-sibling-b', {
      url: '/outlet-sib-b',
      container: '#test-container',
      template: '<div>Sibling B</div>'
    });

    await new Promise((resolve, reject) => {
      router.nav.to('/outlet-sib-a')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (!container.querySelector('outlet-sibling-a')) {
      throw new Error('Expected sibling-a to be mounted');
    }

    await new Promise((resolve, reject) => {
      router.nav.to('/outlet-sib-b')
        .on('found', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (container.querySelector('outlet-sibling-a')) {
      throw new Error('Expected sibling-a to be replaced');
    }
    if (!container.querySelector('outlet-sibling-b')) {
      throw new Error('Expected sibling-b to be mounted');
    }
  });

  it('should support declarative ui.container with auto-registration via connectedCallback', async () => {
    ui.container('outlet-dock-a', {
      template: '<slot></slot>',
      style: ':host { display: block; }'
    });

    const el = document.createElement('outlet-dock-a');
    mainEl.appendChild(el);

    await new Promise(r => setTimeout(r, 0));

    if (typeof el.swapView !== 'function') {
      throw new Error('Expected ui.container to inject swapView into prototype');
    }

    const registered = router.getContainer('outlet-dock-a');
    if (registered !== el) {
      throw new Error('Expected declarative container to auto-register via connectedCallback');
    }

    el.remove();
  });
});
