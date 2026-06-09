// tools/src/logs/src/fmt.rs

use chrono::Local;
use std::fmt;
use std::sync::Mutex;
use tracing::{Event, Subscriber};
use tracing_subscriber::{
  fmt::{format::Writer, FmtContext, FormatEvent, FormatFields},
  registry::LookupSpan,
};

pub struct CustomFormatter {
  last_date: Mutex<String>,
}

impl Default for CustomFormatter {
  fn default() -> Self {
    Self {
      last_date: Mutex::new(String::new()),
    }
  }
}

impl<S, N> FormatEvent<S, N> for CustomFormatter
where
  S: Subscriber + for<'a> LookupSpan<'a>,
  N: for<'a> FormatFields<'a> + 'static,
{
  fn format_event(
    &self,
    _ctx: &FmtContext<'_, S, N>,
    mut writer: Writer<'_>,
    event: &Event<'_>,
  ) -> fmt::Result {
    let meta = event.metadata();
    let target = meta.target();
    let level = meta.level();

    let now = Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let time = now.format("%H:%M:%S").to_string();

    let color = get_color(target, level);
    let reset = "\x1b[0m";
    let dim = "\x1b[90m";
    let bright = "\x1b[97m";

    let mut last = self.last_date.lock().unwrap();
    if *last != date {
      *last = date.clone();
      drop(last);
      writeln!(writer, "{}> {}{}{}", dim, bright, date, reset)?;
    } else {
      drop(last);
    }

    let label = match target {
      t if t.starts_with("logs::") => t.replace("logs::", "").to_uppercase(),
      t if is_known_category(t) => t.to_uppercase(),
      _ => level.as_str().to_uppercase(),
    };

    write!(
      writer,
      "  {dim}|{reset} {dim}{time}{reset}  {color}{label:>9}{reset}  ",
      dim = dim, reset = reset, time = time, color = color, label = label
    )?;

    let mut visitor = EventVisitor {
      writer: &mut writer,
      has_fields: false,
    };
    event.record(&mut visitor);
    drop(visitor);

    writeln!(writer)
  }
}

fn is_known_category(t: &str) -> bool {
  matches!(
    t,
    "info"
      | "debug"
      | "success"
      | "watcher"
      | "compiler"
      | "server"
      | "hmr"
      | "sync"
  )
}

fn get_color(target: &str, level: &tracing::Level) -> &'static str {
  match target {
    "info" => "\x1b[34m",
    "debug" => "\x1b[90m",
    "success" => "\x1b[1m\x1b[32m",
    "watcher" => "\x1b[93m",
    "compiler" => "\x1b[36m",
    "server" => "\x1b[94m",
    "hmr" => "\x1b[92m",
    "sync" => "\x1b[90m",

    _ => match *level {
      tracing::Level::ERROR => "\x1b[1m\x1b[31m",
      tracing::Level::WARN => "\x1b[1m\x1b[33m",
      tracing::Level::INFO => "\x1b[34m",
      tracing::Level::DEBUG => "\x1b[90m",
      tracing::Level::TRACE => "\x1b[90m",
    },
  }
}

struct EventVisitor<'a, 'writer> {
  writer: &'a mut Writer<'writer>,
  has_fields: bool,
}

impl<'a, 'writer> tracing::field::Visit for EventVisitor<'a, 'writer> {
  fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn fmt::Debug) {
    if field.name() == "message" {
      let format_str = format!("{:?}", value);
      if format_str.starts_with('"') && format_str.ends_with('"') && format_str.len() >= 2 {
        let _ = write!(self.writer, "{}", &format_str[1..format_str.len() - 1]);
      } else {
        let _ = write!(self.writer, "{}", format_str);
      }
    } else {
      if !self.has_fields {
        let _ = write!(self.writer, " \x1b[90m");
        self.has_fields = true;
      } else {
        let _ = write!(self.writer, " ");
      }
      let _ = write!(self.writer, "{}={:?}", field.name(), value);
    }
  }
}

impl<'a, 'writer> Drop for EventVisitor<'a, 'writer> {
  fn drop(&mut self) {
    if self.has_fields {
      let _ = write!(self.writer, "\x1b[0m");
    }
  }
}
