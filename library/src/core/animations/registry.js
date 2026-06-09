/**
 * src/core/animations/registry.js
 *
 * Animation Registry.
 * A centralized store to register, lookup, and manage reusable WAAPI keyframe
 * configurations and timing options.
 *
 * Source: doc 03 — Native CSS Architecture §6, doc 12 — Performance §4
 */

import { keyframes, timing } from './waapi.js';

export class AnimationRegistry {
  #store = new Map();

  /**
   * Registers a named animation template with keyframes and default timing options.
   */
  register(name, keyframes, defaultOptions = {}) {
    this.#store.set(name, { keyframes, options: defaultOptions });
  }

  /**
   * Retrieves a registered animation configuration.
   */
  get(name) {
    return this.#store.get(name) || null;
  }

  /**
   * Evicts an animation template from the registry.
   */
  delete(name) {
    return this.#store.delete(name);
  }

  /**
   * Flushes all stored animation templates.
   */
  clear() {
    this.#store.clear();
  }
}

export const registry = new AnimationRegistry();

// Register common presets
registry.register('fade', keyframes('fade'), timing());
registry.register('slide', keyframes('slide'), timing());
registry.register('slide-x', keyframes('slide', { axis: 'x' }), timing());
registry.register('slide-y', keyframes('slide', { axis: 'y' }), timing());
registry.register('scale', keyframes('scale'), timing());
registry.register('zoom', keyframes('zoom'), timing());
registry.register('blur', keyframes('blur'), timing());
