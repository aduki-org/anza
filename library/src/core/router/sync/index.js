/**
 * src/core/router/sync/index.js
 *
 * Facade entry point for router synchronization utilities.
 *
 * Source: plan.md §6
 */

export { setupTabSync, start, stop, active, close } from './tab.js';
export {
  registerConnection,
  coordinateConnections,
  getActiveConnections,
  clearConnections,
  links
} from './transport.js';
