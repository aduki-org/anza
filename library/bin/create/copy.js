/**
 * bin/create/copy.js
 *
 * Recursively copies a directory tree.
 */

import { cpSync } from 'fs';
import * as logs from '../common/index.js';

export function copy(src, dst) {
  try {
    cpSync(src, dst, { recursive: true });
    return true;
  } catch (e) {
    logs.warn(`Could not copy ${src} -> ${dst}: ${e.message}`);
    return false;
  }
}
