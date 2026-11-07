use crate::engines::ConversionEngine;
use crate::error::MorphDropError;
use crate::models::{ConversionSettings, OutputFormat};
use async_trait::async_trait;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::FileOptions;
use zip::ZipWriter;

pub struct ArchiveEngine;

/// Maximum decompressed size allowed (1 GB) — protect against decompression bombs.
const MAX_DECOMPRESSED_SIZE: u64 = 1_073_741_824;

/// Maximum path depth allowed for zip entries.
const MAX_PATH_DEPTH: usize = 50;

impl ArchiveEngine {
    /// Create a ZIP archive from a list of files.
    pub fn create_zip(files: &[&Path], output: &Path) -> Result<PathBuf, MorphDropError> {
        let out_file = fs::File::create(output)?;
        let mut zip = ZipWriter::new(out_file);
        let options: FileOptions<'_, ()> =
            FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        for path in files {
            let filename = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unnamed".into());
            let safe_name = crate::utils::safe_filename(&filename);
            zip.start_file(&safe_name, options.clone())?;
            let data = fs::read(path)?;
            zip.write_all(&data)?;
        }

        zip.finish()?;
        Ok(output.to_path_buf())
    }

    /// Extract a ZIP archive to a directory, with path-traversal and bomb protection.
    pub fn extract_zip(archive: &Path, output_dir: &Path) -> Result<Vec<PathBuf>, MorphDropError> {
        let file = fs::File::open(archive)?;
        let mut zip = zip::ZipArchive::new(file)
            .map_err(|e| MorphDropError::ArchiveError(format!("Invalid ZIP: {}", e)))?;

        fs::create_dir_all(output_dir)?;
        let canonical_out = output_dir.canonicalize()?;

        let mut total_size: u64 = 0;
        let mut extracted = Vec::new();

        for i in 0..zip.len() {
            let mut entry = zip
                .by_index(i)
                .map_err(|e| MorphDropError::ArchiveError(e.to_string()))?;

            let entry_name = entry.name().to_string();

            // Path-traversal check
            if entry_name.contains("..") {
                return Err(MorphDropError::ArchiveError(format!(
                    "Path traversal detected in entry: {}",
                    entry_name
                )));
            }

            // Depth check
            if entry_name.split('/').count() > MAX_PATH_DEPTH {
                return Err(MorphDropError::ArchiveError(format!(
                    "Entry path too deep: {}",
                    entry_name
                )));
            }

            let out_path = output_dir.join(&entry_name);

            // Verify the output path is within the target directory
            if let Ok(canonical) = out_path.canonicalize() {
                if !canonical.starts_with(&canonical_out) {
                    return Err(MorphDropError::ArchiveError(format!(
                        "Entry escapes target directory: {}",
                        entry_name
                    )));
                }
            }

            // Decompression bomb check
            total_size += entry.size();
            if total_size > MAX_DECOMPRESSED_SIZE {
                return Err(MorphDropError::ArchiveError(format!(
                    "Decompressed size exceeds {} byte limit",
                    MAX_DECOMPRESSED_SIZE
                )));
            }

            if entry.is_dir() {
                fs::create_dir_all(&out_path)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut out_file = fs::File::create(&out_path)?;
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)?;
                out_file.write_all(&buf)?;
                extracted.push(out_path);
            }
        }

        Ok(extracted)
    }

    /// List contents of a ZIP archive without extracting.
    pub fn list_zip(archive: &Path) -> Result<Vec<String>, MorphDropError> {
        let file = fs::File::open(archive)?;
        let zip = zip::ZipArchive::new(file)
            .map_err(|e| MorphDropError::ArchiveError(format!("Invalid ZIP: {}", e)))?;

        let names: Vec<String> = (0..zip.len())
            .filter_map(|i| {
                zip.name_for_index(i).map(|n| n.to_string())
            })
            .collect();

        Ok(names)
    }
}

#[async_trait]
impl ConversionEngine for ArchiveEngine {
    fn name(&self) -> &str {
        "ArchiveEngine"
    }

    fn supported_input_formats(&self) -> Vec<String> {
        vec![
            "png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff", "tif", "ico", "avif", "pdf",
            "json", "csv", "tsv", "yaml", "yml", "xml", "txt", "zip",
        ]
        .into_iter()
        .map(String::from)
        .collect()
    }

    fn supported_output_formats(&self) -> Vec<OutputFormat> {
        vec![OutputFormat::Zip]
    }

    fn can_handle(&self, input_format: &str, output_format: &OutputFormat) -> bool {
        let input_lower = input_format.to_lowercase();
        self.supported_input_formats().contains(&input_lower)
            && *output_format == OutputFormat::Zip
    }

    async fn convert(
        &self,
        input: &Path,
        output: &Path,
        _format: &OutputFormat,
        _settings: &ConversionSettings,
        progress_tx: Option<tokio::sync::mpsc::Sender<f64>>,
    ) -> Result<PathBuf, MorphDropError> {
        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.2).await;
        }

        let result = Self::create_zip(&[input], output)?;

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(1.0).await;
        }

        Ok(result)
    }

    async fn validate_input(&self, input: &Path) -> Result<(), MorphDropError> {
        if !input.exists() {
            return Err(MorphDropError::ValidationError(format!(
                "Input file does not exist: {}",
                input.display()
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_create_and_extract_zip() {
        let dir = tempfile::tempdir().unwrap();
        let test_file = dir.path().join("hello.txt");
        fs::write(&test_file, "Hello, world!").unwrap();

        let zip_path = dir.path().join("test.zip");
        ArchiveEngine::create_zip(&[test_file.as_path()], &zip_path).unwrap();
        assert!(zip_path.exists());

        let extract_dir = dir.path().join("extracted");
        let files = ArchiveEngine::extract_zip(&zip_path, &extract_dir).unwrap();
        assert_eq!(files.len(), 1);

        let content = fs::read_to_string(&files[0]).unwrap();
        assert_eq!(content, "Hello, world!");
    }

    #[test]
    fn test_path_traversal_protection() {
        // Create a ZIP with a path-traversal entry (manually)
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("evil.zip");
        let file = fs::File::create(&zip_path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options: FileOptions<'_, ()> = FileOptions::default();
        zip.start_file("../../etc/passwd", options).unwrap();
        zip.write_all(b"evil").unwrap();
        zip.finish().unwrap();

        let extract_dir = dir.path().join("safe");
        let result = ArchiveEngine::extract_zip(&zip_path, &extract_dir);
        assert!(result.is_err());
    }

    #[test]
    fn test_list_zip() {
        let dir = tempfile::tempdir().unwrap();
        let test_file = dir.path().join("data.txt");
        fs::write(&test_file, "data").unwrap();

        let zip_path = dir.path().join("list.zip");
        ArchiveEngine::create_zip(&[test_file.as_path()], &zip_path).unwrap();

        let names = ArchiveEngine::list_zip(&zip_path).unwrap();
        assert_eq!(names.len(), 1);
        assert_eq!(names[0], "data.txt");
    }
}
