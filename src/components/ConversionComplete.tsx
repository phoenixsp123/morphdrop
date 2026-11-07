import { CheckCircle2, Folder, ExternalLink, ArrowLeft, Clock, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { openFile, openInFolder } from '../lib/tauri';
import { truncateFilename } from '../lib/fileUtils';
import type { OutputFormat } from '../types';

interface ConversionCompleteProps {
  outputFiles: string[];
  inputCount: number;
  format: OutputFormat | null;
  onConvertMore: () => void;
  onViewHistory: () => void;
}

export default function ConversionComplete({
  outputFiles,
  inputCount,
  format,
  onConvertMore,
  onViewHistory,
}: ConversionCompleteProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyPath = (path: string, index: number) => {
    navigator.clipboard.writeText(path);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleOpenFile = async (path: string) => {
    try {
      await openFile(path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await openInFolder(path);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-xl text-center">
        {/* Animated Success Badge */}
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center text-green-500 shadow-xl shadow-green-500/10 scale-100 animate-slide-up">
          <CheckCircle2 size={44} strokeWidth={2.2} />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Conversion Complete!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
          Successfully converted {inputCount} {inputCount === 1 ? 'file' : 'files'}{' '}
          {format ? `to ${format}` : ''}
        </p>

        {/* Output Files Card List */}
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-gray-200 dark:border-[#2a2a3a] p-4 mb-6 shadow-sm text-left max-h-72 overflow-y-auto space-y-2">
          {outputFiles.map((path, idx) => {
            const filename = path.split(/[\/\\]/).pop() || path;
            return (
              <div
                key={path + idx}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/60 dark:border-white/10 hover:border-indigo-400/40 hover:bg-white/75 dark:hover:bg-white/[0.07] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_10px_25px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.3)] transition-all duration-200"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {truncateFilename(filename, 36)}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {path}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopyPath(path, idx)}
                    title="Copy absolute path"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    {copiedIndex === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => handleOpenFile(path)}
                    title="Open file with default viewer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    onClick={() => handleOpenFolder(path)}
                    title="Reveal in Finder / Explorer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                  >
                    <Folder size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onConvertMore}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold text-xs shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.5),0_8px_20px_rgba(99,102,241,0.3)] border border-white/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Convert More Files</span>
          </button>

          {outputFiles.length > 0 && (
            <button
              onClick={() => handleOpenFolder(outputFiles[0])}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-white/[0.08] hover:border-indigo-400/40 font-semibold text-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] backdrop-blur-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Folder size={14} />
              <span>Open Output Folder</span>
            </button>
          )}

          <button
            onClick={onViewHistory}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white/60 dark:hover:bg-white/10 font-semibold text-xs border border-transparent hover:border-white/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Clock size={14} />
            <span>History</span>
          </button>
        </div>
      </div>
    </div>
  );
}
