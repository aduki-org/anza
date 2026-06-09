// tools/src/types/runner.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
  Css,
  Js,
  Html,
  Reload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HmrMessage {
  pub kind: ChangeKind,
  pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PropConfig {
  pub prop_type: String,
  pub reflect: bool,
  pub state: bool,
  pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtractedSpec {
  pub tag: String,
  /// Definition kind: "page" | "dock" | "view" | "part" | "element" | "container".
  pub kind: String,
  pub props: std::collections::HashMap<String, PropConfig>,
  pub methods: Vec<String>,
  pub url: Option<String>,
  pub container: Option<String>,
  /// Ordered container chain (root-to-leaf) declared by a `page` via `via`.
  pub via: Vec<String>,
  /// Parent dock name declared by a `dock`.
  pub parent: Option<String>,
  pub meta: std::collections::HashMap<String, String>,
}
