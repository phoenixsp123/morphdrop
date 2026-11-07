import React, { useState } from 'react';
import { X, FileStack, AlertCircle } from 'lucide-react';
import { imagesToPdf, mergePdfs, splitPdf } from '../lib/tauri';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { FileInfo } from '../types';

interface PdfToolsModalProps {
  files: FileInfo[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (outputPath: string) => void;
}

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({
  files,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'combine' | 'merge' | 'split'>('combine');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCombineImages = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const targetPath = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: 'combined_images.pdf',
      });
      if (!targetPath) {
        setIsProcessing(false);
        return;
      }

      const paths = files.map((f) => f.path);
      const res = await imagesToPdf(paths, targetPath);
      onSuccess(res);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergePdfs = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const targetPath = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: 'merged_documents.pdf',
      });
      if (!targetPath) {
        setIsProcessing(false);
        return;
      }

      const paths = files.map((f) => f.path);
      const res = await mergePdfs(paths, targetPath);
      onSuccess(res);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSplitPdf = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const targetDir = await open({
        directory: true,
        title: 'Choose output directory for split pages',
      });
      if (!targetDir || typeof targetDir !== 'string') {
        setIsProcessing(false);
        return;
      }

      const res = await splitPdf(files[0].path, targetDir);
      if (res.length > 0) {
        onSuccess(res[0]);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-[#13131c]/80 backdrop-blur-3xl shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_30px_70px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-[#2a2a3a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-500">
              <FileStack size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                PDF Tools &amp; Operations
              </h3>
              <p className="text-xs text-gray-400">
                {files.length} {files.length === 1 ? 'file' : 'files'} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex p-2 gap-1 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('combine')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'combine'
                ? 'bg-white dark:bg-[#141419] text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Images to PDF
          </button>
          <button
            onClick={() => setActiveTab('merge')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'merge'
                ? 'bg-white dark:bg-[#141419] text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Merge PDFs
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'split'
                ? 'bg-white dark:bg-[#141419] text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Split PDF
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'combine' && (
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-gray-300">
                Combine all {files.length} selected images in sequential order into a single multi-page PDF document.
              </p>
              <button
                onClick={handleCombineImages}
                disabled={isProcessing || files.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                {isProcessing ? 'Combining Images...' : 'Save as Combined PDF...'}
              </button>
            </div>
          )}

          {activeTab === 'merge' && (
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-gray-300">
                Concatenate multiple existing PDF files into a single unified document with preserved bookmarks and pages.
              </p>
              <button
                onClick={handleMergePdfs}
                disabled={isProcessing || files.length < 2}
                className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                {isProcessing ? 'Merging PDFs...' : 'Merge Selected PDFs...'}
              </button>
              {files.length < 2 && (
                <p className="text-[11px] text-amber-500">
                  Select at least 2 PDF files to use the merge tool.
                </p>
              )}
            </div>
          )}

          {activeTab === 'split' && (
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-gray-300">
                Extract every page from the first PDF into individual single-page documents inside a chosen directory.
              </p>
              <button
                onClick={handleSplitPdf}
                disabled={isProcessing || files.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                {isProcessing ? 'Splitting Pages...' : 'Choose Output Folder & Split PDF...'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfToolsModal;
