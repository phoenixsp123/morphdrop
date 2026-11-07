import React from "react";
import { X } from "lucide-react";
import type { FileInfo } from "../types";
import { formatFileSize, truncateFilename } from "../lib/fileUtils";
import { getFileTypeColor } from "../lib/formatUtils";
import { FileTypeIcon } from "./FileTypeIcon";

interface FileCardProps {
  file: FileInfo;
  onRemove: (path: string) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onRemove }) => {
  const color = getFileTypeColor(file.detected_type);

  return (
    <div
      className="
        group relative flex items-center gap-3 p-3 rounded-2xl
        bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl
        border border-white/60 dark:border-white/10
        hover:border-indigo-400/40 dark:hover:border-indigo-400/30
        hover:bg-white/70 dark:hover:bg-white/[0.07]
        shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_8px_24px_rgba(0,0,0,0.03)]
        dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.35)]
        transition-all duration-200 animate-fade-in
      "
    >
      {/* Type icon */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-white/40 dark:border-white/10 shadow-sm"
        style={{ backgroundColor: `${color}18` }}
      >
        <FileTypeIcon type={file.detected_type} className="w-5 h-5" style={{ color }} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100 truncate" title={file.filename}>
          {truncateFilename(file.filename, 36)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400 dark:text-zinc-400 font-mono">
            {formatFileSize(file.size_bytes)}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wide border border-white/30 dark:border-white/10 shadow-sm"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {file.extension || file.detected_type}
          </span>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(file.path)}
        className="
          flex-shrink-0 opacity-0 group-hover:opacity-100
          p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400
          hover:bg-white/80 dark:hover:bg-white/10 transition-all cursor-pointer
        "
        title="Remove file"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default FileCard;
