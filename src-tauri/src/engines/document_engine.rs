use crate::dependency_manager::DependencyManager;
use crate::engines::ConversionEngine;
use crate::error::MorphDropError;
use crate::models::{ConversionSettings, OutputFormat};
use async_trait::async_trait;
use std::path::{Path, PathBuf};

pub struct DocumentEngine;

#[async_trait]
impl ConversionEngine for DocumentEngine {
    fn name(&self) -> &str {
        "DocumentEngine"
    }

    fn supported_input_formats(&self) -> Vec<String> {
        vec![
            "docx".into(),
            "doc".into(),
            "odt".into(),
            "rtf".into(),
            "pdf".into(),
        ]
    }

    fn supported_output_formats(&self) -> Vec<OutputFormat> {
        vec![OutputFormat::Pdf, OutputFormat::Docx]
    }

    fn can_handle(&self, input_format: &str, output_format: &OutputFormat) -> bool {
        let input_lower = input_format.to_lowercase();
        match output_format {
            OutputFormat::Pdf => {
                matches!(input_lower.as_str(), "docx" | "doc" | "odt" | "rtf")
            }
            OutputFormat::Docx => {
                matches!(input_lower.as_str(), "pdf" | "doc" | "odt" | "rtf")
            }
            _ => false,
        }
    }

    async fn convert(
        &self,
        input: &Path,
        output: &Path,
        format: &OutputFormat,
        _settings: &ConversionSettings,
        progress_tx: Option<tokio::sync::mpsc::Sender<f64>>,
    ) -> Result<PathBuf, MorphDropError> {
        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.2).await;
        }

        let out_dir = output.parent().unwrap_or_else(|| Path::new("."));
        let target_ext = match format {
            OutputFormat::Pdf => "pdf",
            OutputFormat::Docx => "docx",
            _ => {
                return Err(MorphDropError::UnsupportedFormat(format!(
                    "DocumentEngine cannot produce {:?}",
                    format
                )))
            }
        };

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.4).await;
        }

        let converted = DependencyManager::convert_document_with_libreoffice(input, out_dir, target_ext)?;

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.8).await;
        }

        // If the generated file path differs from the requested `output` (e.g. collision avoidance renaming like `file_1.pdf`), rename it
        if converted != output && converted.file_name() != output.file_name() {
            if let Some(dest_dir) = output.parent() {
                let _ = std::fs::create_dir_all(dest_dir);
            }
            std::fs::rename(&converted, output).map_err(|e| {
                MorphDropError::ConversionError(format!("Failed to rename {:?} to {:?}: {}", converted, output, e))
            })?;
            if let Some(ref tx) = progress_tx {
                let _ = tx.send(1.0).await;
            }
            return Ok(output.to_path_buf());
        }

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(1.0).await;
        }

        Ok(converted)
    }

    async fn validate_input(&self, input: &Path) -> Result<(), MorphDropError> {
        if !input.exists() {
            return Err(MorphDropError::ValidationError(format!("Input file does not exist: {}", input.display())));
        }
        let ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !matches!(ext.as_str(), "docx" | "doc" | "odt" | "rtf" | "pdf") {
            return Err(MorphDropError::UnsupportedFormat(format!(
                "DocumentEngine does not support .{} files",
                ext
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_handle() {
        let engine = DocumentEngine;
        assert!(engine.can_handle("docx", &OutputFormat::Pdf));
        assert!(engine.can_handle("pdf", &OutputFormat::Docx));
        assert!(engine.can_handle("doc", &OutputFormat::Pdf));
        assert!(!engine.can_handle("pdf", &OutputFormat::Pdf));
        assert!(!engine.can_handle("png", &OutputFormat::Docx));
    }
}
