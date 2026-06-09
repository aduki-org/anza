/**
 * src/elements/index.js
 *
 * Public Custom Elements barrel.
 * Each `export ... from` re-export registers the element as a side-effect
 * AND exports the class reference directly — no customElements.get() needed.
 *
 * Import the full kit:     import '@adukiorg/anza/elements';
 * Import one element:      import '@adukiorg/anza/elements/button';
 * Import specific class:   import { Button } from '@adukiorg/anza/elements';
 */

// 1. Primitives
export { Button }   from './primitives/button/index.js';
export { Icon }     from './primitives/icon/index.js';
export { Badge }    from './primitives/badge/index.js';
export { Avatar }   from './primitives/avatar/index.js';
export { Divider }  from './primitives/divider/index.js';
export { Text }     from './primitives/text/index.js';
export { Link }     from './primitives/link/index.js';
export { Spinner }  from './primitives/spinner/index.js';

// 2. Forms
export { Input }    from './forms/input/index.js';
export { Textarea } from './forms/textarea/index.js';
export { Select }   from './forms/select/index.js';
export { Checkbox } from './forms/checkbox/index.js';
export { Radio }    from './forms/radio/index.js';
export { Toggle }   from './forms/toggle/index.js';
export { Field }    from './forms/field/index.js';
export { Upload }   from './forms/upload/index.js';
export { Form }     from './forms/form/index.js';

// 3. Overlay
export { Dialog }   from './overlay/dialog/index.js';
export { Popover }  from './overlay/popover/index.js';
export { Tooltip }  from './overlay/tooltip/index.js';
export { Menu }     from './overlay/menu/index.js';
export { Drawer }   from './overlay/drawer/index.js';
export { Sheet }    from './overlay/sheet/index.js';

// 4. Feedback
export { Alert }    from './feedback/alert/index.js';
export { Toast, show as showToast } from './feedback/toast/index.js';
export { Progress } from './feedback/progress/index.js';
export { Skeleton } from './feedback/skeleton/index.js';
export { Empty }    from './feedback/empty/index.js';

// 5. Data
export { Table }    from './data/table/index.js';
export { List }     from './data/list/index.js';
export { Card }     from './data/card/index.js';
export { Chart }    from './data/chart/index.js';
export { Stat }     from './data/stat/index.js';

// 6. Navigation
export { Nav }        from './navigation/nav/index.js';
export { Tabs }       from './navigation/tabs/index.js';
export { Breadcrumb } from './navigation/breadcrumb/index.js';
export { Pagination } from './navigation/pagination/index.js';
export { Steps }      from './navigation/steps/index.js';

// 7. Layout
export { App }     from './layout/app/index.js';
export { Header }  from './layout/header/index.js';
export { Sidebar } from './layout/sidebar/index.js';
export { Stack }   from './layout/stack/index.js';
export { Grid }    from './layout/grid/index.js';
export { Split }   from './layout/split/index.js';
export { Scroll }  from './layout/scroll/index.js';
export { Surface } from './layout/surface/index.js';
