use morphdrop_lib::engines::document_engine::DocumentEngine;
use morphdrop_lib::engines::ConversionEngine;
use morphdrop_lib::models::{ConversionSettings, OutputFormat};
use std::fs;
use tempfile::tempdir;

#[tokio::test]
async fn test_docx_to_pdf_and_vice_versa() {
    let dir = tempdir().unwrap();
    let pdf_path = dir.path().join("sample.pdf");
    let docx_path = dir.path().join("sample.docx");
    let converted_pdf_path = dir.path().join("sample_from_docx.pdf");

    // Minimal valid single-page PDF
    let pdf_content = b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length 55 >> stream\nBT /F1 24 Tf 100 700 Td (Hello from MorphDrop Test!) Tj ET\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000244 00000 n \n0000000350 00000 n \ntrailer << /Root 1 0 R /Size 6 >>\nstartxref\n426\n%%EOF";
    fs::write(&pdf_path, pdf_content).unwrap();

    let engine = DocumentEngine;
    let settings = ConversionSettings::default();

    // 1. PDF -> DOCX
    let out_docx = engine
        .convert(&pdf_path, &docx_path, &OutputFormat::Docx, &settings, None)
        .await
        .expect("PDF to DOCX conversion should succeed");
    assert!(out_docx.exists());
    assert!(fs::metadata(&out_docx).unwrap().len() > 0);

    // 2. DOCX -> PDF
    let out_pdf = engine
        .convert(&out_docx, &converted_pdf_path, &OutputFormat::Pdf, &settings, None)
        .await
        .expect("DOCX to PDF conversion should succeed");
    assert!(out_pdf.exists());
    assert!(fs::metadata(&out_pdf).unwrap().len() > 0);
}
