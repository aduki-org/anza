const wsUrl = "ws://localhost:9222/devtools/page/398998CE306446DA4F9FB846204DFD9B";

const ws = new WebSocket(wsUrl);

ws.addEventListener('open', async () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Network.enable' }));
  ws.send(JSON.stringify({ id: 4, method: 'Page.enable' }));
  
  // Clear all storage, caches, and service workers for the origin
  console.log('Clearing browser storage and service workers...');
  ws.send(JSON.stringify({
    id: 30,
    method: 'Storage.clearDataForOrigin',
    params: {
      origin: 'http://localhost:3000',
      storageTypes: 'all'
    }
  }));

  const script = `
    console.log('[CDP Script] Injected.');
    window.__events_log__ = [];
    let interval = setInterval(() => {
      if (window.router && !window.__intercepted__) {
        window.__intercepted__ = true;
        
        window.router.on('found', (detail) => {
          window.__events_log__.push({ event: 'found', detail });
        });
        
        clearInterval(interval);
      }
    }, 5);
  `;
  
  setTimeout(() => {
    ws.send(JSON.stringify({
      id: 10,
      method: 'Page.addScriptToEvaluateOnNewDocument',
      params: { source: script }
    }));
  }, 100);

  // Reload the page after storage is cleared
  setTimeout(() => {
    console.log('Reloading page...');
    ws.send(JSON.stringify({ id: 11, method: 'Page.reload' }));
  }, 800);

  // Evaluate router state after 5 seconds
  setTimeout(() => {
    const expr = `
      (() => {
        function serializeDOM(el) {
          if (!el) return '';
          let html = '';
          if (el.shadowRoot) {
            html += '#shadow-root(open)\\n' + serializeDOM(el.shadowRoot);
          }
          for (const child of el.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const attrs = Array.from(child.attributes).map(a => a.name + '="' + a.value + '"').join(' ');
              const attrStr = attrs ? ' ' + attrs : '';
              html += '<' + child.tagName.toLowerCase() + attrStr + '>' + serializeDOM(child) + '</' + child.tagName.toLowerCase() + '>\\n';
            } else if (child.nodeType === Node.TEXT_NODE) {
              const val = child.nodeValue.trim();
              if (val) html += val + '\\n';
            }
          }
          return html;
        }
        
        return JSON.stringify({
          url: window.location.href,
          mainDOM: serializeDOM(document.getElementById('main'))
        }, null, 2);
      })()
    `;
    ws.send(JSON.stringify({
      id: 5,
      method: 'Runtime.evaluate',
      params: { expression: expr }
    }));
  }, 5000);
});

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
    console.log(`[Console]`, args);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    console.log(`[Exception]`, msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  } else if (msg.id === 5) {
    console.log('\n--- RENDERED DOM TREE ---');
    try {
      const res = JSON.parse(msg.result?.result?.value || '{}');
      console.log(res);
    } catch {
      console.log(msg.result?.result?.value);
    }
    console.log('-------------------------\n');
    process.exit(0);
  }
});
