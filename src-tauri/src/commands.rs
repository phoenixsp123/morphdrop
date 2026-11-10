use crate::capability_registry;
use crate::db::Database;
use crate::dependency_manager::{DependencyManager, DependencyStatus};
use crate::engines::archive_engine::ArchiveEngine;
use crate::engines::pdf_engine::PdfEngine;
use crate::file_detector;
use crate::job_queue::JobQueue;
use crate::models::*;
use crate::operation_journal::{OperationJournal, RenamePreview, RenameRule};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;

// ---- File Detection ----

#[tauri::command]
pub fn detect_files(paths: Vec<String>) -> Result<Vec<FileInfo>, String> {
    let pathbufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    file_detector::detect_files(&pathbufs).map_err(|e| e.to_string())
}

// ---- Format Capabilities ----

#[tauri::command]
pub fn get_compatible_formats(file_infos: Vec<FileInfo>) -> Result<Vec<OutputFormat>, String> {
    Ok(capability_registry::get_compatible_formats(&file_infos))
}

#[tauri::command]
pub fn get_all_capabilities() -> Result<Vec<ConversionCapability>, String> {
    Ok(capability_registry::get_capabilities())
}

// ---- Conversion ----

#[tauri::command]
pub async fn start_conversion(
    input_files: Vec<String>,
    output_format: OutputFormat,
    output_dir: String,
    settings: ConversionSettings,
    job_queue: tauri::State<'_, Arc<JobQueue>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    if input_files.is_empty() {
        return Err("No input files provided".into());
    }

    let out_path = PathBuf::from(&output_dir);
    if !out_path.exists() {
        std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
    }

    let job_id = job_queue.submit(input_files, output_format, output_dir, settings);

    let queue = Arc::clone(&job_queue);
    let jid = job_id.clone();
    tokio::spawn(async move {
        if let Err(e) = queue.execute(&jid, app_handle).await {
            log::error!("Conversion job {} failed: {}", jid, e);
        }
    });

    Ok(job_id)
}

#[tauri::command]
pub fn get_job_status(
    job_id: String,
    job_queue: tauri::State<'_, Arc<JobQueue>>,
) -> Result<ConversionJob, String> {
    job_queue
        .get_job(&job_id)
        .ok_or_else(|| format!("Job not found: {}", job_id))
}

#[tauri::command]
pub fn cancel_job(
    job_id: String,
    job_queue: tauri::State<'_, Arc<JobQueue>>,
) -> Result<(), String> {
    job_queue.cancel(&job_id).map_err(|e| e.to_string())
}

// ---- History ----

#[tauri::command]
pub fn get_conversion_history(
    db: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<HistoryEntry>, String> {
    db.get_history(100).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(db: tauri::State<'_, Arc<Database>>) -> Result<(), String> {
    db.clear_history().map_err(|e| e.to_string())
}

// ---- Settings ----

#[tauri::command]
pub fn get_settings(db: tauri::State<'_, Arc<Database>>) -> Result<serde_json::Value, String> {
    db.get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<(), String> {
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}

// ---- File Operations ----

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    opener::open(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_in_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        opener::open(parent).map_err(|e| e.to_string())
    } else {
        Err("Cannot determine parent folder".into())
    }
}

// ---- PDF Operations ----

#[tauri::command]
pub fn merge_pdfs(paths: Vec<String>, output_path: String) -> Result<String, String> {
    let path_refs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let path_slices: Vec<&Path> = path_refs.iter().map(|p| p.as_path()).collect();
    let output = PathBuf::from(&output_path);
    PdfEngine::merge_pdfs(&path_slices, &output)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn images_to_pdf(image_paths: Vec<String>, output_path: String) -> Result<String, String> {
    let path_refs: Vec<PathBuf> = image_paths.iter().map(PathBuf::from).collect();
    let path_slices: Vec<&Path> = path_refs.iter().map(|p| p.as_path()).collect();
    let output = PathBuf::from(&output_path);
    PdfEngine::images_to_pdf(&path_slices, &output)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn split_pdf(
    input_path: String,
    output_dir: String,
    pages: Option<Vec<u32>>,
) -> Result<Vec<String>, String> {
    let input = PathBuf::from(&input_path);
    let out_dir = PathBuf::from(&output_dir);
    PdfEngine::split_pdf(&input, &out_dir, pages)
        .map(|paths| paths.iter().map(|p| p.to_string_lossy().to_string()).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_pdf_page_count(path: String) -> Result<usize, String> {
    PdfEngine::page_count(Path::new(&path)).map_err(|e| e.to_string())
}

// ---- Archive Operations ----

#[tauri::command]
pub fn create_archive(input_paths: Vec<String>, output_path: String) -> Result<String, String> {
    let path_refs: Vec<PathBuf> = input_paths.iter().map(PathBuf::from).collect();
    let path_slices: Vec<&Path> = path_refs.iter().map(|p| p.as_path()).collect();
    let output = PathBuf::from(&output_path);
    ArchiveEngine::create_zip(&path_slices, &output)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn extract_archive(
    archive_path: String,
    output_dir: String,
) -> Result<Vec<String>, String> {
    let archive = PathBuf::from(&archive_path);
    let out_dir = PathBuf::from(&output_dir);
    ArchiveEngine::extract_zip(&archive, &out_dir)
        .map(|paths| paths.iter().map(|p| p.to_string_lossy().to_string()).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_archive(archive_path: String) -> Result<Vec<String>, String> {
    ArchiveEngine::list_zip(Path::new(&archive_path)).map_err(|e| e.to_string())
}

// ---- Batch Renaming & Operation Journal ----

#[tauri::command]
pub fn preview_batch_rename(paths: Vec<String>, rule: RenameRule) -> Vec<RenamePreview> {
    OperationJournal::preview_rename(&paths, &rule)
}

#[tauri::command]
pub fn execute_batch_rename(
    previews: Vec<RenamePreview>,
    journal: tauri::State<'_, Arc<OperationJournal>>,
) -> Result<Vec<String>, String> {
    journal.execute_rename(&previews).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn undo_last_rename(
    journal: tauri::State<'_, Arc<OperationJournal>>,
) -> Result<Vec<String>, String> {
    journal.undo_last().map_err(|e| e.to_string())
}

// ---- External Dependency Management ----

#[tauri::command]
pub fn probe_external_dependencies() -> Vec<DependencyStatus> {
    DependencyManager::probe_all()
}

#[tauri::command]
pub fn convert_media_external(
    input_path: String,
    output_path: String,
    extra_args: Vec<String>,
) -> Result<String, String> {
    let input = PathBuf::from(&input_path);
    let output = PathBuf::from(&output_path);
    DependencyManager::convert_media_with_ffmpeg(&input, &output, &extra_args)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn convert_office_external(
    input_path: String,
    output_dir: String,
    target_format: Option<String>,
) -> Result<String, String> {
    let input = PathBuf::from(&input_path);
    let out_dir = PathBuf::from(&output_dir);
    let target = target_format.unwrap_or_else(|| "pdf".to_string());
    DependencyManager::convert_document_with_libreoffice(&input, &out_dir, &target)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ---- SmartDrop Window Management ----

#[tauri::command]
pub fn toggle_smartdrop_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("smartdrop") {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn hide_smartdrop_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("smartdrop") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_smartdrop_shortcut(db: tauri::State<'_, Arc<Database>>) -> Result<String, String> {
    match db.get_setting("smartdrop_shortcut") {
        Ok(Some(sc)) => Ok(sc),
        _ => {
            let default_sc = if cfg!(target_os = "macos") {
                "Command+Shift+Space".to_string()
            } else {
                "Control+Shift+Space".to_string()
            };
            Ok(default_sc)
        }
    }
}

#[tauri::command]
pub fn set_smartdrop_shortcut(
    app_handle: tauri::AppHandle,
    db: tauri::State<'_, Arc<Database>>,
    shortcut: String,
) -> Result<String, String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let trimmed = shortcut.trim();
    if trimmed.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    let parsed: Shortcut = trimmed
        .parse()
        .map_err(|e| format!("Invalid shortcut format: {e}"))?;

    // Unregister existing shortcuts
    let _ = app_handle.global_shortcut().unregister_all();

    // Register new shortcut
    app_handle
        .global_shortcut()
        .register(parsed)
        .map_err(|e| format!("Failed to register shortcut '{trimmed}': {e}"))?;

    // Save to DB
    db.set_setting("smartdrop_shortcut", trimmed)
        .map_err(|e| e.to_string())?;

    Ok(trimmed.to_string())
}
