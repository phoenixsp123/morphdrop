import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';
import { previewBatchRename, executeBatchRename, undoLastRename } from '../lib/tauri';
import type { FileInfo, RenameRule, RenamePreview, CaseTransform } from '../types';

interface BatchRenameModalProps {
  files: FileInfo[];
  isOpen: boolean;
  onClose: () => void;
  onRenamed: (newPaths: string[]) => void;
}

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  files,
  isOpen,
  onClose,
  onRenamed,
}) => {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [find, setFind] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [caseTransform, setCaseTransform] = useState<CaseTransform | ''>('');
  const [useNumbering, setUseNumbering] = useState(false);
  const [numberingStart, setNumberingStart] = useState(1);
  const [cleanChars, setCleanChars] = useState(false);
  const [addDate, setAddDate] = useState(false);

  const [previews, setPreviews] = useState<RenamePreview[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  const updatePreview = useCallback(async () => {
    if (files.length === 0) return;
    const paths = files.map((f) => f.path);
    const rule: RenameRule = {
      prefix: prefix ? prefix : undefined,
      suffix: suffix ? suffix : undefined,
      find: find ? find : undefined,
      replace_with: replaceWith ? replaceWith : undefined,
      case_transform: caseTransform ? (caseTransform as CaseTransform) : undefined,
      numbering_start: useNumbering ? numberingStart : undefined,
      numbering_padding: 3,
      clean_special_chars: cleanChars,
      add_date_prefix: addDate,
    };

    try {
      const results = await previewBatchRename(paths, rule);
      setPreviews(results);
    } catch (err) {
      console.error('Preview error:', err);
    }
  }, [files, prefix, suffix, find, replaceWith, caseTransform, useNumbering, numberingStart, cleanChars, addDate]);

  useEffect(() => {
    if (isOpen) {
      updatePreview();
    }
  }, [isOpen, updatePreview]);

  if (!isOpen) return null;

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      const newPaths = await executeBatchRename(previews);
      onRenamed(newPaths);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndo = async () => {
    try {
      const restored = await undoLastRename();
      setUndoMessage(`Restored ${restored.length} files to original names!`);
      setTimeout(() => setUndoMessage(null), 3000);
      onRenamed(restored);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-[#13131c]/80 backdrop-blur-3xl shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_30px_70px_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-[#2a2a3a]">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              <span>Safe Batch Renamer</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Customize patterns, preview changes live, and revert via undo journal
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Configuration Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {undoMessage && (
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400 flex items-center gap-2">
              <Check size={15} />
              <span>{undoMessage}</span>
            </div>
          )}

          {/* Pattern inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Prefix
              </label>
              <input
                type="text"
                placeholder="e.g. 2026_Doc_"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Suffix
              </label>
              <input
                type="text"
                placeholder="e.g. _v2"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Find and Replace */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Find Text
              </label>
              <input
                type="text"
                placeholder="Search substring..."
                value={find}
                onChange={(e) => setFind(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Replace With
              </label>
              <input
                type="text"
                placeholder="Replacement..."
                value={replaceWith}
                onChange={(e) => setReplaceWith(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Case & Numbering */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Change Letter Case
              </label>
              <select
                value={caseTransform}
                onChange={(e) => setCaseTransform(e.target.value as CaseTransform | '')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-700 dark:text-gray-300"
              >
                <option value="">No case change</option>
                <option value="Lowercase">lowercase</option>
                <option value="Uppercase">UPPERCASE</option>
                <option value="TitleCase">Title Case</option>
                <option value="SnakeCase">snake_case</option>
                <option value="KebabCase">kebab-case</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useNumbering}
                  onChange={(e) => setUseNumbering(e.target.checked)}
                  className="accent-indigo-500"
                />
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Sequential Numbering
                </span>
              </label>
              {useNumbering && (
                <input
                  type="number"
                  min="1"
                  value={numberingStart}
                  onChange={(e) => setNumberingStart(parseInt(e.target.value) || 1)}
                  className="w-14 px-2 py-1 rounded bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-center"
                />
              )}
            </div>
          </div>

          {/* Quick Checkboxes */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={cleanChars}
                onChange={(e) => setCleanChars(e.target.checked)}
                className="accent-indigo-500"
              />
              <span className="text-gray-600 dark:text-gray-400">
                Clean invalid characters &amp; spaces
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={addDate}
                onChange={(e) => setAddDate(e.target.checked)}
                className="accent-indigo-500"
              />
              <span className="text-gray-600 dark:text-gray-400">
                Add current date prefix (YYYY-MM-DD)
              </span>
            </label>
          </div>

          {/* Live Preview List */}
          <div className="mt-3">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Preview Proposed Changes ({previews.filter((p) => p.changed).length} of {files.length} modified)
            </h4>
            <div className="bg-gray-50 dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#2a2a3a] max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 font-mono text-[11px]">
              {previews.map((item, i) => {
                const orig = item.original_path.split(/[\/\\]/).pop();
                return (
                  <div key={i} className="p-2.5 flex items-center justify-between gap-3">
                    <span className="text-gray-500 truncate flex-1">{orig}</span>
                    <ArrowRight size={12} className="text-gray-400 shrink-0" />
                    <span className={`truncate flex-1 font-semibold ${item.changed ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                      {item.proposed_name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-[#2a2a3a] bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={13} />
            <span>Undo Last Rename</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a2a3a] text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || previews.filter((p) => p.changed).length === 0}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-medium shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
            >
              {isApplying ? 'Renaming...' : 'Apply Rename'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchRenameModal;
