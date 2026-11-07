use crate::db::Database;
use crate::engines::EngineManager;
use crate::error::MorphDropError;
use crate::models::{ConversionJob, ConversionSettings, HistoryEntry, JobStatus, OutputFormat};
use crate::utils;
use chrono::Utc;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tauri::Emitter;
use uuid::Uuid;

/// Manages a queue of conversion jobs with configurable concurrency.
pub struct JobQueue {
    jobs: Arc<Mutex<HashMap<String, ConversionJob>>>,
    engine_manager: Arc<EngineManager>,
    db: Arc<Database>,
    _max_concurrent: usize,
}

impl JobQueue {
    pub fn new(engine_manager: Arc<EngineManager>, db: Arc<Database>, max_concurrent: usize) -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            engine_manager,
            db,
            _max_concurrent: max_concurrent.max(1),
        }
    }

    /// Submit a new conversion job. Returns the job ID.
    pub fn submit(
        &self,
        input_files: Vec<String>,
        output_format: OutputFormat,
        output_directory: String,
        settings: ConversionSettings,
    ) -> String {
        let id = Uuid::new_v4().to_string();
        let job = ConversionJob {
            id: id.clone(),
            input_files,
            output_format,
            output_directory,
            status: JobStatus::Pending,
            progress: 0.0,
            settings,
            created_at: Utc::now(),
            completed_at: None,
            error_message: None,
            output_files: Vec::new(),
        };

        {
            let mut jobs = self.jobs.lock().unwrap();
            jobs.insert(id.clone(), job);
        }

        id
    }

    /// Run the conversion for a given job ID.
    pub async fn execute(
        &self,
        job_id: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), MorphDropError> {
        let job = {
            let jobs = self.jobs.lock().unwrap();
            jobs.get(job_id).cloned()
        };

        let job = match job {
            Some(j) => j,
            None => {
                return Err(MorphDropError::ConversionError(format!(
                    "Job not found: {}",
                    job_id
                )))
            }
        };

        // Set status to Running
        self.update_status(job_id, JobStatus::Running, None);

        let total_files = job.input_files.len();
        let mut output_files = Vec::new();
        let output_dir = PathBuf::from(&job.output_directory);

        // Ensure output directory exists
        if !output_dir.exists() {
            std::fs::create_dir_all(&output_dir)?;
        }

        for (i, input_path) in job.input_files.iter().enumerate() {
            // Check if cancelled
            {
                let jobs = self.jobs.lock().unwrap();
                if let Some(j) = jobs.get(job_id) {
                    if j.status == JobStatus::Cancelled {
                        return Err(MorphDropError::CancelledError);
                    }
                }
            }

            let input = PathBuf::from(input_path);
            let output = utils::generate_output_path(&input, &output_dir, &job.output_format);

            // Set up progress channel
            let (progress_tx, mut progress_rx) = mpsc::channel::<f64>(32);
            let job_id_clone = job_id.to_string();
            let jobs_clone = Arc::clone(&self.jobs);
            let app_handle_clone = app_handle.clone();
            let file_idx = i;
            let total = total_files;

            // Spawn a task to forward progress updates
            tokio::spawn(async move {
                while let Some(file_progress) = progress_rx.recv().await {
                    let overall = (file_idx as f64 + file_progress) / total as f64;
                    {
                        let mut jobs = jobs_clone.lock().unwrap();
                        if let Some(j) = jobs.get_mut(&job_id_clone) {
                            j.progress = overall;
                        }
                    }
                    // Emit progress event to frontend
                    let _ = app_handle_clone.emit(
                        "conversion-progress",
                        serde_json::json!({
                            "job_id": job_id_clone,
                            "progress": overall,
                            "current_file": file_idx,
                            "total_files": total,
                        }),
                    );
                }
            });

            match self
                .engine_manager
                .convert(&input, &output, &job.output_format, &job.settings, Some(progress_tx))
                .await
            {
                Ok(out_path) => {
                    output_files.push(out_path.to_string_lossy().to_string());
                }
                Err(e) => {
                    self.update_status(job_id, JobStatus::Failed, Some(e.to_string()));

                    let _ = app_handle.emit(
                        "conversion-error",
                        serde_json::json!({
                            "job_id": job_id,
                            "error": e.to_string(),
                        }),
                    );

                    return Err(e);
                }
            }
        }

        // Mark completed
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(j) = jobs.get_mut(job_id) {
                j.status = JobStatus::Completed;
                j.progress = 1.0;
                j.completed_at = Some(Utc::now());
                j.output_files = output_files.clone();
            }
        }

        // Save to history
        let input_sizes: Vec<u64> = job
            .input_files
            .iter()
            .filter_map(|p| std::fs::metadata(p).ok().map(|m| m.len()))
            .collect();

        let history = HistoryEntry {
            id: 0,
            job_id: job_id.to_string(),
            input_files: job.input_files.clone(),
            output_files: output_files.clone(),
            output_format: job.output_format.label().to_string(),
            status: "Completed".to_string(),
            created_at: Utc::now().to_rfc3339(),
            file_sizes: input_sizes,
        };
        let _ = self.db.add_history(&history);

        // Emit completion event
        let _ = app_handle.emit(
            "conversion-complete",
            serde_json::json!({
                "job_id": job_id,
                "output_files": output_files,
            }),
        );

        Ok(())
    }

    pub fn cancel(&self, job_id: &str) -> Result<(), MorphDropError> {
        let mut jobs = self.jobs.lock().unwrap();
        if let Some(j) = jobs.get_mut(job_id) {
            if j.status == JobStatus::Running || j.status == JobStatus::Pending {
                j.status = JobStatus::Cancelled;
                j.completed_at = Some(Utc::now());
            }
            Ok(())
        } else {
            Err(MorphDropError::ConversionError(format!(
                "Job not found: {}",
                job_id
            )))
        }
    }

    pub fn get_job(&self, job_id: &str) -> Option<ConversionJob> {
        let jobs = self.jobs.lock().unwrap();
        jobs.get(job_id).cloned()
    }

    fn update_status(&self, job_id: &str, status: JobStatus, error: Option<String>) {
        let mut jobs = self.jobs.lock().unwrap();
        if let Some(j) = jobs.get_mut(job_id) {
            j.status = status;
            j.error_message = error;
            if j.status == JobStatus::Failed || j.status == JobStatus::Cancelled {
                j.completed_at = Some(Utc::now());
            }
        }
    }
}
