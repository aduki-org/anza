/**
 * src/core/ui/base.js
 *
 * Web Component HTMLElement Base.
 * Automatically initializes a unified lifecycle AbortController (`this.ctrl`)
 * inside connectedCallback and aborts it in disconnectedCallback to secure
 * all dynamic event and stream subscriptions against memory leaks.
 *
 * Source: doc 04 — Web Components §1, §6
 */

export class BaseElement extends HTMLElement {
  constructor() {
    super();
    this.ctrl = null;
  }

  /**
   * Invoked when the element is appended to the DOM.
   * Async mount rejections are caught to prevent unhandled promise rejections
   * on raw BaseElement subclasses.
   */
  connectedCallback() {
    this.ctrl = new AbortController();
    Promise.resolve(this.mount()).catch((err) => {
      console.error('[Native UI] mount failed:', err);
    });
  }

  /**
   * Invoked when the element is detached from the DOM.
   */
  disconnectedCallback() {
    this.unmount();
    if (this.ctrl) {
      this.ctrl.abort();
      this.ctrl = null;
    }
  }

  /**
   * Lifecycle mount hook. Overridden by child custom elements to bind listeners.
   */
  mount() {}

  /**
   * Lifecycle unmount hook. Overridden by child custom elements to perform cleanups.
   */
  unmount() {}
}
