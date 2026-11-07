import { useState, useCallback, useRef } from "react";
import type { ConversionJob, ConversionSettings, OutputFormat, JobStatus } from "../types";
import { startConversion as apiStartConversion, getJobStatus, cancelConversion as apiCancelConversion } from "../lib/tauri";

export interface UseConversionReturn {
  job: ConversionJob | null;
  jobId: string | null;
  progress: number;
  status: JobStatus;
  outputFiles: string[];
  isConverting: boolean;
  error: string | null;
  start: (
    inputFiles: string[],
    outputFormat: OutputFormat,
    outputDirectory: string,
    settings: ConversionSettings
  ) => Promise<void>;
  startConversion: (
    inputFiles: string[],
    outputFormat: OutputFormat,
    outputDirectory: string,
    settings: ConversionSettings
  ) => Promise<void>;
  cancel: () => Promise<void>;
  cancelConversion: () => Promise<void>;
  reset: () => void;
}

export function useConversion(): UseConversionReturn {
  const [job, setJob] = useState<ConversionJob | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    (jobId: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const status = await getJobStatus(jobId);
          setJob(status);
          if (
            status.status === "Completed" ||
            status.status === "Failed" ||
            status.status === "Cancelled"
          ) {
            stopPolling();
            setIsConverting(false);
            if (status.status === "Failed") {
              setError(status.error_message ?? "Conversion failed");
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          stopPolling();
          setIsConverting(false);
        }
      }, 250);
    },
    [stopPolling]
  );

  const start = useCallback(
    async (
      inputFiles: string[],
      outputFormat: OutputFormat,
      outputDirectory: string,
      settings: ConversionSettings
    ) => {
      setIsConverting(true);
      setError(null);
      setJob(null);
      try {
        const jobId = await apiStartConversion(
          inputFiles,
          outputFormat,
          outputDirectory,
          settings
        );
        jobIdRef.current = jobId;
        const initialStatus = await getJobStatus(jobId);
        setJob(initialStatus);
        pollStatus(jobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsConverting(false);
      }
    },
    [pollStatus]
  );

  const cancel = useCallback(async () => {
    if (jobIdRef.current) {
      try {
        await apiCancelConversion(jobIdRef.current);
      } catch {
        // Ignore cancel errors
      }
    }
    stopPolling();
    setIsConverting(false);
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setJob(null);
    setIsConverting(false);
    setError(null);
    jobIdRef.current = null;
  }, [stopPolling]);

  return {
    job,
    jobId: job?.id ?? jobIdRef.current,
    progress: job?.progress ?? 0,
    status: job?.status ?? "Pending",
    outputFiles: job?.output_files ?? [],
    isConverting,
    error,
    start,
    startConversion: start,
    cancel,
    cancelConversion: cancel,
    reset,
  };
}
