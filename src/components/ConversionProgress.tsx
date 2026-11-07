import { useState, useEffect } from 'react';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';

interface ConversionProgressProps {
  progress: number;
  status: string;
  error: string | null;
  currentFile: string;
  totalFiles: number;
  onCancel: () => void;
  jobId: string | null;
}

export default function ConversionProgress({
  progress: initialProgress,
  status,
  error,
  currentFile,
  totalFiles,
  onCancel,
  jobId,
}: ConversionProgressProps) {
  const [progress, setProgress] = useState(initialProgress);
  const [elapsed, setElapsed] = useState(0);

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<{ job_id: string; progress: number }>('conversion-progress', (event) => {
      if (event.payload.job_id === jobId) {
        setProgress(event.payload.progress);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [jobId]);

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progressPct = Math.round(progress * 100);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
        <div className="text-center max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl p-8 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.7),0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.08),0_25px_60px_rgba(0,0,0,0.4)]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center border border-red-500/20 shadow-sm">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-2">
            Conversion Failed
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-5 leading-relaxed">{error}</p>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.05] border border-white/60 dark:border-white/10 text-xs font-semibold
              text-gray-700 dark:text-zinc-200 hover:bg-white/90 dark:hover:bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] backdrop-blur-xl transition-all cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl p-8 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.7),0_25px_60px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.08),0_25px_60px_rgba(0,0,0,0.4)]">
        {/* Spinner */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-white/60 dark:border-white/10 flex items-center justify-center shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_6px_20px_rgba(99,102,241,0.2)]">
            <Loader2 size={24} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
          </div>
        </div>

        <h2 className="text-base font-bold text-center text-gray-900 dark:text-zinc-100 mb-1">
          {status === 'Running' ? 'Converting Files...' : status}
        </h2>
        <p className="text-xs text-center text-gray-500 dark:text-zinc-400 mb-6 truncate font-mono">
          {currentFile}
        </p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-2">
            <span className="font-mono">{progressPct}%</span>
            <span className="font-mono">{minutes}:{seconds.toString().padStart(2, '0')}</span>
          </div>
          <div className="h-2.5 bg-white/60 dark:bg-white/10 rounded-full overflow-hidden border border-white/60 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)]">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 rounded-full shadow-sm transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <p className="text-[11px] text-center text-gray-400 dark:text-zinc-500 mb-6 font-medium">
          Processing {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
        </p>

        {/* Cancel */}
        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
              text-gray-500 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
          >
            <X size={13} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
