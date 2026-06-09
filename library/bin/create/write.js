/**
 * bin/create/write.js
 *
 * Writes a file, creating parent directories as needed.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import * as logs from '../common/index.js';

export function write(path, content) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  } catch (e) {
    logs.error(`Failed to write ${path}: ${e.message}`);
    process.exit(1);
  }
}
