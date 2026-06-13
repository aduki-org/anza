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
  let aligned = align(&clean);

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
        } else if (msg.kind === 'js' || msg.kind === 'html' || msg.kind === 'reload') {
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

  let mut out = aligned;
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

fn check(attrs: &str) -> bool {
  let mut pos = 0;
  while let Some(idx) = attrs[pos..].find("id") {
    let id_start = pos + idx;
    pos = id_start + 2;
    let after_id = &attrs[pos..];
    let mut chars = after_id.chars();
    let mut found_eq = false;
    let mut next_char = chars.next();
    while let Some(c) = next_char {
      if c.is_whitespace() {
        next_char = chars.next();
        continue;
      }
      if c == '=' {
        found_eq = true;
        break;
      }
      break;
    }
    if !found_eq {
      continue;
    }
    let mut val = String::new();
    let mut quote = None;
    let mut started = false;
    while let Some(c) = chars.next() {
      if !started {
        if c.is_whitespace() {
          continue;
        }
        if c == '"' || c == '\'' {
          quote = Some(c);
          started = true;
          continue;
        }
        started = true;
        val.push(c);
        continue;
      }
      if let Some(q) = quote {
        if c == q {
          break;
        }
        val.push(c);
      } else {
        if c.is_whitespace() || c == '>' || c == '/' {
          break;
        }
        val.push(c);
      }
    }
    if val == "main" {
      return true;
    }
  }
  false
}

pub fn align(html: &str) -> String {
  let mut result = html.to_string();
  let mut pos = 0;

  while let Some(start_idx) = result[pos..].find("<main") {
    let abs_start = pos + start_idx;
    if let Some(end_offset) = result[abs_start..].find('>') {
      let abs_end = abs_start + end_offset;
      let attrs = &result[(abs_start + 5)..abs_end];
      if check(attrs) {
        result.replace_range(abs_start..(abs_start + 5), "<dock-main");
        let search_start = abs_end + 5;
        if let Some(close_offset) = result[search_start..].find("</main>") {
          let abs_close = search_start + close_offset;
          result.replace_range(abs_close..(abs_close + 7), "</dock-main>");
        }
        break;
      }
      pos = abs_end + 1;
    } else {
      break;
    }
  }
  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn aligns_standard_main_element() {
    let input = "<body>\n  <main id=\"main\">\n    <p>content</p>\n  </main>\n</body>";
    let expected = "<body>\n  <dock-main id=\"main\">\n    <p>content</p>\n  </dock-main>\n</body>";
    assert_eq!(align(input), expected);
  }

  #[test]
  fn aligns_main_element_with_single_quotes() {
    let input = "<body><main id='main'></main></body>";
    let expected = "<body><dock-main id='main'></dock-main></body>";
    assert_eq!(align(input), expected);
  }

  #[test]
  fn aligns_main_element_with_classes_and_spaces() {
    let input = "<body><main class=\"container\"  id  =  \"main\"  data-test>hello</main></body>";
    let expected = "<body><dock-main class=\"container\"  id  =  \"main\"  data-test>hello</dock-main></body>";
    assert_eq!(align(input), expected);
  }

  #[test]
  fn skips_other_main_elements() {
    let input = "<body><main id=\"other\"></main></body>";
    assert_eq!(align(input), input);
  }
}
