pub mod capability_registry;
pub mod commands;
pub mod db;
pub mod dependency_manager;
pub mod engines;
pub mod error;
pub mod file_detector;
pub mod job_queue;
pub mod models;
pub mod operation_journal;
pub mod utils;

use db::Database;
use engines::EngineManager;
use job_queue::JobQueue;
use operation_journal::OperationJournal;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub fn run() {
    env_logger::init();
    dependency_manager::DependencyManager::augment_process_path();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = commands::toggle_smartdrop_window(app.clone());
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // Resolve the app data directory for the database
            let app_data = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_data).ok();

            let db_path = app_data.join("morphdrop.db");
            let db = Arc::new(
                Database::new(&db_path).expect("Failed to initialize database"),
            );

            let engine_manager = Arc::new(EngineManager::new());

            // Default concurrency: 2
            let job_queue = Arc::new(JobQueue::new(
                Arc::clone(&engine_manager),
                Arc::clone(&db),
                2,
            ));

            let journal = Arc::new(OperationJournal::new());

            // Register global shortcut: from DB or platform default
            let shortcut_str = db
                .get_setting("smartdrop_shortcut")
                .ok()
                .flatten()
                .unwrap_or_else(|| {
                    if cfg!(target_os = "macos") {
                        "Command+Shift+Space".to_string()
                    } else {
                        "Control+Shift+Space".to_string()
                    }
                });

            if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                let _ = app.global_shortcut().register(shortcut);
            }

            app.manage(db);
            app.manage(engine_manager);
            app.manage(job_queue);
            app.manage(journal);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::detect_files,
            commands::get_compatible_formats,
            commands::get_all_capabilities,
            commands::start_conversion,
            commands::get_job_status,
            commands::cancel_job,
            commands::get_conversion_history,
            commands::clear_history,
            commands::get_settings,
            commands::set_setting,
            commands::open_file,
            commands::open_in_folder,
            commands::merge_pdfs,
            commands::images_to_pdf,
            commands::split_pdf,
            commands::get_pdf_page_count,
            commands::create_archive,
            commands::extract_archive,
            commands::list_archive,
            commands::preview_batch_rename,
            commands::execute_batch_rename,
            commands::undo_last_rename,
            commands::probe_external_dependencies,
            commands::convert_media_external,
            commands::convert_office_external,
            commands::toggle_smartdrop_window,
            commands::hide_smartdrop_window,
            commands::get_smartdrop_shortcut,
            commands::set_smartdrop_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("Error running MorphDrop");
}
