#!/usr/bin/env node
/**
 * bin/anza/index.js
 *
 * Node.js wrapper for the anza Rust binary.
 * Re-exports find and launch for programmatic use.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { realpathSync } from 'fs';
import { resolve } from './find.js';
import { start } from './launch.js';

export { resolve } from './find.js';
export { start } from './launch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const library = join(__dirname, '..', '..');
const root    = join(library, '..');

// CLI entry only when executed directly (handles npm bin symlinks)
const argvFile = process.argv[1] ? realpathSync(process.argv[1]) : null;
const isCli = argvFile === realpathSync(__filename);

if (isCli) {
  try {
    const path = resolve(root, __dirname);
    start(path, process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
