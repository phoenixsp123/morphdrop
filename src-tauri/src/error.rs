use serde::Serialize;

/// Central error type for MorphDrop.
#[derive(Debug, thiserror::Error)]
pub enum MorphDropError {
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Image processing error: {0}")]
    ImageError(String),

    #[error("PDF error: {0}")]
    PdfError(String),

    #[error("Archive error: {0}")]
    ArchiveError(String),

    #[error("Conversion error: {0}")]
    ConversionError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("Operation cancelled")]
    CancelledError,

    #[error("Insufficient disk space: need {needed} bytes, have {available} bytes")]
    DiskSpaceError { needed: u64, available: u64 },
}

impl From<image::ImageError> for MorphDropError {
    fn from(e: image::ImageError) -> Self {
        MorphDropError::ImageError(e.to_string())
    }
}

impl From<lopdf::Error> for MorphDropError {
    fn from(e: lopdf::Error) -> Self {
        MorphDropError::PdfError(e.to_string())
    }
}

impl From<zip::result::ZipError> for MorphDropError {
    fn from(e: zip::result::ZipError) -> Self {
        MorphDropError::ArchiveError(e.to_string())
    }
}

impl From<rusqlite::Error> for MorphDropError {
    fn from(e: rusqlite::Error) -> Self {
        MorphDropError::DatabaseError(e.to_string())
    }
}

impl From<csv::Error> for MorphDropError {
    fn from(e: csv::Error) -> Self {
        MorphDropError::ConversionError(format!("CSV error: {e}"))
    }
}

impl From<serde_json::Error> for MorphDropError {
    fn from(e: serde_json::Error) -> Self {
        MorphDropError::ConversionError(format!("JSON error: {e}"))
    }
}

impl From<serde_yaml::Error> for MorphDropError {
    fn from(e: serde_yaml::Error) -> Self {
        MorphDropError::ConversionError(format!("YAML error: {e}"))
    }
}

impl From<quick_xml::DeError> for MorphDropError {
    fn from(e: quick_xml::DeError) -> Self {
        MorphDropError::ConversionError(format!("XML error: {e}"))
    }
}

/// Make MorphDropError serializable for Tauri command returns.
impl Serialize for MorphDropError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
