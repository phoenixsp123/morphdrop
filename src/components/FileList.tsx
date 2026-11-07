import { Plus, Trash2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileCard } from './FileCard';
import { formatFileSize } from '../lib/fileUtils';
import type { FileInfo } from '../types';

interface FileListProps {
  files: FileInfo[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  onAddMore: (paths: string[]) => void;
}

export default function FileList({ files, onRemoveFile, onClearAll, onAddMore }: FileListProps) {
  const totalSize = files.reduce((sum, f) => sum + f.size_bytes, 0);

  const handleAddMore = async () => {
    try {
      const selected = await open({ multiple: true, title: 'Add more files' });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) onAddMore(paths);
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Selected Files</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-medium">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatFileSize(totalSize)} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddMore}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl
              bg-white/50 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-300
              border border-white/60 dark:border-white/10 hover:border-indigo-400/50
              hover:bg-white/80 dark:hover:bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all cursor-pointer"
          >
            <Plus size={13} />
            Add More
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl
              text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/15
              border border-red-500/20 hover:border-red-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-xl transition-all cursor-pointer"
          >
            <Trash2 size={13} />
            Clear All
          </button>
        </div>
      </div>

      {/* File Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {files.map((file, index) => (
          <FileCard
            key={`${file.path}-${index}`}
            file={file}
            onRemove={() => onRemoveFile(index)}
          />
        ))}
      </div>
    </div>
  );
}
