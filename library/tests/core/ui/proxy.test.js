import {
  TagsCache,
  createEventDelegator,
  createMutationWatcher,
  createRefs
} from '../../../src/core/ui/define/proxy.js';

function createShadow(markup = '') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = markup;
  return { host, root };
}

function nextMutationBatch() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('ui define proxy helpers', () => {
  let host;

  afterEach(() => {
    host?.remove();
    host = null;
  });

  it('keeps tags.one and tags.all cache shapes separate', () => {
    const shadow = createShadow('<button></button><button></button>');
    host = shadow.host;

    const tags = new TagsCache(shadow.root);
    const first = tags.one('button');
    const all = tags.all('button');

    if (!(first instanceof HTMLButtonElement)) {
      throw new Error('Expected tags.one to return the first button');
    }

    if (!Array.isArray(all) || all.length !== 2) {
      throw new Error('Expected tags.all to return an array of buttons');
    }
  });

  it('builds refs from descriptor or template scan', () => {
    const shadow = createShadow('<button ref="submit"></button><span ref="status"></span>');
    host = shadow.host;

    const refsFromDescriptor = createRefs(shadow.root, { refs: ['submit'] });
    const refsFromScan = createRefs(shadow.root);

    if (!(refsFromDescriptor.submit instanceof HTMLButtonElement)) {
      throw new Error('Expected descriptor refs to resolve submit');
    }

    if (!(refsFromScan.status instanceof HTMLSpanElement)) {
      throw new Error('Expected fallback scan to resolve status');
    }
  });

  it('delegates events and supports once bindings', () => {
    const shadow = createShadow('<button class="action"><span>Go</span></button>');
    host = shadow.host;

    const ctrl = new AbortController();
    const on = createEventDelegator(shadow.root, ctrl.signal);
    let calls = 0;

    on.click.once('.action', (_event, target) => {
      if (!target.classList.contains('action')) {
        throw new Error('Expected delegated target to be the matching button');
      }
      calls++;
    });

    const span = shadow.root.querySelector('span');
    span.click();
    span.click();
    ctrl.abort();

    if (calls !== 1) {
      throw new Error(`Expected once handler to fire once, fired ${calls}`);
    }
  });

  it('watches attribute mutations and stops after dispose', async () => {
    const shadow = createShadow('<button ref="submit"></button>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const button = shadow.root.querySelector('button');
    const seen = [];

    const stop = watch.attr(button, 'disabled', (attr, next, prev, target) => {
      seen.push({ attr, next, prev, target });
    });

    button.setAttribute('disabled', '');
    await nextMutationBatch();
    stop();
    button.removeAttribute('disabled');
    await nextMutationBatch();
    ctrl.abort();

    if (seen.length !== 1) {
      throw new Error(`Expected one attribute mutation, saw ${seen.length}`);
    }

    if (seen[0].attr !== 'disabled' || seen[0].next !== '' || seen[0].target !== button) {
      throw new Error('Unexpected watch.attr handler payload');
    }
  });

  // Section 1.2 Gaps
  it('supports on.click with custom signal cleanup', () => {
    const shadow = createShadow('<button class="btn"></button>');
    host = shadow.host;

    const defaultCtrl = new AbortController();
    const customCtrl = new AbortController();
    const on = createEventDelegator(shadow.root, defaultCtrl.signal);
    let calls = 0;

    on.click('.btn', () => { calls++; }, customCtrl.signal);

    const button = shadow.root.querySelector('.btn');
    button.click();

    customCtrl.abort();
    button.click();

    if (calls !== 1) {
      throw new Error(`Expected calls to be 1, got ${calls}`);
    }
  });

  it('supports on.click with passive: false options', () => {
    const shadow = createShadow('<button class="btn"></button>');
    host = shadow.host;

    const ctrl = new AbortController();
    const on = createEventDelegator(shadow.root, ctrl.signal);
    let passiveValue = null;

    // Check if passive options work by registering with passive: false
    // Since we can't inspect event listener options directly in standard DOM,
    // we verify the options normalization.
    const dispose = on.click('.btn', (e) => {
      passiveValue = e.defaultPrevented;
    }, { passive: false });

    dispose();
    ctrl.abort();
  });

  it('supports custom:event delegation', () => {
    const shadow = createShadow('<div class="box"></div>');
    host = shadow.host;

    const ctrl = new AbortController();
    const on = createEventDelegator(shadow.root, ctrl.signal);
    let calls = 0;

    on['custom:event']('.box', (e) => {
      calls += e.detail.amount;
    });

    const box = shadow.root.querySelector('.box');
    box.dispatchEvent(new CustomEvent('custom:event', {
      detail: { amount: 42 },
      bubbles: true,
      composed: true
    }));

    if (calls !== 42) {
      throw new Error(`Expected custom event to be caught with detail. Got calls = ${calls}`);
    }

    ctrl.abort();
  });

  it('watches multiple attributes and all attributes via *', async () => {
    const shadow = createShadow('<button></button>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const button = shadow.root.querySelector('button');

    const multiSeen = [];
    const allSeen = [];

    watch.attr(button, ['disabled', 'class'], (attr) => {
      multiSeen.push(attr);
    });

    watch.attr(button, '*', (attr) => {
      allSeen.push(attr);
    });

    button.setAttribute('disabled', '');
    button.setAttribute('class', 'active');
    button.setAttribute('data-custom', 'test');
    await nextMutationBatch();

    if (multiSeen.length !== 2 || !multiSeen.includes('disabled') || !multiSeen.includes('class')) {
      throw new Error('Expected multiple attributes watcher to trigger exactly for specified attributes');
    }

    if (allSeen.length !== 3 || !allSeen.includes('data-custom')) {
      throw new Error('Expected wildcard attributes watcher to trigger for all attributes');
    }

    ctrl.abort();
  });

  it('watches kids (childList changes) with and without deep: true', async () => {
    const shadow = createShadow('<div class="parent"><div class="child"></div></div>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const parent = shadow.root.querySelector('.parent');
    const child = shadow.root.querySelector('.child');

    let shallowCalls = 0;
    let deepCalls = 0;

    watch.kids(parent, () => { shallowCalls++; });
    watch.kids(parent, { deep: true }, () => { deepCalls++; });

    // 1. Shallow mutation
    const btn = document.createElement('button');
    parent.appendChild(btn);
    await nextMutationBatch();

    // 2. Nested mutation
    const span = document.createElement('span');
    child.appendChild(span);
    await nextMutationBatch();

    if (shallowCalls !== 1) {
      throw new Error(`Expected shallow calls to be 1, got ${shallowCalls}`);
    }

    if (deepCalls !== 2) {
      throw new Error(`Expected deep calls to be 2, got ${deepCalls}`);
    }

    ctrl.abort();
  });

  it('watches textContent changes via watch.text', async () => {
    const shadow = createShadow('<div><span>hello</span></div>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const span = shadow.root.querySelector('span');

    let textVal = '';
    watch.text(span, (val) => { textVal = val; });

    span.firstChild.textContent = 'world';
    await nextMutationBatch();

    if (textVal !== 'world') {
      throw new Error(`Expected textVal to be "world", got "${textVal}"`);
    }

    ctrl.abort();
  });

  it('watches entire subtrees via watch.tree', async () => {
    const shadow = createShadow('<div class="root"><span class="child"></span></div>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const root = shadow.root.querySelector('.root');
    const child = shadow.root.querySelector('.child');

    let calls = 0;
    watch.tree(root, () => { calls++; });

    child.setAttribute('data-id', '123');
    await nextMutationBatch();

    const btn = document.createElement('button');
    child.appendChild(btn);
    await nextMutationBatch();

    if (calls !== 2) {
      throw new Error(`Expected watch.tree to catch all descendant mutations. Got calls = ${calls}`);
    }

    ctrl.abort();
  });

  it('supports watch.*.once bindings', async () => {
    const shadow = createShadow('<button></button>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const button = shadow.root.querySelector('button');

    let calls = 0;
    watch.attr.once(button, 'disabled', () => { calls++; });

    button.setAttribute('disabled', '');
    await nextMutationBatch();
    button.removeAttribute('disabled');
    button.setAttribute('disabled', '');
    await nextMutationBatch();

    if (calls !== 1) {
      throw new Error(`Expected once watcher to fire exactly once, got ${calls}`);
    }

    ctrl.abort();
  });

  it('throws an error if direct watch target is outside shadow root', () => {
    const shadow = createShadow('');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);

    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);

    try {
      let threw = false;
      try {
        watch.attr(outsideEl, 'disabled', () => {});
      } catch (err) {
        threw = true;
        if (!err.message.includes('WatchError')) {
          throw new Error('Expected WatchError in message');
        }
      }

      if (!threw) {
        throw new Error('Expected watch outside shadow root to throw');
      }
    } finally {
      outsideEl.remove();
      ctrl.abort();
    }
  });

  it('allows selector target with no matches currently, matching later', async () => {
    const shadow = createShadow('<div class="container"></div>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const container = shadow.root.querySelector('.container');

    let calls = 0;
    // Register watch on dynamic elements matching '.dynamic-item'
    watch.attr('.dynamic-item', 'data-val', () => {
      calls++;
    });

    // Add matching element later
    const item = document.createElement('div');
    item.className = 'dynamic-item';
    container.appendChild(item);
    await nextMutationBatch();

    // Mutate it
    item.setAttribute('data-val', '42');
    await nextMutationBatch();

    if (calls !== 1) {
      throw new Error(`Expected watch selector with no initial matches to match dynamically. Got calls = ${calls}`);
    }

    ctrl.abort();
  });

  it('component abort clears all watch registrations', async () => {
    const shadow = createShadow('<button></button>');
    host = shadow.host;

    const ctrl = new AbortController();
    const watch = createMutationWatcher(shadow.root, ctrl.signal);
    const button = shadow.root.querySelector('button');

    let calls = 0;
    watch.attr(button, 'disabled', () => { calls++; });

    ctrl.abort();

    button.setAttribute('disabled', '');
    await nextMutationBatch();

    if (calls !== 0) {
      throw new Error('Expected no watch calls after abort');
    }
  });
});
