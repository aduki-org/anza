import { view } from '../../../src/core/ui/index.js';

// Wait for next macrotask (matches the element implementation scheduleFrame)
const wait = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Multiple CSS Imports', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders multiple stylesheets from an array of inline strings successfully', async () => {
    const tag = 'view-multiple-styles';
    view(tag, {
      template: {
        css: [
          '/* style-1 */ body { color: blue; }',
          '/* style-2 */ h1 { font-size: 20px; }'
        ]
      }
    });

    const el = document.createElement(tag);
    container.appendChild(el);
    await wait();
    await wait(); 

    const hasSheets = el.shadowRoot.adoptedStyleSheets && el.shadowRoot.adoptedStyleSheets.length === 2;
    const hasStyleTags = el.shadowRoot.querySelectorAll('style').length === 2;

    if (!hasSheets && !hasStyleTags) {
      throw new Error(`Expected 2 stylesheets to be applied, got adoptedStyleSheets=${el.shadowRoot.adoptedStyleSheets?.length}, style tags=${el.shadowRoot.querySelectorAll('style').length}`);
    }
  });
});
