import React, { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  openInFolder,
  createArchive,
  detectFiles,
  startConversion,
  mergePdfs,
  imagesToPdf,
  hideSmartDropWindow,
  getSmartDropShortcut,
} from '../lib/tauri';
import { formatFileSize, truncateFilename } from '../lib/fileUtils';
import {
  X,
  Minimize2,
  Folder,
  FileArchive,
  CheckCircle2,
  ArrowRight,
  Upload,
  Plus,
  FileStack,
  FileText,
  Loader2,
} from 'lucide-react';
import type { FileInfo } from '../types';

export const SmartDropWindow: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState('⌘⇧Space');

  const appWindow = getCurrentWebviewWindow();

  const handleDismiss = useCallback(async () => {
    try {
      await hideSmartDropWindow();
    } catch {
      try {
        await appWindow.hide();
      } catch (err) {
        console.error('Failed to hide SmartDrop window:', err);
      }
    }
  }, [appWindow]);

  // Load active shortcut
  useEffect(() => {
    getSmartDropShortcut()
      .then((sc) => {
        if (sc) {
          const display = sc
            .replace(/Command|Cmd|Super/gi, '⌘')
            .replace(/Shift/gi, '⇧')
            .replace(/Option|Alt/gi, '⌥')
            .replace(/Control|Ctrl/gi, '⌃')
            .replace(/\+/g, '');
          setShortcutLabel(display);
        }
      })
      .catch((e) => console.error('Failed to load shortcut:', e));
  }, []);

  // Close or hide window on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  // Listen to file drop events on this window
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
      setIsDragOver(false);
      if (event.payload.paths && event.payload.paths.length > 0) {
        try {
          const detected = await detectFiles(event.payload.paths);
          setFiles((prev) => [...prev, ...detected]);
        } catch (err) {
          console.error('Detection error:', err);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleClear = () => {
    setFiles([]);
    setStatusMessage(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBrowseFiles = async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        title: 'Select files for SmartDrop',
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          const detected = await detectFiles(paths);
          setFiles((prev) => [...prev, ...detected]);
        }
      }
    } catch (err) {
      console.error('File browse error:', err);
    }
  };

  // Smart Action: Package as ZIP
  const handleZipFiles = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage('Creating ZIP archive...');
    try {
      const firstParent = files[0].path.substring(0, files[0].path.lastIndexOf('/'));
      const outZip = `${firstParent}/Archive_${Date.now()}.zip`;
      const paths = files.map((f) => f.path);
      const res = await createArchive(paths, outZip);
      const filename = res.split('/').pop() || 'Archive.zip';
      setStatusMessage(`Saved: ${filename}`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage(`Error: ${err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  // Smart Action: Make Smaller (JPEG 75% for images)
  const handleMakeSmaller = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage('Optimizing & compressing...');
    try {
      const firstParent = files[0].path.substring(0, files[0].path.lastIndexOf('/'));
      const paths = files.map((f) => f.path);
      await startConversion(paths, 'Jpeg', firstParent, {
        image_quality: 75,
        image_width: null,
        image_height: null,
        preserve_aspect_ratio: true,
        preserve_metadata: false,
        compression_level: null,
        pdf_pages: null,
      });
      setStatusMessage('Optimized files saved!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage(`Error: ${err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  // Smart Action: Combine into PDF
  const handleCombinePdf = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage('Combining into PDF...');
    try {
      const firstParent = files[0].path.substring(0, files[0].path.lastIndexOf('/'));
      const outPdf = `${firstParent}/Combined_${Date.now()}.pdf`;
      const paths = files.map((f) => f.path);

      const allPdfs = files.every((f) => f.extension.toLowerCase() === 'pdf');
      if (allPdfs) {
        await mergePdfs(paths, outPdf);
      } else {
        await imagesToPdf(paths, outPdf);
      }
      setStatusMessage('Created Combined PDF!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage(`Error: ${err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  // Smart Action: Convert to PDF (for DOCX)
  const handleConvertToPdf = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage('Converting to PDF...');
    try {
      const firstParent = files[0].path.substring(0, files[0].path.lastIndexOf('/'));
      const paths = files.map((f) => f.path);
      await startConversion(paths, 'Pdf', firstParent, {
        image_quality: null,
        image_width: null,
        image_height: null,
        preserve_aspect_ratio: true,
        preserve_metadata: false,
        compression_level: null,
        pdf_pages: null,
      });
      setStatusMessage('Converted to PDF!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage(`Error: ${err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  // Smart Action: Convert to DOCX (for PDF)
  const handleConvertToDocx = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage('Converting to DOCX...');
    try {
      const firstParent = files[0].path.substring(0, files[0].path.lastIndexOf('/'));
      const paths = files.map((f) => f.path);
      await startConversion(paths, 'Docx', firstParent, {
        image_quality: null,
        image_width: null,
        image_height: null,
        preserve_aspect_ratio: true,
        preserve_metadata: false,
        compression_level: null,
        pdf_pages: null,
      });
      setStatusMessage('Converted to DOCX!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage(`Error: ${err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  // Smart Action: Reveal in Finder / Explorer
  const handleReveal = async () => {
    if (files.length > 0) {
      await openInFolder(files[0].path);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size_bytes, 0);
  const hasImages = files.some((f) =>
    ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif', 'avif'].includes(f.extension.toLowerCase()),
  );
  const hasPdfs = files.some((f) => f.extension.toLowerCase() === 'pdf');
  const hasDocx = files.some((f) =>
    ['docx', 'doc', 'odt', 'rtf'].includes(f.extension.toLowerCase()),
  );

  return (
    <div className="relative h-screen w-screen p-2 select-none flex flex-col justify-center items-center bg-transparent font-sans overflow-hidden">
      {/* Ambient Liquid Orbs behind the Glass Panel */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-gradient-to-br from-indigo-500/30 via-violet-500/25 to-transparent blur-3xl animate-orb-1" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-gradient-to-tl from-cyan-400/25 via-blue-500/20 to-transparent blur-3xl animate-orb-2" />
      </div>

      <div className="relative w-full h-full rounded-[28px] bg-white/75 dark:bg-[#12121c]/75 backdrop-blur-[48px] saturate-[210%] brightness-[104%] border border-white/60 dark:border-white/15 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_25px_60px_rgba(0,0,0,0.4)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.18),0_30px_70px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden text-gray-900 dark:text-zinc-100 transition-colors animate-slide-up z-10">
        {/* Header / Drag Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/[0.02]">
          {/* Draggable Title Area */}
          <div data-tauri-drag-region className="flex items-center gap-2 flex-1 h-full cursor-move py-0.5">
            <div className="w-5 h-5 rounded-lg overflow-hidden shadow-sm shadow-indigo-500/30 border border-white/35 shrink-0 pointer-events-none">
              <img src="/logo.png" alt="SmartDrop" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-bold tracking-tight text-gray-900 dark:text-zinc-100 pointer-events-none">
              SmartDrop
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-white/10 text-gray-600 dark:text-zinc-400 border border-white/50 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] pointer-events-none">
              {shortcutLabel}
            </span>
          </div>

          {/* Action Buttons (isolated from drag region) */}
          <div className="flex items-center gap-1.5 relative z-20">
            {files.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-[11px] font-semibold text-gray-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 px-2 py-0.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/60 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-white/40 cursor-pointer"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Status / Feedback Banner */}
        {statusMessage && (
          <div className="px-3.5 py-1.5 bg-indigo-500/15 border-b border-indigo-500/20 text-xs font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-2 backdrop-blur-md animate-fade-in">
            {isProcessing ? (
              <Loader2 size={12} className="animate-spin text-indigo-500" />
            ) : (
              <CheckCircle2 size={12} className="text-indigo-500" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 p-3 flex flex-col overflow-hidden">
          {files.length === 0 ? (
            /* Sleek Empty State Drop Zone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={handleBrowseFiles}
              className={`flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all duration-300 backdrop-blur-xl ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-500/15 dark:bg-indigo-500/20 scale-[0.99] shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)]'
                  : 'border-white/60 dark:border-white/15 bg-white/40 dark:bg-white/[0.02] hover:border-indigo-400/60 hover:bg-white/60 dark:hover:bg-white/[0.05] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.06)]'
              }`}
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-white/60 dark:border-white/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_6px_16px_rgba(99,102,241,0.15)]">
                <Upload size={19} />
              </div>
              <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 mb-0.5">
                Drop files from Finder or Explorer
              </p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 mb-2 font-medium">
                or click here to choose files
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 dark:text-zinc-400 px-2.5 py-0.5 rounded-full bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                <span>Images</span>
                <span>•</span>
                <span>PDFs</span>
                <span>•</span>
                <span>Docs</span>
                <span>•</span>
                <span>Archives</span>
              </div>
            </div>
          ) : (
            /* Selected Files State */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Summary Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/40 dark:border-white/10">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[11px] border border-indigo-400/25 shadow-sm">
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-mono">
                    ({formatFileSize(totalSize)})
                  </span>
                </div>
                <button
                  onClick={handleBrowseFiles}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Plus size={11} />
                  <span>Add more</span>
                </button>
              </div>

              {/* Scrollable File Items */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-36">
                {files.map((f, i) => (
                  <div
                    key={f.path + i}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/10 text-xs group hover:bg-white/70 dark:hover:bg-white/[0.07] hover:border-indigo-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-white/80 dark:bg-zinc-700/80 text-gray-700 dark:text-zinc-200 border border-white/40 dark:border-white/10 shrink-0">
                        {f.extension}
                      </span>
                      <span
                        className="truncate text-gray-800 dark:text-zinc-200 text-xs font-semibold"
                        title={f.path}
                      >
                        {truncateFilename(f.filename, 24)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-400 dark:text-zinc-400 font-mono">
                        {formatFileSize(f.size_bytes)}
                      </span>
                      <button
                        onClick={() => handleRemoveFile(i)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 p-0.5 rounded transition-all cursor-pointer"
                        title="Remove file"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 mt-auto">
                {/* Action 1: Make Smaller */}
                <button
                  onClick={handleMakeSmaller}
                  disabled={isProcessing}
                  className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-amber-500/15 border border-white/60 dark:border-white/10 hover:border-amber-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] disabled:opacity-50"
                >
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <Minimize2 size={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                      Make Smaller
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                      Compress &amp; optimize
                    </p>
                  </div>
                </button>

                {/* Action 2: Bundle ZIP */}
                <button
                  onClick={handleZipFiles}
                  disabled={isProcessing}
                  className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-emerald-500/15 border border-white/60 dark:border-white/10 hover:border-emerald-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] disabled:opacity-50"
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <FileArchive size={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                      Package ZIP
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                      Create archive
                    </p>
                  </div>
                </button>

                {/* Action 3: Contextual Document / PDF Action */}
                {hasDocx ? (
                  <button
                    onClick={handleConvertToPdf}
                    disabled={isProcessing}
                    className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-rose-500/15 border border-white/60 dark:border-white/10 hover:border-rose-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] disabled:opacity-50"
                  >
                    <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                      <FileText size={12} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                        DOCX → PDF
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        Export as PDF
                      </p>
                    </div>
                  </button>
                ) : hasPdfs ? (
                  <button
                    onClick={handleConvertToDocx}
                    disabled={isProcessing}
                    className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-blue-500/15 border border-white/60 dark:border-white/10 hover:border-blue-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] disabled:opacity-50"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <FileText size={12} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                        PDF → DOCX
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        Export as Word doc
                      </p>
                    </div>
                  </button>
                ) : hasImages ? (
                  <button
                    onClick={handleCombinePdf}
                    disabled={isProcessing}
                    className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-purple-500/15 border border-white/60 dark:border-white/10 hover:border-purple-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] disabled:opacity-50"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                      <FileStack size={12} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                        Combine PDF
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        Images into PDF
                      </p>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={handleReveal}
                    className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-blue-500/15 border border-white/60 dark:border-white/10 hover:border-blue-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <Folder size={12} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                        Reveal
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        Show in folder
                      </p>
                    </div>
                  </button>
                )}

                {/* Action 4: Reveal Folder */}
                <button
                  onClick={handleReveal}
                  className="p-2 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-blue-500/15 border border-white/60 dark:border-white/10 hover:border-blue-500/30 text-left transition-all flex items-center gap-2 group cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <Folder size={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 leading-tight">
                      Reveal Folder
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                      Open location
                    </p>
                  </div>
                </button>
              </div>

              {/* Bottom Done Button */}
              <div className="pt-2">
                <button
                  onClick={() => appWindow.hide()}
                  className="w-full py-2 px-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.5),0_8px_20px_rgba(99,102,241,0.35)] border border-white/30 transition-all cursor-pointer active:scale-95"
                >
                  <span>Done</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartDropWindow;
