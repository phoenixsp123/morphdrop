use crate::engines::ConversionEngine;
use crate::error::MorphDropError;
use crate::models::{ConversionSettings, OutputFormat};
use async_trait::async_trait;
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, GenericImageView, ImageFormat};
use std::fs;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

pub struct ImageEngine;

impl ImageEngine {
    /// Map OutputFormat to `image::ImageFormat`.
    fn to_image_format(fmt: &OutputFormat) -> Option<ImageFormat> {
        match fmt {
            OutputFormat::Png => Some(ImageFormat::Png),
            OutputFormat::Jpeg => Some(ImageFormat::Jpeg),
            OutputFormat::Webp => Some(ImageFormat::WebP),
            OutputFormat::Bmp => Some(ImageFormat::Bmp),
            OutputFormat::Tiff => Some(ImageFormat::Tiff),
            OutputFormat::Gif => Some(ImageFormat::Gif),
            OutputFormat::Ico => Some(ImageFormat::Ico),
            OutputFormat::Avif => Some(ImageFormat::Avif),
            _ => None,
        }
    }

    /// Whether the target format supports alpha transparency.
    fn supports_alpha(fmt: &OutputFormat) -> bool {
        matches!(
            fmt,
            OutputFormat::Png | OutputFormat::Webp | OutputFormat::Gif | OutputFormat::Ico | OutputFormat::Avif | OutputFormat::Tiff
        )
    }

    /// Optionally resize the image according to settings.
    fn maybe_resize(img: DynamicImage, settings: &ConversionSettings) -> DynamicImage {
        let (orig_w, orig_h) = img.dimensions();

        match (settings.image_width, settings.image_height) {
            (None, None) => img,
            (Some(w), Some(h)) if settings.preserve_aspect_ratio => {
                img.resize(w, h, image::imageops::FilterType::Lanczos3)
            }
            (Some(w), Some(h)) => img.resize_exact(w, h, image::imageops::FilterType::Lanczos3),
            (Some(w), None) => {
                let h = if settings.preserve_aspect_ratio {
                    (orig_h as f64 * w as f64 / orig_w as f64).round() as u32
                } else {
                    orig_h
                };
                img.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
            }
            (None, Some(h)) => {
                let w = if settings.preserve_aspect_ratio {
                    (orig_w as f64 * h as f64 / orig_h as f64).round() as u32
                } else {
                    orig_w
                };
                img.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
            }
        }
    }
}

#[async_trait]
impl ConversionEngine for ImageEngine {
    fn name(&self) -> &str {
        "ImageEngine"
    }

    fn supported_input_formats(&self) -> Vec<String> {
        vec![
            "png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif", "ico", "avif",
        ]
        .into_iter()
        .map(String::from)
        .collect()
    }

    fn supported_output_formats(&self) -> Vec<OutputFormat> {
        vec![
            OutputFormat::Png,
            OutputFormat::Jpeg,
            OutputFormat::Webp,
            OutputFormat::Bmp,
            OutputFormat::Tiff,
            OutputFormat::Gif,
            OutputFormat::Ico,
            OutputFormat::Avif,
        ]
    }

    fn can_handle(&self, input_format: &str, output_format: &OutputFormat) -> bool {
        let input_lower = input_format.to_lowercase();
        self.supported_input_formats().contains(&input_lower)
            && self.supported_output_formats().contains(output_format)
    }

    async fn convert(
        &self,
        input: &Path,
        output: &Path,
        format: &OutputFormat,
        settings: &ConversionSettings,
        progress_tx: Option<tokio::sync::mpsc::Sender<f64>>,
    ) -> Result<PathBuf, MorphDropError> {
        // Send initial progress
        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.1).await;
        }

        // Read & decode
        let img = image::open(input)?;

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.3).await;
        }

        // Resize if requested
        let img = Self::maybe_resize(img, settings);

        // Convert RGBA → RGB for formats that don't support alpha
        let img = if !Self::supports_alpha(format) && img.color().has_alpha() {
            DynamicImage::ImageRgb8(img.to_rgb8())
        } else {
            img
        };

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.5).await;
        }

        // Write to a temp file in the same directory, then atomically move
        let output_dir = output.parent().unwrap_or(Path::new("."));
        let tmp = tempfile::NamedTempFile::new_in(output_dir)?;
        let tmp_path = tmp.path().to_path_buf();

        match format {
            OutputFormat::Jpeg => {
                let quality = settings.image_quality.unwrap_or(90);
                let file = fs::File::create(&tmp_path)?;
                let buf = BufWriter::new(file);
                let encoder = JpegEncoder::new_with_quality(buf, quality);
                img.write_with_encoder(encoder)?;
            }
            OutputFormat::Ico => {
                // ICO: resize to max 256×256 if needed
                let ico_img = if img.width() > 256 || img.height() > 256 {
                    img.resize(256, 256, image::imageops::FilterType::Lanczos3)
                } else {
                    img.clone()
                };
                ico_img.save_with_format(&tmp_path, ImageFormat::Ico)?;
            }
            _ => {
                let image_format = Self::to_image_format(format).ok_or_else(|| {
                    MorphDropError::UnsupportedFormat(format!("Unsupported image format: {}", format))
                })?;
                img.save_with_format(&tmp_path, image_format)?;
            }
        }

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.9).await;
        }

        // Persist the temp file (prevent auto-delete) and move to final output
        tmp.persist(output).map_err(|e| {
            MorphDropError::IoError(e.error)
        })?;

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(1.0).await;
        }

        Ok(output.to_path_buf())
    }

    async fn validate_input(&self, input: &Path) -> Result<(), MorphDropError> {
        if !input.exists() {
            return Err(MorphDropError::ValidationError(format!(
                "Input file does not exist: {}",
                input.display()
            )));
        }
        let ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !self.supported_input_formats().contains(&ext) {
            return Err(MorphDropError::UnsupportedFormat(format!(
                "Unsupported image format: .{}",
                ext
            )));
        }
        // Quick size sanity check (< 500 MB)
        let meta = fs::metadata(input)?;
        if meta.len() > 500 * 1024 * 1024 {
            return Err(MorphDropError::ValidationError(
                "Image file exceeds 500 MB limit".into(),
            ));
        }
        Ok(())
    }
}
