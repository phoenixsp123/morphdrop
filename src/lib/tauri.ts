/**
 * Typed wrappers around Tauri IPC commands.
 * Every function here maps to a #[tauri::command] in the Rust backend.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  FileInfo,
  OutputFormat,
  ConversionSettings,
  ConversionJob,
  ConversionCapability,
  HistoryEntry,
  RenameRule,
  RenamePreview,
  DependencyStatus,
} from "../types";

// ── File Detection ──────────────────────────

/** Detect types/metadata for one or more file paths. */
export async function detectFiles(paths: string[]): Promise<FileInfo[]> {
  return invoke<FileInfo[]>("detect_files", { paths });
}

// ── Format Compatibility ────────────────────

/** Get compatible output formats for a set of detected files. */
export async function getCompatibleFormats(
  fileInfos: FileInfo[]
): Promise<OutputFormat[]> {
  return invoke<OutputFormat[]>("get_compatible_formats", { fileInfos });
}

/** List all conversion capabilities the app supports. */
export async function listCapabilities(): Promise<ConversionCapability[]> {
  return invoke<ConversionCapability[]>("get_all_capabilities");
}

// ── Conversion ──────────────────────────────

/** Start a new conversion job. Returns the job ID. */
export async function startConversion(
  inputFiles: string[],
  outputFormat: OutputFormat,
  outputDirectory: string,
  settings: ConversionSettings
): Promise<string> {
  return invoke<string>("start_conversion", {
    inputFiles,
    outputFormat,
    outputDir: outputDirectory,
    settings,
  });
}

/** Get the current state of a conversion job. */
export async function getJobStatus(jobId: string): Promise<ConversionJob> {
  return invoke<ConversionJob>("get_job_status", { jobId });
}

/** Cancel a running conversion job. */
export async function cancelConversion(jobId: string): Promise<void> {
  return invoke<void>("cancel_job", { jobId });
}

// ── History ─────────────────────────────────

/** Fetch conversion history. */
export async function getHistory(): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("get_conversion_history");
}

/** Clear all conversion history. */
export async function clearHistory(): Promise<void> {
  return invoke<void>("clear_history");
}

// ── Settings ────────────────────────────────

export async function getSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_settings");
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>("set_setting", { key, value });
}

// ── File System & Native Operations ─────────

/** Open a file with its default system handler. */
export async function openFile(path: string): Promise<void> {
  return invoke<void>("open_file", { path });
}

/** Reveal a file in Finder (macOS) or File Explorer (Windows). */
export async function openInFolder(path: string): Promise<void> {
  return invoke<void>("open_in_folder", { path });
}

// ── PDF & Document Operations ───────────────

export async function mergePdfs(paths: string[], outputPath: string): Promise<string> {
  return invoke<string>("merge_pdfs", { paths, outputPath });
}

export async function imagesToPdf(imagePaths: string[], outputPath: string): Promise<string> {
  return invoke<string>("images_to_pdf", { imagePaths, outputPath });
}

export async function splitPdf(
  inputPath: string,
  outputDir: string,
  pages?: number[]
): Promise<string[]> {
  return invoke<string[]>("split_pdf", { inputPath, outputDir, pages: pages ?? null });
}

export async function getPdfPageCount(path: string): Promise<number> {
  return invoke<number>("get_pdf_page_count", { path });
}

// ── Archive Operations ──────────────────────

export async function createArchive(
  inputPaths: string[],
  outputPath: string
): Promise<string> {
  return invoke<string>("create_archive", { inputPaths, outputPath });
}

export async function extractArchive(
  archivePath: string,
  outputDir: string
): Promise<string[]> {
  return invoke<string[]>("extract_archive", { archivePath, outputDir });
}

export async function listArchive(archivePath: string): Promise<string[]> {
  return invoke<string[]>("list_archive", { archivePath });
}

// ── Batch Renaming & Journal ────────────────

export async function previewBatchRename(
  paths: string[],
  rule: RenameRule
): Promise<RenamePreview[]> {
  return invoke<RenamePreview[]>("preview_batch_rename", { paths, rule });
}

export async function executeBatchRename(
  previews: RenamePreview[]
): Promise<string[]> {
  return invoke<string[]>("execute_batch_rename", { previews });
}

export async function undoLastRename(): Promise<string[]> {
  return invoke<string[]>("undo_last_rename");
}

// ── External Dependencies ───────────────────

export async function probeExternalDependencies(): Promise<DependencyStatus[]> {
  return invoke<DependencyStatus[]>("probe_external_dependencies");
}

export async function convertMediaExternal(
  inputPath: string,
  outputPath: string,
  extraArgs: string[]
): Promise<string> {
  return invoke<string>("convert_media_external", {
    inputPath,
    outputPath,
    extraArgs,
  });
}

export async function convertOfficeExternal(
  inputPath: string,
  outputDir: string
): Promise<string> {
  return invoke<string>("convert_office_external", { inputPath, outputDir });
}

// ── SmartDrop Window ────────────────────────

export async function toggleSmartDropWindow(): Promise<void> {
  return invoke<void>("toggle_smartdrop_window");
}

export async function hideSmartDropWindow(): Promise<void> {
  return invoke<void>("hide_smartdrop_window");
}

export async function getSmartDropShortcut(): Promise<string> {
  return invoke<string>("get_smartdrop_shortcut");
}

export async function setSmartDropShortcut(shortcut: string): Promise<string> {
  return invoke<string>("set_smartdrop_shortcut", { shortcut });
}
