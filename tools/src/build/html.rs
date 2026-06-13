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
pub fn inject_assets(html: &str, map: &HashMap<String, String>, dev: bool) -> String {
  let clean = strip_importmap(html);

  let json = serde_json::json!({ "imports": map });
  let text = serde_json::to_string_pretty(&json).unwrap_or_default();
  let tag = format!(
    "\n<script type=\"importmap\">\n{}\n</script>\n",
    text
  );

  let hmr = if dev {
    r#"
<!-- Native HMR Live-Reload Script -->
<script type="module">
  let sse;
  let retry = 500;

  function connect() {
    sse = new EventSource('/hmr');

    sse.addEventListener('message', async (e) => {
      retry = 500; // reset back-off on successful message
      try {
        const msg = JSON.parse(e.data);

        if (msg.kind === 'css') {
          // Hot-swap: update all <link> tags that reference this file.
          const links = document.querySelectorAll(`link[rel="stylesheet"]`);
          for (const link of links) {
            const url = new URL(link.href, location.origin);
            if (url.pathname.includes(msg.path)) {
              url.searchParams.set('t', Date.now());
              link.href = url.href;
            }
          }
          // Also notify any constructable-stylesheet consumers.
          const res = await fetch(`/dist/${msg.path}?t=${Date.now()}`);
          if (res.ok) {
            const css = await res.text();
            window.dispatchEvent(new CustomEvent('anza:hmr:css', {
              detail: { path: msg.path, css }
            }));
          }
        } else if (msg.kind === 'html') {
          const res = await fetch(`/dist/${msg.path}?t=${Date.now()}`);
          if (res.ok) {
            const html = await res.text();
            window.dispatchEvent(new CustomEvent('anza:hmr:html', {
              detail: { path: msg.path, html }
            }));
          }
        } else if (msg.kind === 'js' || msg.kind === 'reload') {
          location.reload();
        }
      } catch (err) {
        console.warn('[HMR] Failed to process event:', err);
      }
    });

    sse.onerror = () => {
      // Server restarted or connection dropped — reconnect with back-off.
      sse.close();
      setTimeout(() => {
        retry = Math.min(retry * 2, 10_000);
        connect();
      }, retry);
    };
  }

  connect();
</script>
"#
  } else {
    ""
  };

  let mut out = clean;
  if let Some(pos) = out.find("<head>") {
    let insert = pos + 6;
    out.insert_str(insert, &tag);
  } else if let Some(pos) = out.find("<html>") {
    let insert = pos + 6;
    let combined = format!("<head>{}</head>", tag);
    out.insert_str(insert, &combined);
  } else {
    out.insert_str(0, &tag);
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

