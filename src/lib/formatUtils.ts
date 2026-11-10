/**
 * Format metadata: display names, colors, icons, and categories.
 */
import type { OutputFormat, FileType } from "../types";

export type FormatCategory = "Images" | "Documents" | "Archives" | "Data";

export interface FormatMeta {
  label: string;
  extension: string;
  category: FormatCategory;
  color: string;
  iconName: string;
  description: string;
}

const FORMAT_META: Record<OutputFormat, FormatMeta> = {
  Png: {
    label: "PNG",
    extension: ".png",
    category: "Images",
    color: "#6366f1",
    iconName: "Image",
    description: "Lossless image with transparency",
  },
  Jpeg: {
    label: "JPEG",
    extension: ".jpg",
    category: "Images",
    color: "#f59e0b",
    iconName: "Image",
    description: "Compressed photo format",
  },
  Webp: {
    label: "WebP",
    extension: ".webp",
    category: "Images",
    color: "#22c55e",
    iconName: "Image",
    description: "Modern web image format",
  },
  Bmp: {
    label: "BMP",
    extension: ".bmp",
    category: "Images",
    color: "#64748b",
    iconName: "Image",
    description: "Uncompressed bitmap image",
  },
  Tiff: {
    label: "TIFF",
    extension: ".tiff",
    category: "Images",
    color: "#8b5cf6",
    iconName: "Image",
    description: "High-quality print image",
  },
  Gif: {
    label: "GIF",
    extension: ".gif",
    category: "Images",
    color: "#ec4899",
    iconName: "Image",
    description: "Animated image format",
  },
  Ico: {
    label: "ICO",
    extension: ".ico",
    category: "Images",
    color: "#14b8a6",
    iconName: "Image",
    description: "Icon file format",
  },
  Avif: {
    label: "AVIF",
    extension: ".avif",
    category: "Images",
    color: "#06b6d4",
    iconName: "Image",
    description: "Next-gen image format",
  },
  Pdf: {
    label: "PDF",
    extension: ".pdf",
    category: "Documents",
    color: "#ef4444",
    iconName: "FileText",
    description: "Portable document format",
  },
  Docx: {
    label: "DOCX",
    extension: ".docx",
    category: "Documents",
    color: "#2563eb",
    iconName: "FileText",
    description: "Microsoft Word document",
  },
  Zip: {
    label: "ZIP",
    extension: ".zip",
    category: "Archives",
    color: "#f59e0b",
    iconName: "Archive",
    description: "Compressed archive",
  },
  Json: {
    label: "JSON",
    extension: ".json",
    category: "Data",
    color: "#22c55e",
    iconName: "Braces",
    description: "JavaScript Object Notation",
  },
  Csv: {
    label: "CSV",
    extension: ".csv",
    category: "Data",
    color: "#6366f1",
    iconName: "Table",
    description: "Comma-separated values",
  },
  Tsv: {
    label: "TSV",
    extension: ".tsv",
    category: "Data",
    color: "#8b5cf6",
    iconName: "Table",
    description: "Tab-separated values",
  },
  Yaml: {
    label: "YAML",
    extension: ".yaml",
    category: "Data",
    color: "#f97316",
    iconName: "FileCode",
    description: "Human-readable data format",
  },
  Xml: {
    label: "XML",
    extension: ".xml",
    category: "Data",
    color: "#14b8a6",
    iconName: "FileCode",
    description: "Extensible Markup Language",
  },
  Txt: {
    label: "TXT",
    extension: ".txt",
    category: "Data",
    color: "#64748b",
    iconName: "FileText",
    description: "Plain text file",
  },
};

/** Get metadata for a given output format. */
export function getFormatMeta(format: OutputFormat): FormatMeta {
  return FORMAT_META[format];
}
export const getFormatInfo = getFormatMeta;

/** Get all format metadata entries. */
export function getAllFormats(): { format: OutputFormat; meta: FormatMeta }[] {
  return (Object.entries(FORMAT_META) as [OutputFormat, FormatMeta][]).map(
    ([format, meta]) => ({ format, meta })
  );
}

/** Get formats grouped by category. */
export function getFormatsByCategory(): Record<
  FormatCategory,
  { format: OutputFormat; meta: FormatMeta }[]
> {
  const groups: Record<FormatCategory, { format: OutputFormat; meta: FormatMeta }[]> = {
    Images: [],
    Documents: [],
    Archives: [],
    Data: [],
  };
  for (const [format, meta] of Object.entries(FORMAT_META) as [OutputFormat, FormatMeta][]) {
    groups[meta.category].push({ format, meta });
  }
  return groups;
}

/** Get a Lucide icon name for a FileType. */
export function getFileTypeIcon(type: FileType): string {
  switch (type) {
    case "Image":
      return "Image";
    case "Video":
      return "FileVideo";
    case "Audio":
      return "FileAudio";
    case "Document":
      return "FileText";
    case "Archive":
      return "Archive";
    case "StructuredData":
      return "Database";
    case "Unknown":
    default:
      return "File";
  }
}

/** Get a color for a FileType badge. */
export function getFileTypeColor(type: FileType): string {
  switch (type) {
    case "Image":
      return "#6366f1";
    case "Video":
      return "#ec4899";
    case "Audio":
      return "#f59e0b";
    case "Document":
      return "#ef4444";
    case "Archive":
      return "#22c55e";
    case "StructuredData":
      return "#06b6d4";
    case "Unknown":
    default:
      return "#64748b";
  }
}

/** All supported OutputFormat values. */
export const ALL_FORMATS: OutputFormat[] = Object.keys(FORMAT_META) as OutputFormat[];
