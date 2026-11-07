use image::{ImageBuffer, Rgba};
use morphdrop_lib::engines::image_engine::ImageEngine;
use morphdrop_lib::engines::ConversionEngine;
use morphdrop_lib::models::{ConversionSettings, OutputFormat};
use morphdrop_lib::utils::{generate_output_path, safe_filename};
use std::fs;
use tempfile::tempdir;

#[test]
fn test_unicode_and_spaces_in_paths() {
    let dir = tempdir().unwrap();
    // Test directory and filename containing spaces, Chinese characters, Emoji, and Cyrillic
    let nested_dir = dir.path().join("Folder with spaces and 🌟");
    fs::create_dir_all(&nested_dir).unwrap();

    let unicode_file = nested_dir.join("测试 文件_тест file.png");
    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(40, 40);
    for (_, _, p) in img.enumerate_pixels_mut() {
        *p = Rgba([50, 100, 150, 255]);
    }
    img.save_with_format(&unicode_file, image::ImageFormat::Png).unwrap();
    assert!(unicode_file.exists());

    // Generate output path safely
    let out_path = generate_output_path(&unicode_file, &nested_dir, &OutputFormat::Jpeg);
    assert!(!out_path.exists());

    // Test conversion
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let engine = ImageEngine;
        let res = engine
            .convert(&unicode_file, &out_path, &OutputFormat::Jpeg, &ConversionSettings::default(), None)
            .await;
        assert!(res.is_ok(), "Conversion with Unicode & spaces failed: {:?}", res.err());
        assert!(out_path.exists());
    });
}

#[test]
fn test_collision_avoidance() {
    let dir = tempdir().unwrap();
    let base_file = dir.path().join("document.png");
    fs::write(&base_file, b"sample").unwrap();

    // If document.jpg already exists, it should generate document_1.jpg
    let existing_jpg = dir.path().join("document.jpg");
    fs::write(&existing_jpg, b"existing").unwrap();

    let candidate1 = generate_output_path(&base_file, dir.path(), &OutputFormat::Jpeg);
    assert_eq!(candidate1.file_name().unwrap(), "document_1.jpg");

    // If document_1.jpg also exists, it should generate document_2.jpg
    fs::write(&candidate1, b"existing 1").unwrap();
    let candidate2 = generate_output_path(&base_file, dir.path(), &OutputFormat::Jpeg);
    assert_eq!(candidate2.file_name().unwrap(), "document_2.jpg");
}

#[test]
fn test_filename_sanitization() {
    assert_eq!(safe_filename("regular.png"), "regular.png");
    assert_eq!(safe_filename("invalid/path\\name:col*ast?q\"quote<l>g|p"), "invalid_path_name_col_ast_q_quote_l_g_p");
    assert_eq!(safe_filename("   leading_trailing_spaces   "), "leading_trailing_spaces");
    assert_eq!(safe_filename("..."), "unnamed");
}
