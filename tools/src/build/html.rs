// tools/src/build/html.rs
//
// HTML post-processing: strips existing inline import maps and injects
// a `<script type="importmap" src="/importmap.json">` link plus an HMR
// live-reload script in dev mode.

use std::collections::HashMap;

/// Remove any existing inline `<script type="importmap">` blocks.
pub fn strip_importmap(html: &str) -> String {
  let mut result = html.to_string();
  while let Some(start) = result.find("<script type=\"importmap\"") {
    if let Some(end) = result[start..].find("</script>") {
      let absolute_end = start + end + 9;
      result.drain(start..absolute_end);
    } else {
      break;
    }
  }
  result
}

/// Inject importmap link and optional HMR script into an HTML string.
pub fn inject_assets(html: &str, _map: &HashMap<String, String>, dev: bool) -> String {
  let clean = strip_importmap(html);

  let map = r#"
<script type="importmap" src="/importmap.json"></script>
"#;

  let hmr = if dev {
    r#"
<!-- Native HMR Live-Reload Script -->
<script type="module">
  const sse = new EventSource('/hmr');
  sse.addEventListener('message', async (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.kind === 'css') {
        console.log('[HMR] Hot-swapping stylesheet:', msg.path);
        const links = document.querySelectorAll(`link[href*="${msg.path}"]`);
        for (const link of links) {
          const url = new URL(link.href, location.origin);
          url.searchParams.set('hmr', Date.now());
          link.href = url.href;
        }
        const res = await fetch(`/${msg.path}?hmr=${Date.now()}`);
        if (res.ok) {
          const css = await res.text();
          window.dispatchEvent(new CustomEvent('anza:hmr:css', {
            detail: { path: msg.path, css }
          }));
        }
      } else if (msg.kind === 'js' || msg.kind === 'html' || msg.kind === 'reload') {
        console.log('[HMR] Asset changed, performing hot-reload:', msg.path);
        location.reload();
      }
    } catch (err) {
      console.error('[HMR] Error processing message:', err);
    }
  });
</script>
"#
  } else {
    ""
  };

  let mut out = clean;
  if let Some(pos) = out.find("<head>") {
    let insert = pos + 6;
    out.insert_str(insert, &map);
  } else if let Some(pos) = out.find("<html>") {
    let insert = pos + 6;
    let combined = format!("<head>{}</head>", map);
    out.insert_str(insert, &combined);
  } else {
    out.insert_str(0, &map);
  }

  if dev {
    if let Some(pos) = out.rfind("</body>") {
      out.insert_str(pos, hmr);
    } else {
      out.push_str(hmr);
    }
  }

  out
}
