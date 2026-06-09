/**
 * bin/common/logs.js
 *
 * Colored category logger matching the Rust logs crate.
 * Categories: info, debug, success, error, warn, compiler, server, hmr, watcher, sync.
 */

const RESET  = '\x1b[0m';
const GRAY   = '\x1b[90m';
const BLUE   = '\x1b[34m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[1m\x1b[32m';
const RED    = '\x1b[1m\x1b[31m';
const YELLOW = '\x1b[1m\x1b[33m';
const BYELLOW = '\x1b[93m';
const BBLUE  = '\x1b[94m';
const BGREEN = '\x1b[92m';

function stamp() {
  const d = new Date();
  return `${GRAY}[${d.toISOString().slice(0, 19).replace('T', ' ')}]${RESET} `;
}

export function info(msg) {
  console.log(`${stamp()}${BLUE}INFO:${RESET} ${msg}`);
}

export function debug(msg) {
  console.log(`${stamp()}${GRAY}DEBUG:${RESET} ${msg}`);
}

export function success(msg) {
  console.log(`${stamp()}${GREEN}SUCCESS:${RESET} ${msg}`);
}

export function error(msg) {
  console.error(`${stamp()}${RED}ERROR:${RESET} ${msg}`);
}

export function warn(msg) {
  console.warn(`${stamp()}${YELLOW}WARN:${RESET} ${msg}`);
}

export function compiler(msg) {
  console.log(`${stamp()}${CYAN}COMPILER:${RESET} ${msg}`);
}

export function server(msg) {
  console.log(`${stamp()}${BBLUE}SERVER:${RESET} ${msg}`);
}

export function hmr(msg) {
  console.log(`${stamp()}${BGREEN}HMR:${RESET} ${msg}`);
}

export function watcher(msg) {
  console.log(`${stamp()}${BYELLOW}WATCHER:${RESET} ${msg}`);
}

export function sync(msg) {
  console.log(`${stamp()}${GRAY}SYNC:${RESET} ${msg}`);
}
