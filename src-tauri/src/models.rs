use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Detected type category of a file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum FileType {
    Image,
    Video,
    Audio,
    Document,
    Archive,
    StructuredData,
    Unknown,
}

/// Supported output formats for conversions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum OutputFormat {
    // Image formats
    Png,
    Jpeg,
    Webp,
    Bmp,
    Tiff,
    Gif,
    Ico,
    Avif,
    // Document
    Pdf,
    // Archive
    Zip,
    // Structured data
    Json,
    Csv,
    Tsv,
    Yaml,
    Xml,
    Txt,
}

impl OutputFormat {
    /// File extension for the output format (without leading dot).
    pub fn extension(&self) -> &str {
        match self {
            OutputFormat::Png => "png",
            OutputFormat::Jpeg => "jpg",
            OutputFormat::Webp => "webp",
            OutputFormat::Bmp => "bmp",
            OutputFormat::Tiff => "tiff",
            OutputFormat::Gif => "gif",
            OutputFormat::Ico => "ico",
            OutputFormat::Avif => "avif",
            OutputFormat::Pdf => "pdf",
            OutputFormat::Zip => "zip",
            OutputFormat::Json => "json",
            OutputFormat::Csv => "csv",
            OutputFormat::Tsv => "tsv",
            OutputFormat::Yaml => "yaml",
            OutputFormat::Xml => "xml",
            OutputFormat::Txt => "txt",
        }
    }

    /// Human-readable label.
    pub fn label(&self) -> &str {
        match self {
            OutputFormat::Png => "PNG",
            OutputFormat::Jpeg => "JPEG",
            OutputFormat::Webp => "WebP",
            OutputFormat::Bmp => "BMP",
            OutputFormat::Tiff => "TIFF",
            OutputFormat::Gif => "GIF",
            OutputFormat::Ico => "ICO",
            OutputFormat::Avif => "AVIF",
            OutputFormat::Pdf => "PDF",
            OutputFormat::Zip => "ZIP",
            OutputFormat::Json => "JSON",
            OutputFormat::Csv => "CSV",
            OutputFormat::Tsv => "TSV",
            OutputFormat::Yaml => "YAML",
            OutputFormat::Xml => "XML",
            OutputFormat::Txt => "TXT",
        }
    }
}

impl std::fmt::Display for OutputFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.label())
    }
}

/// Information about a detected file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub detected_type: FileType,
    pub size_bytes: u64,
    pub mime_type: String,
}

/// Status of a conversion job.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// User-provided settings for a conversion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionSettings {
    pub image_quality: Option<u8>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    #[serde(default = "default_true")]
    pub preserve_aspect_ratio: bool,
    #[serde(default)]
    pub preserve_metadata: bool,
    pub compression_level: Option<u8>,
    pub pdf_pages: Option<Vec<u32>>,
}

fn default_true() -> bool {
    true
}

impl Default for ConversionSettings {
    fn default() -> Self {
        Self {
            image_quality: None,
            image_width: None,
            image_height: None,
            preserve_aspect_ratio: true,
            preserve_metadata: false,
            compression_level: None,
            pdf_pages: None,
        }
    }
}

/// A conversion job tracked by the job queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionJob {
    pub id: String,
    pub input_files: Vec<String>,
    pub output_format: OutputFormat,
    pub output_directory: String,
    pub status: JobStatus,
    pub progress: f64,
    pub settings: ConversionSettings,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub output_files: Vec<String>,
}

/// Describes a single conversion that the app can perform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionCapability {
    pub input_format: String,
    pub output_format: OutputFormat,
    pub engine_name: String,
    pub description: String,
}

/// A row from the conversion history table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub job_id: String,
    pub input_files: Vec<String>,
    pub output_files: Vec<String>,
    pub output_format: String,
    pub status: String,
    pub created_at: String,
    pub file_sizes: Vec<u64>,
}
