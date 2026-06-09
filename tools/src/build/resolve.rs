// tools/src/build/resolve.rs
//
// Import specifier resolution: maps bare specifiers through import maps,
// resolves relative paths, and checks the library source directory.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::graph::Resolution;

/// Resolve an import specifier against import maps and the filesystem.
pub fn spec(
  spec: &str,
  importer: &Path,
  src: &Path,
  project: &Path,
  user: &HashMap<String, String>,
  lib: &HashMap<String, String>,
  lib_src: &Option<PathBuf>,
) -> Resolution {
  if spec.starts_with("http://") || spec.starts_with("https://") || spec.starts_with("data:") {
    return Resolution::External;
  }

  // Relative / absolute filesystem specifiers.
  if spec.starts_with("./") || spec.starts_with("../") {
    return finalize(importer.join(spec));
  }
  if let Some(stripped) = spec.strip_prefix('/') {
    return finalize(src.join(stripped));
  }

  // 1. Check user import map
  if let Some(target) = user.get(spec) {
    if target.starts_with("http://") || target.starts_with("https://") {
      return Resolution::External;
    }
    let path = if let Some(stripped) = target.strip_prefix('/') {
      project.join(stripped)
    } else {
      project.join(target)
    };
    return finalize(path);
  }

  // 2. Check library import map
  if let Some(target) = lib.get(spec) {
    if target.starts_with("http://") || target.starts_with("https://") {
      return Resolution::External;
    }
    if let Some(ref src_dir) = lib_src {
      let rel = target.strip_prefix("/dist/").unwrap_or(target);
      let path = src_dir.join(rel);
      return finalize(path);
    }
  }

  Resolution::Missing
}

fn finalize(candidate: PathBuf) -> Resolution {
  let has_ext = candidate.extension().is_some();

  if candidate.is_file() {
    return Resolution::File(candidate, false);
  }

  if candidate.is_dir() {
    let idx = candidate.join("index.js");
    if idx.is_file() {
      return Resolution::File(idx, true);
    }
  }

  if !has_ext {
    let js = candidate.with_extension("js");
    if js.is_file() {
      return Resolution::File(js, true);
    }
  }

  Resolution::Missing
}

/// Walk upward from the project to find the library directory.
pub fn library(project: &Path) -> Option<PathBuf> {
  let mut current = project.to_path_buf();
  loop {
    let node_modules_path = current.join("node_modules").join("@adukiorg").join("anza");
    if node_modules_path.exists() {
      return Some(node_modules_path);
    }
    let local_path = current.join("library");
    if local_path.exists() {
      return Some(local_path);
    }
    if let Ok(text) = std::fs::read_to_string(current.join("package.json")) {
      if text.contains(r#""name": "@adukiorg/anza""#) {
        return Some(current);
      }
    }
    if let Some(parent) = current.parent() {
      current = parent.to_path_buf();
    } else {
      break;
    }
  }
  None
}

/// Load an importmap.json from a directory.
pub fn load_map(dir: &Path) -> HashMap<String, String> {
  let mut map = HashMap::new();
  let path = dir.join("importmap.json");
  if let Ok(text) = std::fs::read_to_string(&path) {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
      if let Some(imports) = json.get("imports").and_then(|v| v.as_object()) {
        for (k, v) in imports {
          if let Some(s) = v.as_str() {
            map.insert(k.clone(), s.to_string());
          }
        }
      }
    }
  }
  map
}
