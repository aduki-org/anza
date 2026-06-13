#!/usr/bin/env node
/**
 * bin/create/index.js
 *
 * Scaffolds a new anza app project in the given directory.
 * Re-exports run, copy, and write for programmatic use.
 */

import { resolve, basename, dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import * as logs from '../common/index.js';
import { run } from './run.js';

export { run } from './run.js';
export { copy } from './copy.js';
export { write } from './write.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const arg = process.argv[2];

// CLI entry only when executed directly
const isCli = process.argv[1] === __filename;

if (isCli) {
  if (!arg || arg === '--help' || arg === '-h') {
    console.log('Usage: npx anza-create <name>');
    console.log('       npx anza-create .     (scaffold in current dir)');
    process.exit(arg ? 0 : 1);
  }

  const target = resolve(arg);
  const name   = arg === '.' ? basename(process.cwd()) : basename(target);

  if (existsSync(target) && arg !== '.') {
    logs.error(`'${target}' already exists.`);
    process.exit(1);
  }

  const library = join(__dirname, '..', '..');

  run(target, name, library);
}
