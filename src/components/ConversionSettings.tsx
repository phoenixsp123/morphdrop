import { useState } from 'react';
import { FolderOpen, ArrowRight } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import type { OutputFormat, ConversionSettings as SettingsType } from '../types';

interface ConversionSettingsProps {
  format: OutputFormat;
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
  onStartConversion: (outputDir: string) => void;
  fileCount: number;
}

const imageFormats: OutputFormat[] = ['Png', 'Jpeg', 'Webp', 'Bmp', 'Tiff', 'Gif', 'Ico', 'Avif'];

export default function ConversionSettings({
  format,
  settings,
  onSettingsChange,
  onStartConversion,
  fileCount,
}: ConversionSettingsProps) {
  const [outputDir, setOutputDir] = useState('');
  const isImage = imageFormats.includes(format);
  const isLossy = format === 'Jpeg' || format === 'Webp' || format === 'Avif';

  const handleChooseFolder = async () => {
    try {
      const dir = await open({ directory: true, title: 'Choose output folder' });
      if (dir) setOutputDir(dir as string);
    } catch (e) {
      console.error('Folder dialog error:', e);
    }
  };

  const handleStart = () => {
    const dir = outputDir || '~/Desktop';
    onStartConversion(dir);
  };

  return (
    <div className="animate-slide-up rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_20px_45px_rgba(0,0,0,0.4)] p-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mb-4">
        Conversion Settings
      </h3>

      <div className="space-y-4">
        {/* Quality slider (lossy formats) */}
        {isImage && isLossy && (
          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-gray-600 dark:text-zinc-400">Quality Preset</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                {settings.image_quality ?? 90}%
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={settings.image_quality ?? 90}
              onChange={(e) =>
                onSettingsChange({ ...settings, image_quality: parseInt(e.target.value) })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        )}

        {/* Resize */}
        {isImage && (
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5 block">
              Resize Dimensions (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Width"
                value={settings.image_width ?? ''}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    image_width: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-28 px-3 py-2 text-xs rounded-xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] focus:outline-none focus:border-indigo-500"
              />
              <span className="text-gray-400 text-xs">×</span>
              <input
                type="number"
                placeholder="Height"
                value={settings.image_height ?? ''}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    image_height: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-28 px-3 py-2 text-xs rounded-xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] focus:outline-none focus:border-indigo-500"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400 ml-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.preserve_aspect_ratio}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      preserve_aspect_ratio: e.target.checked,
                    })
                  }
                  className="rounded accent-indigo-500 cursor-pointer"
                />
                <span>Keep aspect ratio</span>
              </label>
            </div>
          </div>
        )}

        {/* Compression level */}
        {format === 'Zip' && (
          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-gray-600 dark:text-zinc-400">Compression Level</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {settings.compression_level ?? 6}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="9"
              value={settings.compression_level ?? 6}
              onChange={(e) =>
                onSettingsChange({ ...settings, compression_level: parseInt(e.target.value) })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        )}

        {/* Output folder */}
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5 block">
            Output Destination
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleChooseFolder}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/60 dark:border-white/10
                bg-white/60 dark:bg-white/[0.05] text-xs text-gray-700 dark:text-zinc-300
                hover:bg-white/80 dark:hover:bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all flex-1 text-left cursor-pointer"
            >
              <FolderOpen size={15} className="text-indigo-500 shrink-0" />
              <span className="truncate">
                {outputDir || 'Choose folder (defaults to Desktop)'}
              </span>
            </button>
          </div>
        </div>

        {/* Convert button */}
        <button
          onClick={handleStart}
          className="w-full mt-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500
            hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-xs tracking-wide uppercase
            shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.5),0_10px_25px_rgba(99,102,241,0.35)]
            hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_15px_35px_rgba(99,102,241,0.45)]
            border border-white/30 active:scale-[0.99] transition-all duration-200
            flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>
            Convert {fileCount} {fileCount === 1 ? 'file' : 'files'} to {format}
          </span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
