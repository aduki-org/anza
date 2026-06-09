#!/usr/bin/env node
/**
 * create/index.js
 *
 * Entry point for `npm create @adukiorg/anza <name>`.
 * Resolves the installed `@adukiorg/anza` package and delegates to its
 * scaffold logic.
 */

import { createRequire } from 'module';
import { dirname, join, resolve, basename } from 'path';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);
const anzaPkg = require.resolve('@adukiorg/anza/package.json');
const library = dirname(anzaPkg);

const { run } = await import(join(library, 'bin', 'create', 'index.js'));

const arg = process.argv[2];

if (!arg || arg === '--help' || arg === '-h') {
  console.log('Usage: npm create @adukiorg/anza <name>');
  console.log('       npm create @adukiorg/anza .   (scaffold in current dir)');
  process.exit(arg ? 0 : 1);
}

const target = resolve(arg);
const name = arg === '.' ? basename(process.cwd()) : basename(target);

if (existsSync(target) && arg !== '.') {
  console.error(`'${target}' already exists.`);
  process.exit(1);
}

run(target, name, library);
