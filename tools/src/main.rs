// tools/src/main.rs

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tokio::sync::broadcast;

mod build;
mod create;
mod extract;
mod server;
mod types;
mod watcher;

use types::HmrMessage;

#[derive(Parser, Debug)]
#[command(
  name = "anza",
  version = "0.3.2",
  about = "Anza web platform library — reactive state, networking, offline, animations, custom elements. Zero build step. Pure browser ESM."
)]
struct Args {
  #[command(subcommand)]
  command: Option<Command>,

  #[arg(short, long, default_value = "src")]
  src: String,

  #[arg(short, long, default_value = "3000")]
  port: u16,

  #[arg(long, default_value = "dist")]
  dist: String,

  #[arg(short, long)]
  build: bool,
}

#[derive(Subcommand, Debug)]
enum Command {
  Scan {
    #[arg(short, long, default_value = "src")]
    src: String,

    #[arg(long)]
    watch: bool,

    #[arg(long, default_value = "dist/types")]
    types: String,
  },
  Build {
    #[arg(short, long, default_value = "src")]
    src: String,

    #[arg(long, default_value = "dist")]
    dist: String,

    /// Entry module(s) to resolve from. Defaults to src/index.js plus any
    /// HTML module scripts discovered under src.
    #[arg(short, long)]
    entry: Vec<String>,
  },
  Dev {
    #[arg(short, long, default_value = "src")]
    src: String,

    #[arg(short, long, default_value = "3000")]
    port: u16,

    #[arg(long, default_value = "dist")]
    dist: String,

    /// Entry module(s) to resolve from.
    #[arg(short, long)]
    entry: Vec<String>,
  },
  Doctor {
    #[arg(short, long, default_value = "src")]
    src: String,
  },
  Create {
    /// Name of the new app directory.
    name: String,
  },
}

#[tokio::main]
async fn main() {
  // Bootstrap colored logger
  logs::init();

  let args = Args::parse();

  if let Some(command) = args.command {
    match command {
      Command::Scan { src, watch, types } => {
        let src = PathBuf::from(src);
        let types = PathBuf::from(types);
        extract::run(&src, &types);

        if watch {
          let dist = types
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("dist"));
          let (tx, _rx) = broadcast::channel::<HmrMessage>(16);
          watcher::start(src, dist, Vec::new(), tx);
          tokio::signal::ctrl_c().await.unwrap();
        }
      }
      Command::Build { src, dist, entry } => {
        let entries: Vec<PathBuf> = entry.into_iter().map(PathBuf::from).collect();
        extract::build(&PathBuf::from(src), &PathBuf::from(dist), &entries);
      }
      Command::Dev {
        src,
        port,
        dist,
        entry,
      } => {
        let entries: Vec<PathBuf> = entry.into_iter().map(PathBuf::from).collect();
        run_dev(PathBuf::from(src), PathBuf::from(dist), port, entries).await;
      }
      Command::Doctor { src } => {
        run_doctor(PathBuf::from(src));
      }
      Command::Create { name } => {
        let target = std::env::current_dir()
          .unwrap_or_else(|_| PathBuf::from("."))
          .join(&name);
        create::run(&target, &name);
        return;
      }
    }
    return;
  }

  let src = PathBuf::from(&args.src);
  let dist = PathBuf::from(&args.dist);

  if args.build {
    extract::build(&src, &dist, &[]);
    return;
  }

  run_dev(src, dist, args.port, Vec::new()).await;
}

async fn run_dev(src: PathBuf, dist: PathBuf, port: u16, entries: Vec<PathBuf>) {
  logs::info!("Bootstrapping native dev pipeline...");

  // 1. Initial full compile: extraction + import-graph resolution into dist.
  //    Non-fatal so the dev server starts even with errors to iterate on.
  extract::compile(&src, &dist, false, &entries);

  // 2. Setup communication channels for HMR events
  let (tx, _rx) = broadcast::channel::<HmrMessage>(16);

  // 3. Spawn Axum static + SSE Server serving the generated dist
  let server_dist = dist.clone();
  let server_tx = tx.clone();
  tokio::spawn(async move {
    server::run(port, &server_dist, server_tx).await;
  });

  // 4. Start concurrent watcher thread (rebuilds dist on change)
  watcher::start(src, dist, entries, tx);

  // 5. Run until terminate signal
  tokio::signal::ctrl_c().await.unwrap();
  logs::info!("Shutting down native pipeline safely.");
}

fn run_doctor(src: PathBuf) {
  logs::info!("Running anza doctor check...");
  logs::info!("Source directory: {}", src.display());

  // Check if src directory exists
  if !src.exists() {
    logs::error!("Source directory does not exist: {}", src.display());
    return;
  }

  // Check for index.js
  let index = src.join("index.js");
  if index.exists() {
    logs::success!("Entry point found: src/index.js");
  } else {
    logs::warn!("No src/index.js found - check for HTML entry points");
  }

  // Check for importmap.json
  let importmap = src
    .parent()
    .map(|p| p.join("importmap.json"))
    .unwrap_or_else(|| PathBuf::from("importmap.json"));
  if importmap.exists() {
    logs::success!("Custom import map found: {}", importmap.display());
  } else {
    logs::success!("Using automatic library import map resolution");
  }

  // Check for tokens directory
  let tokens = src.join("tokens");
  if tokens.exists() {
    logs::success!("Design tokens directory found: src/tokens");
  } else {
    logs::warn!("No src/tokens directory found");
  }

  // Check for elements directory
  let elements = src.join("elements");
  if elements.exists() {
    logs::success!("Elements directory found: src/elements");
  } else {
    logs::warn!("No src/elements directory found");
  }

  // Check for the definition-layer directories (page/dock/view/part).
  for dir in ["pages", "docks", "views", "parts"] {
    if src.join(dir).exists() {
      logs::success!("Definition directory found: src/{}", dir);
    }
  }

  // Suggest migrating legacy elements/ to the new definition layer.
  if elements.exists() && src.join("pages").exists() {
    logs::warn!("Both src/elements and src/pages exist — consider migrating legacy ui.element definitions to page/dock/view/part.");
  }

  // Check for core directory
  let core = src.join("core");
  if core.exists() {
    logs::success!("Core directory found: src/core");
  } else {
    logs::warn!("No src/core directory found");
  }

  logs::info!("Doctor check complete");
}
