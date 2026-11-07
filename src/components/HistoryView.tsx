import { useState } from 'react';
import { Clock, Trash2, Folder, ExternalLink, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useHistory } from '../hooks/useHistory';
import { openFile, openInFolder } from '../lib/tauri';
import { truncateFilename } from '../lib/fileUtils';

export default function HistoryView() {
  const { entries, isLoading, clearHistory, refresh } = useHistory();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = entries.filter((entry) => {
    const term = searchTerm.toLowerCase();
    const matchesFormat = entry.output_format.toLowerCase().includes(term);
    const matchesInput = entry.input_files.some((f) => f.toLowerCase().includes(term));
    const matchesOutput = entry.output_files.some((f) => f.toLowerCase().includes(term));
    return matchesFormat || matchesInput || matchesOutput;
  });

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
    <div className="flex-1 flex flex-col p-6 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-[#2a2a3a]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Conversion History
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            View and manage your recent file transformations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            title="Refresh history"
            className="p-2 rounded-lg border border-gray-200 dark:border-[#2a2a3a] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {entries.length > 0 && (
            <button
              onClick={() => clearHistory()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {entries.length > 0 && (
        <div className="py-3">
          <input
            type="text"
            placeholder="Search history by filename or format..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/10 text-gray-800 dark:text-zinc-200 placeholder-gray-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* History List */}
      <div className="flex-1 overflow-y-auto space-y-3 pt-2">
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-600 mb-3">
              <Clock size={28} />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              No conversion history yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
              Files you convert will appear here with instant access to their output folders.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No history entries matching &quot;{searchTerm}&quot;
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const formattedDate = new Date(entry.created_at).toLocaleString(undefined, {
              dateStyle: 'short',
              timeStyle: 'short',
            });
            const isSuccess = entry.status === 'Completed';

            return (
              <div
                key={entry.id + entry.job_id}
                className="p-4 rounded-2xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_10px_25px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.3)] hover:border-indigo-400/40 hover:bg-white/70 dark:hover:bg-white/[0.07] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {isSuccess ? (
                      <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-red-500 shrink-0" />
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      {entry.output_format}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {formattedDate}
                    </span>
                  </div>

                  <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                    isSuccess
                      ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {entry.status}
                  </span>
                </div>

                {/* Input -> Output Info */}
                <div className="space-y-1.5 pl-6">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-500">Inputs: </span>
                    {entry.input_files.map((p) => p.split(/[\/\\]/).pop()).join(', ')}
                  </div>

                  {entry.output_files.length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-xs text-gray-800 dark:text-gray-200 font-mono truncate">
                        {entry.output_files.map((p) => truncateFilename(p.split(/[\/\\]/).pop() || p, 32)).join(', ')}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenFile(entry.output_files[0])}
                          title="Open converted file"
                          className="p-1 rounded-md text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        >
                          <ExternalLink size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenFolder(entry.output_files[0])}
                          title="Open folder"
                          className="p-1 rounded-md text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        >
                          <Folder size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
