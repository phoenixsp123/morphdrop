use crate::engines::ConversionEngine;
use crate::error::MorphDropError;
use crate::models::{ConversionSettings, OutputFormat};
use async_trait::async_trait;
use lopdf::{dictionary, Document, Object, ObjectId, Stream};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct PdfEngine;

impl PdfEngine {
    /// Create a single-page PDF Document from an image file.
    pub fn image_to_pdf(image_path: &Path) -> Result<Document, MorphDropError> {
        let img = image::open(image_path)?;
        let (width, height) = image::GenericImageView::dimensions(&img);
        let rgb = img.to_rgb8();
        let raw_pixels = rgb.as_raw().clone();

        let mut doc = Document::with_version("1.7");

        let mut img_stream = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => width as i64,
                "Height" => height as i64,
                "ColorSpace" => "DeviceRGB",
                "BitsPerComponent" => 8_i64,
            },
            raw_pixels,
        );
        let _ = img_stream.compress();
        let img_id = doc.add_object(img_stream);

        let resources_id = doc.add_object(dictionary! {
            "XObject" => dictionary! {
                "Im1" => img_id,
            },
        });

        let content_str = format!(
            "q {} 0 0 {} 0 0 cm /Im1 Do Q\n",
            width as f64, height as f64,
        );
        let mut content_stream = Stream::new(dictionary! {}, content_str.into_bytes());
        let _ = content_stream.compress();
        let content_id = doc.add_object(content_stream);

        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "MediaBox" => vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Real(width as f32),
                Object::Real(height as f32),
            ],
            "Resources" => resources_id,
            "Contents" => content_id,
        });

        let pages_id = doc.add_object(dictionary! {
            "Type" => "Pages",
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => 1_i64,
        });

        if let Ok(page) = doc.get_object_mut(page_id) {
            if let Object::Dictionary(ref mut dict) = page {
                dict.set("Parent", Object::Reference(pages_id));
            }
        }

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        Ok(doc)
    }

    /// Merge multiple lopdf Documents into a single complete, non-blank multi-page Document.
    /// Preserves all content streams, resources, fonts, images, and inherited properties.
    pub fn merge_documents(documents: Vec<Document>) -> Result<Document, MorphDropError> {
        if documents.is_empty() {
            return Err(MorphDropError::ValidationError("No documents to merge".into()));
        }

        let mut all_objects = BTreeMap::new();
        let mut ordered_page_ids = Vec::new();
        let mut max_id = 1;

        for mut doc in documents {
            // Decrypt view-unlocked PDFs if needed
            if doc.is_encrypted() {
                let _ = doc.decrypt("");
            }

            // In PDF specification, /MediaBox, /CropBox, /Resources, and /Rotate
            // can be defined on ancestor /Pages nodes and inherited by /Page nodes.
            // Before detaching /Page objects, resolve and copy any inherited properties
            // directly onto each page dictionary.
            let page_ids: Vec<ObjectId> = doc.page_iter().collect();
            for &pid in &page_ids {
                let mut inherited_media_box = None;
                let mut inherited_crop_box = None;
                let mut inherited_resources = None;
                let mut inherited_rotate = None;

                let mut curr_parent = doc
                    .get_dictionary(pid)
                    .ok()
                    .and_then(|d| d.get(b"Parent").ok())
                    .and_then(|o| o.as_reference().ok());

                while let Some(parent_id) = curr_parent {
                    if let Ok(pdict) = doc.get_dictionary(parent_id) {
                        if inherited_media_box.is_none() {
                            if let Ok(mb) = pdict.get(b"MediaBox") {
                                inherited_media_box = Some(mb.clone());
                            }
                        }
                        if inherited_crop_box.is_none() {
                            if let Ok(cb) = pdict.get(b"CropBox") {
                                inherited_crop_box = Some(cb.clone());
                            }
                        }
                        if inherited_resources.is_none() {
                            if let Ok(res) = pdict.get(b"Resources") {
                                inherited_resources = Some(res.clone());
                            }
                        }
                        if inherited_rotate.is_none() {
                            if let Ok(rot) = pdict.get(b"Rotate") {
                                inherited_rotate = Some(rot.clone());
                            }
                        }
                        curr_parent = pdict
                            .get(b"Parent")
                            .ok()
                            .and_then(|o| o.as_reference().ok());
                    } else {
                        break;
                    }
                }

                if let Ok(pdict_mut) = doc.get_dictionary_mut(pid) {
                    if !pdict_mut.has(b"MediaBox") {
                        if let Some(mb) = inherited_media_box {
                            pdict_mut.set("MediaBox", mb);
                        } else {
                            pdict_mut.set("MediaBox", vec![0.into(), 0.into(), 612.into(), 792.into()]);
                        }
                    }
                    if !pdict_mut.has(b"CropBox") && inherited_crop_box.is_some() {
                        pdict_mut.set("CropBox", inherited_crop_box.unwrap());
                    }
                    if !pdict_mut.has(b"Resources") && inherited_resources.is_some() {
                        pdict_mut.set("Resources", inherited_resources.unwrap());
                    }
                    if !pdict_mut.has(b"Rotate") && inherited_rotate.is_some() {
                        pdict_mut.set("Rotate", inherited_rotate.unwrap());
                    }
                }
            }

            // Renumber all objects in this document starting at max_id
            doc.renumber_objects_with(max_id);
            max_id = doc.max_id + 1;

            // Collect the renumbered page IDs in exact document order
            let renumbered_page_ids: Vec<ObjectId> = doc.page_iter().collect();
            ordered_page_ids.extend(renumbered_page_ids);

            // Add all objects into all_objects except the old Catalog and Pages tree nodes
            for (oid, obj) in doc.objects {
                match obj.type_name().unwrap_or("") {
                    "Catalog" | "Pages" => {
                        // Skip old document root and pages tree
                    }
                    _ => {
                        all_objects.insert(oid, obj);
                    }
                }
            }
        }

        if ordered_page_ids.is_empty() {
            return Err(MorphDropError::ValidationError(
                "No valid pages found in input PDF files".into(),
            ));
        }

        // Allocate IDs for the unified Pages and Catalog
        let pages_id = (max_id, 0);
        max_id += 1;
        let catalog_id = (max_id, 0);
        max_id += 1;

        // Reparent all Page objects to the unified Pages root
        for &pid in &ordered_page_ids {
            if let Some(obj) = all_objects.get_mut(&pid) {
                if let Ok(dict) = obj.as_dict_mut() {
                    dict.set("Parent", Object::Reference(pages_id));
                }
            }
        }

        // Add unified Pages dictionary
        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Count" => ordered_page_ids.len() as i64,
            "Kids" => ordered_page_ids.iter().map(|&id| Object::Reference(id)).collect::<Vec<_>>(),
        };
        all_objects.insert(pages_id, Object::Dictionary(pages_dict));

        // Add unified Catalog dictionary
        let catalog_dict = dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        };
        all_objects.insert(catalog_id, Object::Dictionary(catalog_dict));

        // Build output document
        let mut merged_doc = Document::with_version("1.7");
        merged_doc.objects = all_objects;
        merged_doc.trailer.set("Root", Object::Reference(catalog_id));
        merged_doc.max_id = max_id;
        merged_doc.renumber_objects();

        Ok(merged_doc)
    }

    /// Combine multiple images into a single multi-page PDF document.
    pub fn images_to_pdf(image_paths: &[&Path], output: &Path) -> Result<PathBuf, MorphDropError> {
        if image_paths.is_empty() {
            return Err(MorphDropError::ValidationError("No images to convert to PDF".into()));
        }

        let mut docs = Vec::new();
        for img_path in image_paths {
            let doc = Self::image_to_pdf(img_path)?;
            docs.push(doc);
        }

        let mut merged = Self::merge_documents(docs)?;
        merged.save(output)?;
        Ok(output.to_path_buf())
    }

    /// Merge multiple PDF documents into one.
    pub fn merge_pdfs(paths: &[&Path], output: &Path) -> Result<PathBuf, MorphDropError> {
        if paths.is_empty() {
            return Err(MorphDropError::ValidationError("No PDFs to merge".into()));
        }

        // Try qpdf if available on the system for lightning-fast command-line merge
        if let Ok(qpdf_path) = which::which("qpdf") {
            let mut cmd = std::process::Command::new(qpdf_path);
            cmd.arg("--empty").arg("--pages");
            for p in paths {
                cmd.arg(p);
            }
            cmd.arg("--").arg(output);
            if let Ok(status) = cmd.status() {
                if status.success()
                    && output.exists()
                    && fs::metadata(output).map(|m| m.len() > 0).unwrap_or(false)
                {
                    return Ok(output.to_path_buf());
                }
            }
        }

        // Native lopdf merge: loads all documents and merges pages and all referenced objects
        let mut documents = Vec::new();
        for path in paths {
            let doc = Document::load(path).map_err(|e| {
                MorphDropError::ConversionError(format!(
                    "Failed to load PDF '{}': {}",
                    path.display(),
                    e
                ))
            })?;
            documents.push(doc);
        }

        let mut merged = Self::merge_documents(documents)?;
        merged.save(output)?;
        Ok(output.to_path_buf())
    }

    /// Split a PDF document into individual pages or selected pages with full object preservation.
    pub fn split_pdf(
        input: &Path,
        output_dir: &Path,
        pages_to_extract: Option<Vec<u32>>,
    ) -> Result<Vec<PathBuf>, MorphDropError> {
        let doc = Document::load(input)?;
        let total_pages = doc.get_pages().len() as u32;
        if total_pages == 0 {
            return Err(MorphDropError::ValidationError(
                "PDF contains no pages to split".into(),
            ));
        }

        fs::create_dir_all(output_dir)?;
        let stem = input
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "document".into());

        let target_pages: Vec<u32> = match pages_to_extract {
            Some(pages) => pages
                .into_iter()
                .filter(|&p| p >= 1 && p <= total_pages)
                .collect(),
            None => (1..=total_pages).collect(),
        };

        let mut created = Vec::new();

        for target_page in target_pages {
            let mut single_page_doc = doc.clone();
            let pages_to_delete: Vec<u32> = (1..=total_pages)
                .filter(|&p| p != target_page)
                .collect();
            single_page_doc.delete_pages(&pages_to_delete);
            single_page_doc.prune_objects();
            single_page_doc.renumber_objects();

            let out_file = output_dir.join(format!("{}_page_{}.pdf", stem, target_page));
            single_page_doc.save(&out_file)?;
            created.push(out_file);
        }

        Ok(created)
    }

    /// Get page count of a PDF.
    pub fn page_count(path: &Path) -> Result<usize, MorphDropError> {
        let doc = Document::load(path)?;
        Ok(doc.get_pages().len())
    }
}

#[async_trait]
impl ConversionEngine for PdfEngine {
    fn name(&self) -> &str {
        "PdfEngine"
    }

    fn supported_input_formats(&self) -> Vec<String> {
        vec![
            "png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif", "ico", "avif", "pdf",
        ]
        .into_iter()
        .map(String::from)
        .collect()
    }

    fn supported_output_formats(&self) -> Vec<OutputFormat> {
        vec![OutputFormat::Pdf]
    }

    fn can_handle(&self, input_format: &str, output_format: &OutputFormat) -> bool {
        let input_lower = input_format.to_lowercase();
        self.supported_input_formats().contains(&input_lower)
            && *output_format == OutputFormat::Pdf
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
            let _ = tx.send(0.1).await;
        }

        let ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let result = if ext == "pdf" {
            // PDF -> PDF: copy
            fs::copy(input, output)?;
            output.to_path_buf()
        } else {
            // Image -> PDF
            let mut doc = Self::image_to_pdf(input)?;

            if let Some(ref tx) = progress_tx {
                let _ = tx.send(0.7).await;
            }

            doc.save(output)?;
            output.to_path_buf()
        };

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
        let ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !self.supported_input_formats().contains(&ext) {
            return Err(MorphDropError::UnsupportedFormat(format!(
                "PdfEngine cannot handle .{} files",
                ext
            )));
        }
        Ok(())
    }
}
