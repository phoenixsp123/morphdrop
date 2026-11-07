import React from "react";
import {
  Image,
  FileVideo,
  FileAudio,
  FileText,
  Archive,
  Database,
  File,
} from "lucide-react";
import type { FileType } from "../types";

interface FileTypeIconProps {
  type: FileType;
  className?: string;
  style?: React.CSSProperties;
}

const iconMap: Record<FileType, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  Image,
  Video: FileVideo,
  Audio: FileAudio,
  Document: FileText,
  Archive,
  StructuredData: Database,
  Unknown: File,
};

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({ type, className, style }) => {
  const IconComponent = iconMap[type] ?? File;
  return <IconComponent className={className} style={style} />;
};
