use image::{ImageBuffer, Rgba};
use morphdrop_lib::engines::pdf_engine::PdfEngine;
use std::fs;
use tempfile::tempdir;

fn create_sample_png(path: &std::path::Path, width: u32, height: u32, color: [u8; 3]) {
    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(width, height);
    for (_, _, pixel) in img.enumerate_pixels_mut() {
        *pixel = Rgba([color[0], color[1], color[2], 255]);
    }
    img.save_with_format(path, image::ImageFormat::Png).unwrap();
}

#[test]
fn test_image_to_pdf_creation() {
    let dir = tempdir().unwrap();
    let img_path = dir.path().join("sample.png");
    let pdf_path = dir.path().join("sample.pdf");

    create_sample_png(&img_path, 100, 100, [255, 0, 0]);

    let mut doc = PdfEngine::image_to_pdf(&img_path).expect("Failed to create PDF from image");
    doc.save(&pdf_path).expect("Failed to save PDF");

    assert!(pdf_path.exists());
    assert!(fs::metadata(&pdf_path).unwrap().len() > 0);

    let count = PdfEngine::page_count(&pdf_path).unwrap();
    assert_eq!(count, 1);
}

#[test]
fn test_combine_multiple_images_to_pdf() {
    let dir = tempdir().unwrap();
    let img1 = dir.path().join("page1.png");
    let img2 = dir.path().join("page2.png");
    let img3 = dir.path().join("page3.png");
    let combined_pdf = dir.path().join("combined.pdf");

    create_sample_png(&img1, 100, 100, [255, 0, 0]);
    create_sample_png(&img2, 120, 80, [0, 255, 0]);
    create_sample_png(&img3, 90, 140, [0, 0, 255]);

    let paths = vec![img1.as_path(), img2.as_path(), img3.as_path()];
    let res = PdfEngine::images_to_pdf(&paths, &combined_pdf);
    assert!(res.is_ok());

    assert!(combined_pdf.exists());
    let page_count = PdfEngine::page_count(&combined_pdf).unwrap();
    assert_eq!(page_count, 3, "Combined PDF must contain exactly 3 pages");

    let doc = lopdf::Document::load(&combined_pdf).unwrap();
    for (_num, pid) in doc.get_pages() {
        let contents = doc.get_page_contents(pid);
        assert!(!contents.is_empty(), "Page must have content stream, not be blank");
        let dict = doc.get_dictionary(pid).unwrap();
        assert!(dict.has(b"Resources"), "Page must have resources dictionary");
    }
}

#[test]
fn test_merge_multiple_pdfs() {
    let dir = tempdir().unwrap();
    let doc1_path = dir.path().join("doc1.pdf");
    let doc2_path = dir.path().join("doc2.pdf");
    let merged_path = dir.path().join("merged.pdf");

    let img1 = dir.path().join("i1.png");
    let img2 = dir.path().join("i2.png");
    create_sample_png(&img1, 50, 50, [100, 100, 100]);
    create_sample_png(&img2, 60, 60, [200, 200, 200]);

    PdfEngine::image_to_pdf(&img1).unwrap().save(&doc1_path).unwrap();
    PdfEngine::image_to_pdf(&img2).unwrap().save(&doc2_path).unwrap();

    let res = PdfEngine::merge_pdfs(&[doc1_path.as_path(), doc2_path.as_path()], &merged_path);
    assert!(res.is_ok());

    assert!(merged_path.exists());
    let count = PdfEngine::page_count(&merged_path).unwrap();
    assert_eq!(count, 2, "Merged PDF should have 2 pages");

    // Critical non-blank verification:
    // Ensure all content streams, resources, and media boxes survived the merge
    let merged_doc = lopdf::Document::load(&merged_path).unwrap();
    for (num, pid) in merged_doc.get_pages() {
        let contents = merged_doc.get_page_contents(pid);
        assert!(
            !contents.is_empty(),
            "Merged page {} must have content stream, not be blank!",
            num
        );
        let page_dict = merged_doc.get_dictionary(pid).unwrap();
        assert!(
            page_dict.has(b"MediaBox"),
            "Merged page {} must have MediaBox preserved",
            num
        );
        assert!(
            page_dict.has(b"Resources"),
            "Merged page {} must have Resources preserved",
            num
        );

        // Verify the content stream is non-empty bytes
        let content_id = contents[0];
        let content_obj = merged_doc.get_object(content_id).unwrap();
        if let lopdf::Object::Stream(stream) = content_obj {
            assert!(
                !stream.content.is_empty(),
                "Merged page {} content stream bytes must not be empty",
                num
            );
        } else {
            panic!("Page {} content object must be a Stream", num);
        }
    }
}

#[test]
fn test_split_pdf() {
    let dir = tempdir().unwrap();
    let img1 = dir.path().join("p1.png");
    let img2 = dir.path().join("p2.png");
    create_sample_png(&img1, 50, 50, [10, 10, 10]);
    create_sample_png(&img2, 60, 60, [20, 20, 20]);

    let multi_pdf = dir.path().join("multipage.pdf");
    PdfEngine::images_to_pdf(&[img1.as_path(), img2.as_path()], &multi_pdf).unwrap();

    let split_dir = dir.path().join("split_pages");
    let pages = PdfEngine::split_pdf(&multi_pdf, &split_dir, None).unwrap();
    assert_eq!(pages.len(), 2, "Split should produce 2 individual page files");

    for p in pages {
        assert!(p.exists());
        assert_eq!(PdfEngine::page_count(&p).unwrap(), 1);

        let single_doc = lopdf::Document::load(&p).unwrap();
        let first_pid = *single_doc.get_pages().get(&1).unwrap();
        let contents = single_doc.get_page_contents(first_pid);
        assert!(!contents.is_empty(), "Split page must retain content stream");
    }
}

#[test]
fn test_merge_text_pdf_documents() {
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};

    fn make_text_doc(text: &str) -> Document {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 24.into()]),
                Operation::new("Td", vec![100.into(), 700.into()]),
                Operation::new("Tj", vec![Object::string_literal(text)]),
                Operation::new("ET", vec![]),
            ],
        };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        });
        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc
    }

    let dir = tempdir().unwrap();
    let doc1_path = dir.path().join("text1.pdf");
    let doc2_path = dir.path().join("text2.pdf");
    let merged_path = dir.path().join("text_merged.pdf");

    let mut doc1 = make_text_doc("Document 1: Antigravity PDF Engine");
    let mut doc2 = make_text_doc("Document 2: Second Page Content");
    doc1.save(&doc1_path).unwrap();
    doc2.save(&doc2_path).unwrap();

    let res = PdfEngine::merge_pdfs(&[doc1_path.as_path(), doc2_path.as_path()], &merged_path);
    assert!(res.is_ok());

    let merged_doc = Document::load(&merged_path).unwrap();
    assert_eq!(merged_doc.get_pages().len(), 2);

    for (page_num, pid) in merged_doc.get_pages() {
        let contents = merged_doc.get_page_contents(pid);
        assert!(!contents.is_empty(), "Page {} must not be blank", page_num);
        let text = merged_doc.extract_text(&[page_num]).unwrap();
        assert!(!text.trim().is_empty(), "Page {} extracted text must not be empty", page_num);
    }
}
