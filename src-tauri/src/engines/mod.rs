pub mod archive_engine;
pub mod image_engine;
pub mod pdf_engine;
pub mod structured_data_engine;

use crate::error::MorphDropError;
use crate::models::{ConversionSettings, OutputFormat};
use async_trait::async_trait;
use std::path::{Path, PathBuf};

/// Trait that every conversion engine must implement.
#[async_trait]
pub trait ConversionEngine: Send + Sync {
    /// Human-readable engine name.
    fn name(&self) -> &str;

    /// File extensions this engine can read (lowercase, no dot).
    fn supported_input_formats(&self) -> Vec<String>;

    /// Output formats this engine can produce.
    fn supported_output_formats(&self) -> Vec<OutputFormat>;

    /// Whether this engine can handle the given input→output pair.
    fn can_handle(&self, input_format: &str, output_format: &OutputFormat) -> bool;

    /// Perform the conversion.
    ///
    /// * `input`  – path to the source file
    /// * `output` – desired output path (engine may adjust extension)
    /// * `format` – target format
    /// * `settings` – user-provided quality / resize options
    /// * `progress_tx` – optional channel to send progress updates (0.0 … 1.0)
    ///
    /// Returns the actual path of the produced file.
    async fn convert(
        &self,
        input: &Path,
        output: &Path,
        format: &OutputFormat,
        settings: &ConversionSettings,
        progress_tx: Option<tokio::sync::mpsc::Sender<f64>>,
    ) -> Result<PathBuf, MorphDropError>;

    /// Quick pre-flight validation of the input file.
    async fn validate_input(&self, input: &Path) -> Result<(), MorphDropError>;
}

/// Manages all registered engines and dispatches conversion requests.
pub struct EngineManager {
    engines: Vec<Box<dyn ConversionEngine>>,
}

impl EngineManager {
    /// Create an `EngineManager` with all built-in engines registered.
    pub fn new() -> Self {
        let engines: Vec<Box<dyn ConversionEngine>> = vec![
            Box::new(image_engine::ImageEngine),
            Box::new(pdf_engine::PdfEngine),
            Box::new(archive_engine::ArchiveEngine),
            Box::new(structured_data_engine::StructuredDataEngine),
        ];
        Self { engines }
    }

    /// Find the first engine that can handle the given conversion.
    pub fn find_engine(
        &self,
        input_format: &str,
        output_format: &OutputFormat,
    ) -> Option<&dyn ConversionEngine> {
        self.engines
            .iter()
            .find(|e| e.can_handle(input_format, output_format))
            .map(|e| e.as_ref())
    }

    /// Perform a conversion, automatically selecting the appropriate engine.
    pub async fn convert(
        &self,
        input: &Path,
        output: &Path,
        format: &OutputFormat,
        settings: &ConversionSettings,
        progress_tx: Option<tokio::sync::mpsc::Sender<f64>>,
    ) -> Result<PathBuf, MorphDropError> {
        let ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let engine = self.find_engine(&ext, format).ok_or_else(|| {
            MorphDropError::UnsupportedFormat(format!(
                "No engine can convert .{} to {}",
                ext,
                format.label()
            ))
        })?;

        engine.validate_input(input).await?;
        engine.convert(input, output, format, settings, progress_tx).await
    }
}
