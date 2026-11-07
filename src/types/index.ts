// ─────────────────────────────────────────────
// Types mirroring the Rust backend (models.rs)
// ─────────────────────────────────────────────

/** Detected type category of a file. */
export type FileType =
  | "Image"
  | "Video"
  | "Audio"
  | "Document"
  | "Archive"
  | "StructuredData"
  | "Unknown";

/** Supported output formats for conversions. */
export type OutputFormat =
  | "Png"
  | "Jpeg"
  | "Webp"
  | "Bmp"
  | "Tiff"
  | "Gif"
  | "Ico"
  | "Avif"
  | "Pdf"
  | "Zip"
  | "Json"
  | "Csv"
  | "Tsv"
  | "Yaml"
  | "Xml"
  | "Txt";

/** Status of a conversion job. */
export type JobStatus =
  | "Pending"
  | "Running"
  | "Completed"
  | "Failed"
  | "Cancelled";

/** Information about a detected file. */
export interface FileInfo {
  path: string;
  filename: string;
  extension: string;
  detected_type: FileType;
  size_bytes: number;
  mime_type: string;
}

/** User-provided settings for a conversion. */
export interface ConversionSettings {
  image_quality: number | null;
  image_width: number | null;
  image_height: number | null;
  preserve_aspect_ratio: boolean;
  preserve_metadata: boolean;
  compression_level: number | null;
  pdf_pages: number[] | null;
}

/** A conversion job tracked by the job queue. */
export interface ConversionJob {
  id: string;
  input_files: string[];
  output_format: OutputFormat;
  output_directory: string;
  status: JobStatus;
  progress: number;
  settings: ConversionSettings;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  output_files: string[];
}

/** Describes a single conversion that the app can perform. */
export interface ConversionCapability {
  input_format: string;
  output_format: OutputFormat;
  engine_name: string;
  description: string;
}

/** A row from the conversion history table. */
export interface HistoryEntry {
  id: number;
  job_id: string;
  input_files: string[];
  output_files: string[];
  output_format: string;
  status: string;
  created_at: string;
  file_sizes: number[];
}

/** App-wide user settings stored in SQLite. */
export interface AppSettings {
  theme: "system" | "light" | "dark";
  default_output_folder: string;
  preserve_originals: boolean;
  filename_collision: "rename" | "overwrite" | "ask";
  default_image_quality: number;
  conversion_concurrency: number;
}

/** Theme preference selection. */
export type ThemePreference = "light" | "dark" | "system";

/** Case transform for renaming. */
export type CaseTransform = "Lowercase" | "Uppercase" | "TitleCase" | "SnakeCase" | "KebabCase";

/** Batch renaming rules. */
export interface RenameRule {
  prefix?: string;
  suffix?: string;
  find?: string;
  replace_with?: string;
  case_transform?: CaseTransform;
  numbering_start?: number;
  numbering_padding?: number;
  clean_special_chars: boolean;
  add_date_prefix: boolean;
}

/** Preview entry for proposed renaming. */
export interface RenamePreview {
  original_path: string;
  proposed_name: string;
  proposed_path: string;
  changed: boolean;
}

/** External dependency status (FFmpeg, LibreOffice, 7-Zip, QPDF). */
export interface DependencyStatus {
  name: string;
  binary: string;
  is_available: boolean;
  version: string | null;
  path: string | null;
  license: string;
  required_for: string;
  install_hint: string;
}
