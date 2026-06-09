/**
 * bin/anza/launch.js
 *
 * Spawns the anza Rust binary with forwarded args.
 */

import { spawn } from 'child_process';
import * as logs from '../common/index.js';

export function start(path, args) {
  const child = spawn(path, args, { stdio: 'inherit' });

  child.on('error', (err) => {
    logs.error(`Failed to spawn anza: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}
