use crate::models::{ConversionCapability, FileInfo, FileType, OutputFormat};

/// Return all conversion capabilities the application supports.
pub fn get_capabilities() -> Vec<ConversionCapability> {
    let mut caps = Vec::new();

    // ----- Image ↔ Image -----
    let image_formats = [
        ("png", OutputFormat::Png),
        ("jpg", OutputFormat::Jpeg),
        ("jpeg", OutputFormat::Jpeg),
        ("webp", OutputFormat::Webp),
        ("bmp", OutputFormat::Bmp),
        ("tiff", OutputFormat::Tiff),
        ("tif", OutputFormat::Tiff),
        ("gif", OutputFormat::Gif),
        ("ico", OutputFormat::Ico),
        ("avif", OutputFormat::Avif),
    ];

    for (in_ext, _) in &image_formats {
        for (_, out_fmt) in &image_formats {
            // Skip identity conversions with the same canonical extension
            let in_canonical = canonical_image_ext(in_ext);
            if in_canonical == out_fmt.extension() {
                continue;
            }
            caps.push(ConversionCapability {
                input_format: in_ext.to_string(),
                output_format: out_fmt.clone(),
                engine_name: "ImageEngine".into(),
                description: format!("{} → {}", in_ext.to_uppercase(), out_fmt.label()),
            });
        }
    }

    // ----- Image → PDF -----
    for (in_ext, _) in &image_formats {
        caps.push(ConversionCapability {
            input_format: in_ext.to_string(),
            output_format: OutputFormat::Pdf,
            engine_name: "PdfEngine".into(),
            description: format!("{} → PDF", in_ext.to_uppercase()),
        });
    }

    // ----- PDF → Image -----
    // (limited: first-page raster is common but we only support what lopdf can do;
    //  we expose PDF → PNG via embedded image extraction)
    // For now, we support merge/split/images-to-pdf but not PDF rasterization.
    // PDF → PDF (merge / split) is handled internally, not as a format conversion.

    // ----- Document Conversions (DOCX ↔ PDF) -----
    for in_ext in &["docx", "doc", "odt", "rtf"] {
        caps.push(ConversionCapability {
            input_format: in_ext.to_string(),
            output_format: OutputFormat::Pdf,
            engine_name: "DocumentEngine".into(),
            description: format!("{} → PDF", in_ext.to_uppercase()),
        });
    }

    caps.push(ConversionCapability {
        input_format: "pdf".into(),
        output_format: OutputFormat::Docx,
        engine_name: "DocumentEngine".into(),
        description: "PDF → DOCX".into(),
    });

    for in_ext in &["doc", "odt", "rtf"] {
        caps.push(ConversionCapability {
            input_format: in_ext.to_string(),
            output_format: OutputFormat::Docx,
            engine_name: "DocumentEngine".into(),
            description: format!("{} → DOCX", in_ext.to_uppercase()),
        });
    }

    // ----- Archive operations -----
    // Any file(s) → ZIP
    for ft_ext in &[
        "png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff", "tif", "ico", "avif", "pdf", "docx",
        "doc", "odt", "rtf", "json", "csv", "tsv", "yaml", "yml", "xml", "txt", "zip",
    ] {
        caps.push(ConversionCapability {
            input_format: ft_ext.to_string(),
            output_format: OutputFormat::Zip,
            engine_name: "ArchiveEngine".into(),
            description: format!("{} → ZIP (archive)", ft_ext.to_uppercase()),
        });
    }

    // ----- Structured Data conversions -----
    let sd_conversions: &[(&str, OutputFormat, &str)] = &[
        ("json", OutputFormat::Csv, "JSON → CSV"),
        ("json", OutputFormat::Yaml, "JSON → YAML"),
        ("json", OutputFormat::Xml, "JSON → XML"),
        ("json", OutputFormat::Tsv, "JSON → TSV"),
        ("json", OutputFormat::Txt, "JSON → TXT"),
        ("csv", OutputFormat::Json, "CSV → JSON"),
        ("csv", OutputFormat::Tsv, "CSV → TSV"),
        ("csv", OutputFormat::Yaml, "CSV → YAML"),
        ("csv", OutputFormat::Xml, "CSV → XML"),
        ("csv", OutputFormat::Txt, "CSV → TXT"),
        ("tsv", OutputFormat::Json, "TSV → JSON"),
        ("tsv", OutputFormat::Csv, "TSV → CSV"),
        ("tsv", OutputFormat::Yaml, "TSV → YAML"),
        ("tsv", OutputFormat::Txt, "TSV → TXT"),
        ("yaml", OutputFormat::Json, "YAML → JSON"),
        ("yaml", OutputFormat::Csv, "YAML → CSV"),
        ("yaml", OutputFormat::Xml, "YAML → XML"),
        ("yaml", OutputFormat::Txt, "YAML → TXT"),
        ("yml", OutputFormat::Json, "YAML → JSON"),
        ("yml", OutputFormat::Csv, "YAML → CSV"),
        ("yml", OutputFormat::Xml, "YAML → XML"),
        ("yml", OutputFormat::Txt, "YAML → TXT"),
        ("xml", OutputFormat::Json, "XML → JSON"),
        ("xml", OutputFormat::Yaml, "XML → YAML"),
        ("xml", OutputFormat::Csv, "XML → CSV"),
        ("xml", OutputFormat::Txt, "XML → TXT"),
    ];

    for (in_fmt, out_fmt, desc) in sd_conversions {
        caps.push(ConversionCapability {
            input_format: in_fmt.to_string(),
            output_format: out_fmt.clone(),
            engine_name: "StructuredDataEngine".into(),
            description: desc.to_string(),
        });
    }

    caps
}

/// Get all output formats available for a given file type category.
pub fn get_output_formats(input_type: &FileType) -> Vec<OutputFormat> {
    let caps = get_capabilities();
    let type_extensions = extensions_for_type(input_type);
    let mut formats: Vec<OutputFormat> = caps
        .iter()
        .filter(|c| type_extensions.contains(&c.input_format.as_str()))
        .map(|c| c.output_format.clone())
        .collect();
    formats.sort_by(|a, b| a.extension().cmp(b.extension()));
    formats.dedup();
    formats
}

/// Check if a specific input extension can be converted to a given output format.
pub fn can_convert(input_format: &str, output_format: &OutputFormat) -> bool {
    let input_lower = input_format.to_lowercase();
    get_capabilities()
        .iter()
        .any(|c| c.input_format == input_lower && c.output_format == *output_format)
}

/// Given a set of detected files, return the output formats ALL of them can be converted to.
pub fn get_compatible_formats(file_infos: &[FileInfo]) -> Vec<OutputFormat> {
    if file_infos.is_empty() {
        return Vec::new();
    }

    // For each file, find the set of output formats it supports
    let caps = get_capabilities();
    let per_file: Vec<Vec<OutputFormat>> = file_infos
        .iter()
        .map(|fi| {
            let ext = fi.extension.to_lowercase();
            let mut fmts: Vec<OutputFormat> = caps
                .iter()
                .filter(|c| c.input_format == ext)
                .map(|c| c.output_format.clone())
                .collect();
            fmts.sort_by(|a, b| a.extension().cmp(b.extension()));
            fmts.dedup();
            fmts
        })
        .collect();

    // Intersect all sets
    let mut result = per_file[0].clone();
    for fmts in &per_file[1..] {
        result.retain(|f| fmts.contains(f));
    }

    // ZIP is always available when there are multiple files
    if file_infos.len() > 1 && !result.contains(&OutputFormat::Zip) {
        result.push(OutputFormat::Zip);
    }

    result
}

/// Canonical extension (e.g. jpeg → jpg, tif → tiff).
fn canonical_image_ext(ext: &str) -> &str {
    match ext {
        "jpeg" => "jpg",
        "tif" => "tiff",
        _ => ext,
    }
}

/// Return common file extensions belonging to a file type category.
fn extensions_for_type(ft: &FileType) -> Vec<&'static str> {
    match ft {
        FileType::Image => vec![
            "png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif", "ico", "avif",
        ],
        FileType::Document => vec!["pdf", "docx", "doc", "odt", "rtf"],
        FileType::Archive => vec!["zip"],
        FileType::StructuredData => vec!["json", "csv", "tsv", "yaml", "yml", "xml"],
        _ => vec![],
    }
}
