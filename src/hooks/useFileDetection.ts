import { useState, useCallback } from "react";
import type { FileInfo, OutputFormat } from "../types";
import { detectFiles as apiDetectFiles, getCompatibleFormats as apiGetCompatibleFormats } from "../lib/tauri";

export interface UseFileDetectionReturn {
  files: FileInfo[];
  compatibleFormats: OutputFormat[];
  isDetecting: boolean;
  error: string | null;
  detectFiles: (paths: string[]) => Promise<FileInfo[]>;
  getFormats: (fileList: FileInfo[]) => Promise<OutputFormat[]>;
  detect: (paths: string[]) => Promise<void>;
  addFiles: (paths: string[]) => Promise<void>;
  removeFile: (path: string) => void;
  clearFiles: () => void;
}

export function useFileDetection(): UseFileDetectionReturn {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [compatibleFormats, setCompatibleFormats] = useState<OutputFormat[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFormats = useCallback(async (fileList: FileInfo[]): Promise<OutputFormat[]> => {
    if (fileList.length === 0) {
      setCompatibleFormats([]);
      return [];
    }
    try {
      const formats = await apiGetCompatibleFormats(fileList);
      setCompatibleFormats(formats);
      return formats;
    } catch (err) {
      console.error("Failed to fetch compatible formats:", err);
      setCompatibleFormats([]);
      return [];
    }
  }, []);

  const detectFilesFn = useCallback(async (paths: string[]): Promise<FileInfo[]> => {
    setIsDetecting(true);
    setError(null);
    try {
      const detected = await apiDetectFiles(paths);
      return detected;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return [];
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const detect = useCallback(async (paths: string[]) => {
    const detected = await detectFilesFn(paths);
    setFiles(detected);
    await getFormats(detected);
  }, [detectFilesFn, getFormats]);

  const addFiles = useCallback(
    async (paths: string[]) => {
      const detected = await detectFilesFn(paths);
      setFiles((prev) => {
        const existingPaths = new Set(prev.map((f) => f.path));
        const newFiles = detected.filter((f) => !existingPaths.has(f.path));
        const combined = [...prev, ...newFiles];
        getFormats(combined);
        return combined;
      });
    },
    [detectFilesFn, getFormats]
  );

  const removeFile = useCallback((path: string) => {
    setFiles((prev) => {
      const remaining = prev.filter((f) => f.path !== path);
      getFormats(remaining);
      return remaining;
    });
  }, [getFormats]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setCompatibleFormats([]);
    setError(null);
  }, []);

  return {
    files,
    compatibleFormats,
    isDetecting,
    error,
    detectFiles: detectFilesFn,
    getFormats,
    detect,
    addFiles,
    removeFile,
    clearFiles,
  };
}
