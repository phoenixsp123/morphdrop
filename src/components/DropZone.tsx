import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

interface DropZoneProps {
  onFilesDetected: (paths: string[]) => void;
}

export default function DropZone({ onFilesDetected }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleBrowse = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        title: 'Select files to convert',
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          onFilesDetected(paths);
        }
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  }, [onFilesDetected]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
        onClick={handleBrowse}
        className={`
          group relative w-full max-w-lg aspect-[4/3] rounded-[32px] cursor-pointer
          flex flex-col items-center justify-center gap-4 transition-all duration-300
          border backdrop-blur-3xl p-8 overflow-hidden
          ${isDragOver
            ? 'scale-[1.02] border-indigo-500/80 bg-indigo-500/12 dark:bg-indigo-500/15 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_25px_60px_rgba(99,102,241,0.25)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.18),0_30px_70px_rgba(99,102,241,0.35)]'
            : 'border-white/60 dark:border-white/12 bg-white/45 dark:bg-white/[0.035] hover:bg-white/60 dark:hover:bg-white/[0.055] hover:border-indigo-400/50 dark:hover:border-indigo-400/30 shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.85),0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.12),0_25px_60px_rgba(0,0,0,0.45)]'
          }
        `}
      >
        {/* Subtle Liquid Inner Sheen Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-gradient-to-b from-white/40 dark:from-white/10 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />

        {/* Floating Glass Icon Orb */}
        <div className={`
          relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 border
          ${isDragOver
            ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white border-white/40 shadow-lg shadow-indigo-500/30 scale-110'
            : 'bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/15 text-indigo-600 dark:text-indigo-400 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9),0_8px_20px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.15),0_8px_25px_rgba(0,0,0,0.3)] group-hover:scale-105 group-hover:border-indigo-400/40'
          }
        `}>
          <Upload size={26} strokeWidth={1.75} />
        </div>

        <div className="text-center z-10">
          <p className={`text-base font-semibold tracking-tight ${isDragOver ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-zinc-100'}`}>
            {isDragOver ? 'Release to convert files' : 'Drop files here to convert'}
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-medium">
            or click to browse from your device
          </p>
        </div>

        {/* Format categories pill */}
        <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500 dark:text-zinc-400 px-3 py-1 rounded-full bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] z-10">
          <span>Images</span>
          <span>·</span>
          <span>Documents</span>
          <span>·</span>
          <span>Archives</span>
          <span>·</span>
          <span>Data</span>
        </div>
      </div>
    </div>
  );
}
