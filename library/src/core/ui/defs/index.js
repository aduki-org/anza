/**
 * src/core/ui/defs/index.js
 *
 * Definition layer facade. The four first-class UI primitives that supersede
 * the split `ui.element` + `router.register` pattern and `<route-outlet>`.
 *
 *   page  — route-bound navigable unit
 *   dock  — persistent container shell in the graph
 *   view  — composable stateful component
 *   part  — atomic stateless primitive
 *
 * Source: definations.md, tasks.md Phase 6
*/

import { page } from './page.js';
import { dock } from './dock.js';
import { view } from './view.js';
import { part } from './part.js';

export { page, dock, view, part };
