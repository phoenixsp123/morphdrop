import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTheme } from './hooks/useTheme';
import { useFileDetection } from './hooks/useFileDetection';
import { useConversion } from './hooks/useConversion';
import Layout from './components/Layout';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import FormatSelector from './components/FormatSelector';
import ConversionSettings from './components/ConversionSettings';
import ConversionProgress from './components/ConversionProgress';
import ConversionComplete from './components/ConversionComplete';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import SmartActions from './components/SmartActions';
import SmartDropWindow from './components/SmartDropWindow';
import BatchRenameModal from './components/BatchRenameModal';
import PdfToolsModal from './components/PdfToolsModal';
import { toggleSmartDropWindow } from './lib/tauri';
import { Edit3, FileStack, Sparkles } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { FileInfo, OutputFormat, ConversionSettings as ConversionSettingsType } from './types';

export type View = 'home' | 'converting' | 'complete' | 'history' | 'settings';

export default function App() {
  const [isSmartDropWindow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).get('window') === 'smartdrop') {
      return true;
    }
    try {
      return getCurrentWebviewWindow().label === 'smartdrop';
    } catch {
      return false;
    }
  });

  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>('home');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat | null>(null);
  const [settings, setSettings] = useState<ConversionSettingsType>({
    image_quality: null,
    image_width: null,
    image_height: null,
    preserve_aspect_ratio: true,
    preserve_metadata: false,
    compression_level: null,
    pdf_pages: null,
  });

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isPdfToolsOpen, setIsPdfToolsOpen] = useState(false);

  const { detectFiles, compatibleFormats, getFormats } = useFileDetection();
  const { jobId, progress, status, outputFiles, error, startConversion, cancelConversion, reset } = useConversion();

  // Handle files dropped via Tauri DnD
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
      if (event.payload.paths && event.payload.paths.length > 0) {
        const detected = await detectFiles(event.payload.paths);
        if (detected.length > 0) {
          setFiles(prev => [...prev, ...detected]);
          setView('home');
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [detectFiles]);

  // Get compatible formats when files change
  useEffect(() => {
    if (files.length > 0) {
      getFormats(files);
    }
  }, [files, getFormats]);

  // Watch conversion status
  useEffect(() => {
    if (status === 'Completed') {
      setView('complete');
    }
  }, [status]);

  const handleFilesDetected = useCallback(async (paths: string[]) => {
    const detected = await detectFiles(paths);
    if (detected.length > 0) {
      setFiles(prev => [...prev, ...detected]);
    }
  }, [detectFiles]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setSelectedFormat(null);
  }, []);

  const handleStartConversion = useCallback(async (outputDir: string) => {
    if (!selectedFormat || files.length === 0) return;
    const paths = files.map(f => f.path);
    setView('converting');
    await startConversion(paths, selectedFormat, outputDir, settings);
  }, [selectedFormat, files, settings, startConversion]);

  const handleConvertMore = useCallback(() => {
    setFiles([]);
    setSelectedFormat(null);
    reset();
    setView('home');
  }, [reset]);

  const handleCancelConversion = useCallback(async () => {
    try {
      await cancelConversion();
    } catch (e) {
      console.error('Cancel conversion error:', e);
    }
    reset();
    setView('home');
  }, [cancelConversion, reset]);

  const handleRenamed = useCallback(async (newPaths: string[]) => {
    if (newPaths.length > 0) {
      const refreshed = await detectFiles(newPaths);
      setFiles(refreshed);
    }
  }, [detectFiles]);

  // If this window is the floating SmartDrop HUD
  if (isSmartDropWindow) {
    return <SmartDropWindow />;
  }

  const renderContent = () => {
    switch (view) {
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
      case 'converting':
        return (
          <ConversionProgress
            progress={progress}
            status={status}
            error={error}
            currentFile={files.length > 0 ? files[0].filename : ''}
            totalFiles={files.length}
            onCancel={handleCancelConversion}
            jobId={jobId}
          />
        );
      case 'complete':
        return (
          <ConversionComplete
            outputFiles={outputFiles}
            inputCount={files.length}
            format={selectedFormat}
            onConvertMore={handleConvertMore}
            onViewHistory={() => setView('history')}
          />
        );
      default:
        return (
          <div className="flex flex-col h-full">
            {files.length === 0 ? (
              <div className="flex-1 flex flex-col">
                <div data-tauri-drag-region className="h-7 w-full cursor-move shrink-0" />
                <DropZone onFilesDetected={handleFilesDetected} />
                <SmartActions onFilesDetected={handleFilesDetected} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4 p-6 pt-7 overflow-y-auto animate-fade-in">
                {/* Secondary Action Toolbar */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRenameOpen(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-300 hover:border-indigo-400/50 hover:bg-white/80 dark:hover:bg-white/[0.08] hover:text-indigo-600 dark:hover:text-indigo-300 transition-all flex items-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-xl cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Batch Rename</span>
                    </button>

                    <button
                      onClick={() => setIsPdfToolsOpen(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-300 hover:border-indigo-400/50 hover:bg-white/80 dark:hover:bg-white/[0.08] hover:text-indigo-600 dark:hover:text-indigo-300 transition-all flex items-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-xl cursor-pointer"
                    >
                      <FileStack size={13} />
                      <span>PDF Tools</span>
                    </button>
                  </div>

                  <button
                    onClick={() => toggleSmartDropWindow()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/20 hover:border-indigo-400/40 transition-all flex items-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] backdrop-blur-xl cursor-pointer"
                    title="Toggle Floating SmartDrop HUD"
                  >
                    <Sparkles size={13} />
                    <span>SmartDrop HUD</span>
                  </button>
                </div>

                <FileList
                  files={files}
                  onRemoveFile={handleRemoveFile}
                  onClearAll={handleClearFiles}
                  onAddMore={handleFilesDetected}
                />
                <FormatSelector
                  formats={compatibleFormats}
                  selected={selectedFormat}
                  onSelect={setSelectedFormat}
                />
                {selectedFormat && (
                  <ConversionSettings
                    format={selectedFormat}
                    settings={settings}
                    onSettingsChange={setSettings}
                    onStartConversion={handleStartConversion}
                    fileCount={files.length}
                  />
                )}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Layout
      currentView={view}
      onNavigate={setView}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {renderContent()}

      {/* Modals */}
      <BatchRenameModal
        files={files}
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        onRenamed={handleRenamed}
      />

      <PdfToolsModal
        files={files}
        isOpen={isPdfToolsOpen}
        onClose={() => setIsPdfToolsOpen(false)}
        onSuccess={() => {
          setView('history');
        }}
      />
    </Layout>
  );
}
