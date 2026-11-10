use crate::error::MorphDropError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub name: String,
    pub binary: String,
    pub is_available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub license: String,
    pub required_for: String,
    pub install_hint: String,
}

pub struct DependencyManager;

impl DependencyManager {
    /// Augment the process PATH environment variable with common system and package manager directories.
    pub fn augment_process_path() {
        if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let mut paths: Vec<String> = current_path
                .split(':')
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect();

            let extra_dirs = [
                "/opt/homebrew/bin",
                "/opt/homebrew/sbin",
                "/usr/local/bin",
                "/usr/local/sbin",
                "/Applications/LibreOffice.app/Contents/MacOS",
            ];

            let mut changed = false;
            for dir in extra_dirs {
                if !paths.iter().any(|p| p == dir) && Path::new(dir).is_dir() {
                    paths.insert(0, dir.to_string());
                    changed = true;
                }
            }

            if changed {
                std::env::set_var("PATH", paths.join(":"));
            }
        }
    }

    /// Probe the system for all optional external tools and return their status.
    pub fn probe_all() -> Vec<DependencyStatus> {
        Self::augment_process_path();
        vec![
            Self::probe_ffmpeg(),
            Self::probe_libreoffice(),
            Self::probe_7zip(),
            Self::probe_qpdf(),
        ]
    }

    pub fn probe_ffmpeg() -> DependencyStatus {
        Self::augment_process_path();
        let binaries = if cfg!(target_os = "macos") {
            vec![
                "ffmpeg",
                "/opt/homebrew/bin/ffmpeg",
                "/usr/local/bin/ffmpeg",
            ]
        } else {
            vec!["ffmpeg"]
        };

        let (available, version, path) = Self::check_candidates(&binaries, &["-version"]);
        DependencyStatus {
            name: "FFmpeg".into(),
            binary: "ffmpeg".into(),
            is_available: available,
            version,
            path,
            license: "LGPL v2.1+ / GPL v2+".into(),
            required_for: "Video transcoding (MP4, MKV, MOV, WebM) & Audio processing (MP3, FLAC, WAV, AAC, OGG)".into(),
            install_hint: if cfg!(target_os = "macos") {
                "Run `brew install ffmpeg` via Terminal".into()
            } else {
                "Run `winget install Gyan.FFmpeg` via Command Prompt / PowerShell".into()
            },
        }
    }

    pub fn probe_libreoffice() -> DependencyStatus {
        Self::augment_process_path();
        let candidates = if cfg!(target_os = "macos") {
            vec![
                "/Applications/LibreOffice.app/Contents/MacOS/soffice",
                "soffice",
                "libreoffice",
                "/opt/homebrew/bin/soffice",
                "/usr/local/bin/soffice",
            ]
        } else if cfg!(target_os = "windows") {
            vec![
                "soffice",
                "libreoffice",
                "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
                "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
            ]
        } else {
            vec![
                "soffice",
                "libreoffice",
                "/usr/bin/soffice",
                "/usr/bin/libreoffice",
            ]
        };

        let (avail, ver, path) = Self::check_candidates(&candidates, &["--version"]);
        DependencyStatus {
            name: "LibreOffice Headless".into(),
            binary: "soffice".into(),
            is_available: avail,
            version: ver,
            path,
            license: "MPL-2.0".into(),
            required_for: "Office document conversions (DOCX, PPTX, XLSX, ODT to PDF)".into(),
            install_hint: if cfg!(target_os = "macos") {
                "Run `brew install --cask libreoffice` or download from libreoffice.org".into()
            } else {
                "Run `winget install TheDocumentFoundation.LibreOffice`".into()
            },
        }
    }

    pub fn probe_7zip() -> DependencyStatus {
        Self::augment_process_path();
        let candidates = if cfg!(target_os = "macos") {
            vec![
                "7zz",
                "7z",
                "7za",
                "/opt/homebrew/bin/7zz",
                "/opt/homebrew/bin/7z",
                "/usr/local/bin/7zz",
                "/usr/local/bin/7z",
            ]
        } else if cfg!(target_os = "windows") {
            vec![
                "7z",
                "7za",
                "7zz",
                "C:\\Program Files\\7-Zip\\7z.exe",
                "C:\\Program Files (x86)\\7-Zip\\7z.exe",
            ]
        } else {
            vec![
                "7zz",
                "7z",
                "7za",
                "/usr/bin/7z",
                "/usr/bin/7za",
            ]
        };

        let (avail, ver, path) = Self::check_candidates(&candidates, &["--help"]);
        DependencyStatus {
            name: "7-Zip CLI".into(),
            binary: path.as_deref().and_then(|p| Path::new(p).file_name()).map(|f| f.to_string_lossy().to_string()).unwrap_or_else(|| "7z".into()),
            is_available: avail,
            version: ver,
            path,
            license: "LGPL v2.1".into(),
            required_for: "Advanced 7Z / TAR / GZ archive manipulation (ZIP is natively built-in)".into(),
            install_hint: if cfg!(target_os = "macos") {
                "Run `brew install sevenzip` via Terminal".into()
            } else {
                "Run `winget install 7zip.7zip`".into()
            },
        }
    }

    pub fn probe_qpdf() -> DependencyStatus {
        Self::augment_process_path();
        let candidates = if cfg!(target_os = "macos") {
            vec![
                "qpdf",
                "/opt/homebrew/bin/qpdf",
                "/usr/local/bin/qpdf",
            ]
        } else {
            vec!["qpdf"]
        };

        let (avail, ver, path) = Self::check_candidates(&candidates, &["--version"]);
        DependencyStatus {
            name: "QPDF".into(),
            binary: "qpdf".into(),
            is_available: avail,
            version: ver,
            path,
            license: "Apache-2.0".into(),
            required_for: "Advanced linearized PDF optimization & structural inspection".into(),
            install_hint: if cfg!(target_os = "macos") {
                "Run `brew install qpdf` via Terminal".into()
            } else {
                "Run `winget install qpdf`".into()
            },
        }
    }

    fn check_candidates(candidates: &[&str], test_args: &[&str]) -> (bool, Option<String>, Option<String>) {
        for &bin in candidates {
            // Check if absolute path exists first
            let is_abs = Path::new(bin).is_absolute();
            if is_abs && !Path::new(bin).exists() {
                continue;
            }

            if let Ok(output) = Command::new(bin).args(test_args).output() {
                if output.status.success() || !output.stdout.is_empty() || !output.stderr.is_empty() {
                    let out_str = if !output.stdout.is_empty() {
                        String::from_utf8_lossy(&output.stdout)
                    } else {
                        String::from_utf8_lossy(&output.stderr)
                    };

                    let first_line = out_str
                        .lines()
                        .find(|l| !l.trim().is_empty())
                        .unwrap_or("")
                        .trim()
                        .to_string();

                    let ver = if first_line.is_empty() { None } else { Some(first_line) };
                    let full_path = if is_abs {
                        Some(bin.to_string())
                    } else {
                        which::which(bin)
                            .ok()
                            .map(|p| p.to_string_lossy().to_string())
                            .or_else(|| Some(bin.to_string()))
                    };

                    return (true, ver, full_path);
                }
            }
        }
        (false, None, None)
    }

    /// Convert media (video/audio) using FFmpeg safely without shell command execution.
    pub fn convert_media_with_ffmpeg(
        input: &Path,
        output: &Path,
        extra_args: &[String],
    ) -> Result<PathBuf, MorphDropError> {
        let status = Self::probe_ffmpeg();
        if !status.is_available {
            return Err(MorphDropError::ConversionError(format!(
                "FFmpeg is required for audio/video conversion but was not found on your system. {}",
                status.install_hint
            )));
        }

        let bin = status.path.as_deref().unwrap_or("ffmpeg");
        let mut cmd = Command::new(bin);
        cmd.arg("-y") // Overwrite output without asking
           .arg("-i")
           .arg(input);

        for arg in extra_args {
            cmd.arg(arg);
        }

        cmd.arg(output);

        let output_status = cmd.output().map_err(|e| {
            MorphDropError::ConversionError(format!("Failed to execute FFmpeg: {}", e))
        })?;

        if !output_status.status.success() {
            let stderr = String::from_utf8_lossy(&output_status.stderr);
            return Err(MorphDropError::ConversionError(format!(
                "FFmpeg conversion failed: {}",
                stderr.lines().last().unwrap_or("Unknown error")
            )));
        }

        Ok(output.to_path_buf())
    }

    /// Convert document using LibreOffice headless safely (e.g. DOCX -> PDF or PDF -> DOCX).
    pub fn convert_document_with_libreoffice(
        input: &Path,
        output_dir: &Path,
        target_format: &str,
    ) -> Result<PathBuf, MorphDropError> {
        let status = Self::probe_libreoffice();
        if !status.is_available {
            return Err(MorphDropError::ConversionError(format!(
                "LibreOffice is required for document conversion (DOCX ↔ PDF) but was not found. {}",
                status.install_hint
            )));
        }

        let bin = status.path.as_deref().unwrap_or("soffice");
        let mut cmd = Command::new(bin);
        cmd.arg("--headless");

        let input_ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let target_lower = target_format.to_lowercase();

        // PDF -> DOCX requires the writer_pdf_import filter so it opens in Writer rather than Draw
        if input_ext == "pdf" && target_lower == "docx" {
            cmd.arg("--infilter=writer_pdf_import");
            cmd.arg("--convert-to").arg("docx");
        } else {
            cmd.arg("--convert-to").arg(&target_lower);
        }

        cmd.arg("--outdir")
           .arg(output_dir)
           .arg(input);

        let output_status = cmd.output().map_err(|e| {
            MorphDropError::ConversionError(format!("Failed to execute LibreOffice: {}", e))
        })?;

        if !output_status.status.success() {
            let stderr = String::from_utf8_lossy(&output_status.stderr);
            let stdout = String::from_utf8_lossy(&output_status.stdout);
            let err_text = if !stderr.trim().is_empty() {
                stderr.to_string()
            } else if !stdout.trim().is_empty() {
                stdout.to_string()
            } else {
                "Unknown LibreOffice error".to_string()
            };
            return Err(MorphDropError::ConversionError(format!(
                "LibreOffice document conversion failed: {}",
                err_text
            )));
        }

        let stem = input.file_stem().map(|s| s.to_string_lossy()).unwrap_or_default();
        let expected_file = output_dir.join(format!("{}.{}", stem, target_lower));
        if expected_file.exists() {
            Ok(expected_file)
        } else {
            // Case-insensitive check of output_dir
            if let Ok(entries) = std::fs::read_dir(output_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() {
                        if let Some(ext) = p.extension() {
                            if ext.to_string_lossy().to_lowercase() == target_lower {
                                if let Some(s) = p.file_stem() {
                                    if s.to_string_lossy().to_lowercase() == stem.to_lowercase() {
                                        return Ok(p);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(MorphDropError::ConversionError(
                format!("LibreOffice succeeded but output file '{}.{}' was not found", stem, target_lower),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_probe_dependencies() {
        let deps = DependencyManager::probe_all();
        for d in &deps {
            println!("Tool: {} | available: {} | ver: {:?} | path: {:?}", d.name, d.is_available, d.version, d.path);
        }
        assert_eq!(deps.len(), 4);
        assert_eq!(deps[0].name, "FFmpeg");
        assert_eq!(deps[1].name, "LibreOffice Headless");
        assert_eq!(deps[2].name, "7-Zip CLI");
        assert_eq!(deps[3].name, "QPDF");
    }
}
