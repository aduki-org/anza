/**
 * types/core/workers/index.d.ts
 *
 * TypeScript declarations for the multi-threaded concurrency layer.
 * Source: plan.md Phase 1 — Contract
 */

// ---------------------------------------------------------------------------
// Message contract
// ---------------------------------------------------------------------------

/** Shape of a message sent to a worker. */
export interface WorkerRequest {
  task: string;
  payload?: any;
  meta?: any;
}

/** Shape of a message received from a worker. */
export interface WorkerResponse {
  ok: boolean;
  value?: any;
  error?: string;
}

// ---------------------------------------------------------------------------
// Shared task options
// ---------------------------------------------------------------------------

export interface TaskOptions {
  /** Data to clone-transfer to the worker. Must be structured-clone safe. */
  payload?: any;
  /** Scheduling priority. Default: 'user-visible'. */
  priority?: 'user-blocking' | 'user-visible' | 'background';
  /** Transferables handed off to the worker (sender loses access). */
  transferables?: Transferable[];
  /** Signal to cancel the in-flight or queued task. */
  signal?: AbortSignal;
  /** Milliseconds before the task is automatically aborted. */
  timeout?: number;
  /** Arbitrary metadata forwarded to the worker. */
  meta?: any;
  /** Pool size hint (used only when the pool is first created). */
  size?: number;
  /** Maximum pool size cap. */
  max?: number;
}

// ---------------------------------------------------------------------------
// Dedicated worker
// ---------------------------------------------------------------------------

export interface RunOptions {
  payload?: any;
  transferables?: Transferable[];
  signal?: AbortSignal;
  timeout?: number;
  meta?: any;
}

export declare class Dedicated {
  constructor(script: string);
  readonly closed: boolean;
  run(task: string, options?: RunOptions): Promise<any>;
  terminate(): void;
}

/** @deprecated Use Dedicated */
export declare class DedicatedWorker extends Dedicated {}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------

export interface PoolOptions {
  size?: number;
  max?: number;
  idle?: number;
}

export interface PoolTaskOptions extends RunOptions {
  priority?: 'user-blocking' | 'user-visible' | 'background';
  idempotent?: boolean;
}

export declare class Pool {
  constructor(script: string, opts?: PoolOptions);
  readonly size: number;
  readonly pending: number;
  run(task: string, options?: PoolTaskOptions): Promise<any>;
  terminate(): void;
}

/** @deprecated Use Pool */
export declare class WorkerPool extends Pool {}

// ---------------------------------------------------------------------------
// Shared worker
// ---------------------------------------------------------------------------

export declare class Shared {
  constructor(script: string, name?: string);
  readonly connected: boolean;
  readonly closed: boolean;
  connect(): void;
  send(message: any, transferables?: Transferable[]): void;
  subscribe(fn: (msg: any) => void, signal?: AbortSignal): () => void;
  close(): void;
  /** @deprecated Use send() */
  postMessage(msg: any, transfer?: Transferable[]): void;
  /** @deprecated Use subscribe() */
  onMessage(fn: (msg: any) => void, signal?: AbortSignal): () => void;
}

/** @deprecated Use Shared */
export declare class SharedConnection extends Shared {}

// ---------------------------------------------------------------------------
// Locks
// ---------------------------------------------------------------------------

export interface LockOptions {
  signal?: AbortSignal;
  mode?: 'exclusive' | 'shared';
  timeout?: number;
  ifAvailable?: boolean;
  steal?: boolean;
}

export declare function lock(
  name: string,
  fn: () => any | Promise<any>,
  options?: LockOptions
): Promise<any>;

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

export interface BroadcastManager {
  broadcast(name: string, payload: any): void;
  subscribe(name: string, fn: (msg: any) => void, signal?: AbortSignal): () => void;
  close(name: string): void;
  clear(): void;
}

export declare const broadcast: BroadcastManager;

// ---------------------------------------------------------------------------
// Offscreen canvas
// ---------------------------------------------------------------------------

export interface OffscreenOptions {
  onError?: (err: Error) => void;
  onResize?: (dims: { width: number; height: number; dpr: number }) => void;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  dpr?: number;
}

export declare class Offscreen {
  constructor(canvas: HTMLCanvasElement, script: string, opts?: OffscreenOptions);
  readonly ready: boolean;
  readonly closed: boolean;
  open(): Promise<this>;
  send(payload: any, transferables?: Transferable[]): void;
  resize(opts?: ResizeOptions): void;
  close(): void;
  /** @deprecated Use close() */
  terminate(): void;
}

/** @deprecated Use Offscreen */
export declare class OffscreenHandle extends Offscreen {}

export declare function offscreen(
  canvas: HTMLCanvasElement,
  script: string,
  opts?: OffscreenOptions
): Promise<Offscreen>;

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

export declare const has: {
  worker: boolean;
  shared: boolean;
  channel: boolean;
  locks: boolean;
  offscreen: boolean;
  isolated: boolean;
};

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

export declare const workers: {
  /** Run a task in a lazily allocated pool. */
  run(script: string, task: string, opts?: TaskOptions): Promise<any>;
  /** Create a standalone dedicated worker (not pooled). */
  dedicated(script: string): Dedicated;
  /** Connect to a SharedWorker (or dedicated fallback). */
  shared(script: string, name?: string): Shared;
  /** Acquire a named lock and execute fn within it. */
  lock: typeof lock;
  /** Send a message to a named BroadcastChannel. */
  broadcast(name: string, payload: any): void;
  /** Subscribe to a named BroadcastChannel. Returns a dispose function. */
  subscribe(name: string, fn: (msg: any) => void, signal?: AbortSignal): () => void;
  /** Transfer a canvas to a worker. Returns a Promise<Offscreen>. */
  offscreen(canvas: HTMLCanvasElement, script: string, opts?: OffscreenOptions): Promise<Offscreen>;
  /** Terminate the pool for one script and remove it. */
  close(script: string): void;
  /** Terminate all pools and clear all broadcasts. */
  clear(): void;
};
