use image::{ImageBuffer, Rgba};
use morphdrop_lib::engines::image_engine::ImageEngine;
use morphdrop_lib::engines::ConversionEngine;
use morphdrop_lib::models::{ConversionSettings, OutputFormat};
use std::fs;
use tempfile::tempdir;

fn create_sample_png(path: &std::path::Path, width: u32, height: u32) {
    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(width, height);
    for (x, y, pixel) in img.enumerate_pixels_mut() {
        let r = ((x * 255) / width) as u8;
        let g = ((y * 255) / height) as u8;
        let b = 180;
        *pixel = Rgba([r, g, b, 255]);
    }
    img.save_with_format(path, image::ImageFormat::Png)
        .expect("Failed to create sample PNG");
}

#[tokio::test]
async fn test_png_to_jpeg_conversion() {
    let dir = tempdir().unwrap();
    let in_path = dir.path().join("input.png");
    let out_path = dir.path().join("output.jpg");

    create_sample_png(&in_path, 200, 150);

    let engine = ImageEngine;
    let mut settings = ConversionSettings::default();
    settings.image_quality = Some(85);

    let res = engine
        .convert(&in_path, &out_path, &OutputFormat::Jpeg, &settings, None)
        .await;
    assert!(res.is_ok(), "Conversion failed: {:?}", res.err());

    let actual_out = res.unwrap();
    assert!(actual_out.exists(), "Output file does not exist");
    let metadata = fs::metadata(&actual_out).unwrap();
    assert!(metadata.len() > 0, "Output file is empty");

    // Verify it is a valid readable JPEG
    let decoded = image::open(&actual_out).expect("Failed to decode generated JPEG");
    assert_eq!(decoded.width(), 200);
    assert_eq!(decoded.height(), 150);
}

#[tokio::test]
async fn test_png_to_webp_conversion() {
    let dir = tempdir().unwrap();
    let in_path = dir.path().join("sample.png");
    let out_path = dir.path().join("sample.webp");

    create_sample_png(&in_path, 160, 120);

    let engine = ImageEngine;
    let settings = ConversionSettings::default();

    let res = engine
        .convert(&in_path, &out_path, &OutputFormat::Webp, &settings, None)
        .await;
    assert!(res.is_ok(), "Webp conversion failed: {:?}", res.err());

    let actual_out = res.unwrap();
    assert!(actual_out.exists());

    let decoded = image::open(&actual_out).expect("Failed to decode generated WebP");
    assert_eq!(decoded.width(), 160);
    assert_eq!(decoded.height(), 120);
}

#[tokio::test]
async fn test_png_to_bmp_conversion() {
    let dir = tempdir().unwrap();
    let in_path = dir.path().join("source.png");
    let out_path = dir.path().join("target.bmp");

    create_sample_png(&in_path, 80, 80);

    let engine = ImageEngine;
    let settings = ConversionSettings::default();

    let res = engine
        .convert(&in_path, &out_path, &OutputFormat::Bmp, &settings, None)
        .await;
    assert!(res.is_ok());

    let actual_out = res.unwrap();
    let decoded = image::open(&actual_out).expect("Failed to decode BMP");
    assert_eq!(decoded.width(), 80);
    assert_eq!(decoded.height(), 80);
}

#[tokio::test]
async fn test_image_resize_with_aspect_ratio() {
    let dir = tempdir().unwrap();
    let in_path = dir.path().join("orig.png");
    let out_path = dir.path().join("resized.png");

    create_sample_png(&in_path, 400, 200); // 2:1 ratio

    let engine = ImageEngine;
    let mut settings = ConversionSettings::default();
    settings.image_width = Some(200);
    settings.preserve_aspect_ratio = true;

    let res = engine
        .convert(&in_path, &out_path, &OutputFormat::Png, &settings, None)
        .await;
    assert!(res.is_ok());

    let actual_out = res.unwrap();
    let decoded = image::open(&actual_out).expect("Failed to decode resized PNG");
    assert_eq!(decoded.width(), 200);
    assert_eq!(decoded.height(), 100); // preserved 2:1 ratio
}

#[tokio::test]
async fn test_batch_image_conversions() {
    let dir = tempdir().unwrap();
    let engine = ImageEngine;
    let settings = ConversionSettings::default();

    let mut generated_paths = Vec::new();
    for i in 0..5 {
        let in_path = dir.path().join(format!("batch_{}.png", i));
        let out_path = dir.path().join(format!("batch_{}.jpg", i));
        create_sample_png(&in_path, 100 + i * 10, 100);

        let res = engine
            .convert(&in_path, &out_path, &OutputFormat::Jpeg, &settings, None)
            .await;
        assert!(res.is_ok());
        generated_paths.push(res.unwrap());
    }

    assert_eq!(generated_paths.len(), 5);
    for p in &generated_paths {
        assert!(p.exists());
        let decoded = image::open(p).expect("Failed to decode batch item");
        assert!(decoded.width() >= 100);
    }
}

#[tokio::test]
async fn test_invalid_input_error_handling() {
    let dir = tempdir().unwrap();
    let non_existent = dir.path().join("does_not_exist.png");
    let out_path = dir.path().join("output.jpg");

    let engine = ImageEngine;
    let settings = ConversionSettings::default();

    let val_res = engine.validate_input(&non_existent).await;
    assert!(val_res.is_err(), "Non-existent file should fail validation");

    let conv_res = engine
        .convert(&non_existent, &out_path, &OutputFormat::Jpeg, &settings, None)
        .await;
    assert!(conv_res.is_err(), "Non-existent file conversion should fail");
}
