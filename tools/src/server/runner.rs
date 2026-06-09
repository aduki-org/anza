// tools/src/server/runner.rs

use std::convert::Infallible;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::{
  body::Body,
  extract::State,
  handler::Handler,
  http::{header, Response, StatusCode},
  response::sse::{Event, KeepAlive, Sse},
  routing::get,
  Router,
};
use futures_util::stream::{self, Stream};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::types::HmrMessage;

pub struct ServerState {
  pub tx: broadcast::Sender<HmrMessage>,
  pub src_dir: PathBuf,
}

pub async fn run(port: u16, src_dir: &Path, tx: broadcast::Sender<HmrMessage>) {
  let state = Arc::new(ServerState {
    tx,
    src_dir: src_dir.to_path_buf(),
  });

  let serve_dir = ServeDir::new(src_dir).fallback(handle_html_fallback.with_state(state.clone()));

  let app = Router::new()
    .route("/hmr", get(hmr_handler))
    .nest_service("/dist", serve_dir.clone())
    .fallback_service(serve_dir)
    .layer(CorsLayer::permissive())
    .with_state(state);

  let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
    .await
    .unwrap();
  logs::server!("Dev Server launched at http://localhost:{}", port);

  axum::serve(listener, app).await.unwrap();
}

async fn hmr_handler(
  State(state): State<Arc<ServerState>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
  let rx = state.tx.subscribe();
  logs::server!("SSE browser client subscribed to hot reload stream");

  let stream = stream::unfold(rx, |mut rx| async move {
    match rx.recv().await {
      Ok(msg) => {
        logs::hmr!(
          "Dispatched live reload event: {:?} -> {}",
          msg.kind,
          msg.path
        );
        let event = Event::default().data(serde_json::to_string(&msg).unwrap_or_default());
        Some((Ok(event), rx))
      }
      Err(_) => None,
    }
  });

  Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(30)))
}

/// Automatically serves HTML files, falling back to index.html for SPA routing.
async fn handle_html_fallback(
  State(state): State<Arc<ServerState>>,
  req: axum::http::Request<Body>,
) -> Response<Body> {
  let path = req.uri().path();
  let file_path = state.src_dir.join(path.trim_start_matches('/'));

  let html_file = if file_path.is_dir() {
    file_path.join("index.html")
  } else if file_path.extension().map_or(false, |ext| ext == "html") && file_path.exists() {
    file_path
  } else {
    // SPA Fallback: serve dist/index.html
    state.src_dir.join("index.html")
  };

  match std::fs::read_to_string(&html_file) {
    Ok(html) => {
      logs::server!("Serving HTML fallback: {}", html_file.display());
      Response::builder()
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(html))
        .unwrap()
    }
    Err(_) => Response::builder()
      .status(StatusCode::NOT_FOUND)
      .body(Body::from("404 Not Found"))
      .unwrap(),
  }
}
