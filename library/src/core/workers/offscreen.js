/**
 * src/core/workers/offscreen.js
 *
 * OffscreenCanvas Transfer Lifecycle.
 * Hands canvas rendering to a background Worker. The worker must respond with
 * { ok: true } on its port after receiving the canvas to signal readiness.
 *
 * Lifecycle:
 *   open()   – transfer canvas + wait for ready acknowledgement
 *   send()   – dispatch render commands
 *   resize() – forward new dimensions and device pixel ratio
 *   close()  – terminate the worker (terminate() is an alias)
 *
 * Source: plan.md Phase 7
 */

export class Offscreen {
  #canvas;
  #script;
  #worker = null;
  #port = null;
  #ready = false;
  #closed = false;
  #onError;
  #onResize;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string}            script   Worker script URL
   * @param {object}            [opts]
   * @param {Function}          [opts.onError]   Called when the worker reports an error
   * @param {Function}          [opts.onResize]  Called after a resize message is forwarded
   */
  constructor(canvas, script, opts = {}) {
    this.#canvas = canvas;
    this.#script = script;
    this.#onError = opts.onError ?? null;
    this.#onResize = opts.onResize ?? null;
  }

  get ready() { return this.#ready; }
  get closed() { return this.#closed; }

  /**
   * Transfers canvas control to the worker and waits for the ready handshake.
   *
   * The worker must send `{ ok: true }` on the received port after it has
   * initialised its rendering context.
   *
   * @returns {Promise<this>}
   */
  open() {
    if (this.#closed) {
      return Promise.reject(new Error('OffscreenCanvas handle is closed'));
    }
    if (this.#ready) {
      return Promise.resolve(this);
    }

    if (!this.#supports()) {
      return Promise.reject(new Error('OffscreenCanvas is not supported in this environment'));
    }

    return new Promise((resolve, reject) => {
      try {
        const offscreen = this.#canvas.transferControlToOffscreen();
        this.#worker = new Worker(this.#script, { type: 'module' });

        this.#worker.addEventListener('error', (e) => {
          const err = new Error(e.message ?? 'Worker error');
          if (!this.#ready) {
            reject(err);
          }
          this.#onError?.(err);
        });

        // MessageChannel for the ready handshake
        const channel = new MessageChannel();
        this.#port = channel.port1;

        this.#port.onmessage = (e) => {
          if (!this.#ready && e.data?.ok) {
            this.#ready = true;
            resolve(this);
          }
        };

        this.#worker.postMessage(
          { canvas: offscreen, port: channel.port2 },
          [offscreen, channel.port2]
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Sends a render command to the worker.
   *
   * @param {any}           payload
   * @param {Transferable[]} [transferables]
   */
  send(payload, transferables = []) {
    if (this.#closed) throw new Error('OffscreenCanvas handle is closed');
    if (!this.#ready) throw new Error('OffscreenCanvas handle is not ready — call open() first');
    this.#port.postMessage(payload, transferables);
  }

  /**
   * Forwards updated dimensions and device pixel ratio to the worker.
   *
   * @param {object} [opts]
   * @param {number} [opts.width]   New CSS width in pixels (defaults to canvas.clientWidth)
   * @param {number} [opts.height]  New CSS height in pixels (defaults to canvas.clientHeight)
   * @param {number} [opts.dpr]     Device pixel ratio (defaults to devicePixelRatio)
   */
  resize(opts = {}) {
    const width = opts.width ?? this.#canvas.clientWidth;
    const height = opts.height ?? this.#canvas.clientHeight;
    const dpr = opts.dpr ?? (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    this.send({ type: 'resize', width, height, dpr });
    this.#onResize?.({ width, height, dpr });
  }

  /**
   * Terminates the worker and releases the handle.
   * `terminate()` is kept as an alias for back-compat.
   */
  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#ready = false;
    try { this.#port?.close(); } catch { /* best-effort */ }
    try { this.#worker?.terminate(); } catch { /* best-effort */ }
    this.#port = null;
    this.#worker = null;
  }

  terminate() { return this.close(); }

  #supports() {
    return (
      typeof OffscreenCanvas !== 'undefined' &&
      typeof this.#canvas.transferControlToOffscreen === 'function'
    );
  }
}

// Compatibility alias
export { Offscreen as OffscreenHandle };

/**
 * Convenience factory — creates an Offscreen handle, transfers the canvas,
 * and returns the instance (ready state established after the returned
 * promise resolves).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string}            script
 * @param {object}            [opts]
 * @returns {Promise<Offscreen>}
 */
export function offscreen(canvas, script, opts = {}) {
  const handle = new Offscreen(canvas, script, opts);
  return handle.open();
}
