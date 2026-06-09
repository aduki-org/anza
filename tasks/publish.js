#!/usr/bin/env node
/**
 * tasks/publish.js
 *
 * Builds the Rust binary, then packs/publishes library/ to npm.
 *
 * For automated CI releases see .github/workflows/release.yml
 * Usage:
 *   node tasks/publish.js            # publish
 *   node tasks/publish.js --dry      # dry run (npm pack only)
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const library = join(root, '..', 'library');
const dry = process.argv.includes('--dry');

// 1. Build binary
console.log('Step 1/2 — Building anza binary...');
execSync('node tasks/build.js', { cwd: join(root, '..'), stdio: 'inherit' });

// 2. Pack or publish from library/
const cmd = dry ? 'npm pack' : 'npm publish --access public';
console.log(`\nStep 2/2 — ${dry ? 'Packing' : 'Publishing'} library/...`);
execSync(cmd, { cwd: library, stdio: 'inherit' });

if (dry) {
  console.log('\nDry run complete. Check the .tgz file above.');
} else {
  console.log('\nPublished successfully.');
}
