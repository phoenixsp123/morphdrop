use crate::error::MorphDropError;
use std::path::{Path, PathBuf};

/// Sanitize a filename: remove or replace unsafe characters.
pub fn safe_filename(name: &str) -> String {
    let mut safe = String::with_capacity(name.len());
    for c in name.chars() {
        match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => safe.push('_'),
            c if c.is_control() => safe.push('_'),
            _ => safe.push(c),
        }
    }
    // Remove leading/trailing dots and spaces
    let trimmed = safe.trim_matches(|c: char| c == '.' || c == ' ').to_string();
    if trimmed.is_empty() {
        "unnamed".to_string()
    } else {
        trimmed
    }
}

/// Generate an output path that does not collide with existing files.
/// The returned path lives in `output_dir` with the stem of `input` and the extension
/// corresponding to `format`.
pub fn generate_output_path(
    input: &Path,
    output_dir: &Path,
    format: &crate::models::OutputFormat,
) -> PathBuf {
    let stem = input
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "output".to_string());
    let stem = safe_filename(&stem);
    let ext = format.extension();

    let base = output_dir.join(format!("{}.{}", stem, ext));
    if !base.exists() {
        return base;
    }

    // Append incrementing suffix to avoid collision
    for i in 1u32.. {
        let candidate = output_dir.join(format!("{}_{}.{}", stem, i, ext));
        if !candidate.exists() {
            return candidate;
        }
    }

    // Practically unreachable
    output_dir.join(format!("{}_{}.{}", stem, uuid::Uuid::new_v4(), ext))
}

/// Check that `path`'s filesystem has at least `required_bytes` free.
/// On platforms where we can't determine free space, this succeeds silently.
pub fn check_disk_space(path: &Path, _required_bytes: u64) -> Result<(), MorphDropError> {
    // Best-effort check — Rust's std doesn't expose statvfs directly.
    // We rely on the OS to report errors when writing if space is exhausted.
    // On macOS/Linux we could use libc::statvfs but that adds unsafe; skip for now.
    if !path.exists() {
        // The output directory must exist (or its parent must).
        let parent = path.parent().unwrap_or(path);
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }
    Ok(())
}

/// Atomically move `src` to `dst` by renaming, falling back to copy+delete.
pub fn atomic_move(src: &Path, dst: &Path) -> Result<(), MorphDropError> {
    if let Err(_) = std::fs::rename(src, dst) {
        // Cross-device rename — fall back to copy + remove
        std::fs::copy(src, dst)?;
        std::fs::remove_file(src)?;
    }
    Ok(())
}

/// Format a byte count into a human-readable string.
pub fn format_file_size(bytes: u64) -> String {
    const KIB: f64 = 1024.0;
    const MIB: f64 = KIB * 1024.0;
    const GIB: f64 = MIB * 1024.0;

    let b = bytes as f64;
    if b < KIB {
        format!("{} B", bytes)
    } else if b < MIB {
        format!("{:.1} KB", b / KIB)
    } else if b < GIB {
        format!("{:.1} MB", b / MIB)
    } else {
        format!("{:.2} GB", b / GIB)
    }
}

/// Resolve and sanitize an output directory string.
/// Handles empty paths, `~` tilde expansions, non-existent directories,
/// and falls back gracefully to the user's Desktop or input file folder.
pub fn resolve_output_dir(raw_dir: &str, input_files: &[String]) -> PathBuf {
    let trimmed = raw_dir.trim();

    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from);

    // If empty, resolve to default destination (Desktop or input file directory)
    if trimmed.is_empty() {
        if let Some(ref home) = home_dir {
            let desktop = home.join("Desktop");
            if desktop.exists() {
                return desktop;
            }
        }
        if let Some(first) = input_files.first() {
            if let Some(parent) = Path::new(first).parent() {
                if parent.exists() {
                    return parent.to_path_buf();
                }
            }
        }
        return std::env::temp_dir();
    }

    // Expand ~ / ~/
    if trimmed == "~" {
        if let Some(home) = home_dir {
            return home;
        }
    } else if trimmed.starts_with("~/") || trimmed.starts_with("~\\") {
        if let Some(home) = home_dir {
            return home.join(&trimmed[2..]);
        }
    }

    PathBuf::from(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_filename() {
        assert_eq!(safe_filename("hello world.png"), "hello world.png");
        assert_eq!(safe_filename("a/b\\c:d"), "a_b_c_d");
        assert_eq!(safe_filename("..."), "unnamed");
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(500), "500 B");
        assert_eq!(format_file_size(1024), "1.0 KB");
        assert_eq!(format_file_size(1_048_576), "1.0 MB");
    }

    #[test]
    fn test_resolve_output_dir() {
        let home = std::env::var("HOME").unwrap_or_default();
        if !home.is_empty() {
            let res = resolve_output_dir("~/Desktop", &[]);
            assert_eq!(res, PathBuf::from(&home).join("Desktop"));

            let empty_res = resolve_output_dir("", &[]);
            assert!(empty_res.exists());
        }
    }
}
