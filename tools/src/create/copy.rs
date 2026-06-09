use std::fs;
use std::path::Path;

pub fn copy(src: &Path, dst: &Path) -> std::io::Result<()> {
  fs::create_dir_all(dst)?;
  for entry in fs::read_dir(src)? {
    let entry = entry?;
    let from = entry.path();
    let to = dst.join(entry.file_name());
    if entry.file_type()?.is_dir() {
      copy(&from, &to)?;
    } else {
      fs::copy(&from, &to)?;
    }
  }
  Ok(())
}
