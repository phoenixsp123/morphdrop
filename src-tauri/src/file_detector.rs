use crate::error::MorphDropError;
use crate::models::{FileInfo, FileType};
use std::fs;
use std::path::{Path, PathBuf};

/// Detect the type of a single file by reading its magic bytes and analyzing content.
pub fn detect_file(path: &Path) -> Result<FileInfo, MorphDropError> {
    if !path.exists() {
        return Err(MorphDropError::ValidationError(format!(
            "File not found: {}",
            path.display()
        )));
    }

    let metadata = fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(MorphDropError::ValidationError(format!(
            "Not a file: {}",
            path.display()
        )));
    }

    let size_bytes = metadata.len();
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Read first 32 bytes for magic-byte detection
    let header = read_header(path, 32)?;

    let (detected_type, mime_type) = detect_from_magic(&header, &extension, path);

    Ok(FileInfo {
        path: path.to_string_lossy().to_string(),
        filename,
        extension,
        detected_type,
        size_bytes,
        mime_type,
    })
}

/// Detect types for multiple files.
pub fn detect_files(paths: &[PathBuf]) -> Result<Vec<FileInfo>, MorphDropError> {
    paths.iter().map(|p| detect_file(p)).collect()
}

/// Read the first `n` bytes of a file.
fn read_header(path: &Path, n: usize) -> Result<Vec<u8>, MorphDropError> {
    use std::io::Read;
    let mut file = fs::File::open(path)?;
    let mut buf = vec![0u8; n];
    let bytes_read = file.read(&mut buf)?;
    buf.truncate(bytes_read);
    Ok(buf)
}

/// Identify file type from magic bytes, falling back to extension and content analysis.
fn detect_from_magic(header: &[u8], extension: &str, path: &Path) -> (FileType, String) {
    // --- Binary magic bytes ---

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if header.len() >= 8 && header[..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        return (FileType::Image, "image/png".into());
    }

    // JPEG: FF D8 FF
    if header.len() >= 3 && header[..3] == [0xFF, 0xD8, 0xFF] {
        return (FileType::Image, "image/jpeg".into());
    }

    // GIF: 47 49 46 38
    if header.len() >= 4 && header[..4] == [0x47, 0x49, 0x46, 0x38] {
        return (FileType::Image, "image/gif".into());
    }

    // BMP: 42 4D
    if header.len() >= 2 && header[..2] == [0x42, 0x4D] {
        return (FileType::Image, "image/bmp".into());
    }

    // TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
    if header.len() >= 4
        && (header[..4] == [0x49, 0x49, 0x2A, 0x00]
            || header[..4] == [0x4D, 0x4D, 0x00, 0x2A])
    {
        return (FileType::Image, "image/tiff".into());
    }

    // WEBP: RIFF....WEBP
    if header.len() >= 12
        && header[..4] == [0x52, 0x49, 0x46, 0x46]
        && header[8..12] == [0x57, 0x45, 0x42, 0x50]
    {
        return (FileType::Image, "image/webp".into());
    }

    // AVIF: ....ftypavif or ....ftypavis
    if header.len() >= 12 && header[4..8] == [0x66, 0x74, 0x79, 0x70] {
        let brand = &header[8..12];
        if brand == b"avif" || brand == b"avis" {
            return (FileType::Image, "image/avif".into());
        }
    }

    // ICO: 00 00 01 00
    if header.len() >= 4 && header[..4] == [0x00, 0x00, 0x01, 0x00] {
        return (FileType::Image, "image/x-icon".into());
    }

    // PDF: %PDF
    if header.len() >= 4 && header[..4] == [0x25, 0x50, 0x44, 0x46] {
        return (FileType::Document, "application/pdf".into());
    }

    // ZIP (also covers XLSX, DOCX, PPTX, ODT, etc.): 50 4B 03 04
    if header.len() >= 4 && header[..4] == [0x50, 0x4B, 0x03, 0x04] {
        match extension {
            "docx" => {
                return (
                    FileType::Document,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document".into(),
                )
            }
            "xlsx" => {
                return (
                    FileType::Document,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".into(),
                )
            }
            "pptx" => {
                return (
                    FileType::Document,
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation".into(),
                )
            }
            "odt" => {
                return (
                    FileType::Document,
                    "application/vnd.oasis.opendocument.text".into(),
                )
            }
            _ => return (FileType::Archive, "application/zip".into()),
        }
    }

    // 7z: 37 7A BC AF 27 1C
    if header.len() >= 6
        && header[..6] == [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]
    {
        return (FileType::Archive, "application/x-7z-compressed".into());
    }

    // GZIP: 1F 8B
    if header.len() >= 2 && header[..2] == [0x1F, 0x8B] {
        return (FileType::Archive, "application/gzip".into());
    }

    // --- Text-based formats: analyze content ---
    if let Ok(content) = fs::read_to_string(path) {
        let trimmed = content.trim_start();

        // JSON
        if (trimmed.starts_with('{') || trimmed.starts_with('['))
            && serde_json::from_str::<serde_json::Value>(trimmed).is_ok()
        {
            return (FileType::StructuredData, "application/json".into());
        }

        // XML
        if trimmed.starts_with("<?xml") || trimmed.starts_with('<') {
            if trimmed.contains("</") || trimmed.contains("/>") {
                return (FileType::StructuredData, "application/xml".into());
            }
        }

        // YAML (by extension, since YAML is hard to detect purely by content)
        if extension == "yaml" || extension == "yml" {
            return (FileType::StructuredData, "application/x-yaml".into());
        }

        // CSV / TSV by extension or comma/tab prevalence
        if extension == "csv" {
            return (FileType::StructuredData, "text/csv".into());
        }
        if extension == "tsv" {
            return (FileType::StructuredData, "text/tab-separated-values".into());
        }

        // Attempt heuristic: if many lines have the same number of commas, likely CSV
        if extension.is_empty() || extension == "txt" {
            let lines: Vec<&str> = trimmed.lines().take(10).collect();
            if lines.len() >= 2 {
                let comma_counts: Vec<usize> = lines.iter().map(|l| l.matches(',').count()).collect();
                if comma_counts[0] > 0 && comma_counts.iter().all(|&c| c == comma_counts[0]) {
                    return (FileType::StructuredData, "text/csv".into());
                }
                let tab_counts: Vec<usize> = lines.iter().map(|l| l.matches('\t').count()).collect();
                if tab_counts[0] > 0 && tab_counts.iter().all(|&c| c == tab_counts[0]) {
                    return (
                        FileType::StructuredData,
                        "text/tab-separated-values".into(),
                    );
                }
            }
        }
    }

    // Fallback: use extension via mime_guess
    let mime = mime_guess::from_ext(extension)
        .first_raw()
        .unwrap_or("application/octet-stream");

    let file_type = match extension.as_ref() {
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "tiff" | "tif" | "webp" | "ico" | "avif"
        | "svg" => FileType::Image,
        "mp4" | "avi" | "mov" | "mkv" | "wmv" | "flv" => FileType::Video,
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" => FileType::Audio,
        "pdf" | "doc" | "docx" | "rtf" | "odt" => FileType::Document,
        "zip" | "rar" | "7z" | "gz" | "tar" | "bz2" | "xz" => FileType::Archive,
        "json" | "csv" | "tsv" | "yaml" | "yml" | "xml" | "toml" => FileType::StructuredData,
        _ => FileType::Unknown,
    };

    (file_type, mime.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_detect_png_header() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.png");
        let mut f = fs::File::create(&path).unwrap();
        // Minimal PNG header
        f.write_all(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
            .unwrap();
        let info = detect_file(&path).unwrap();
        assert_eq!(info.detected_type, FileType::Image);
        assert_eq!(info.mime_type, "image/png");
    }
}
