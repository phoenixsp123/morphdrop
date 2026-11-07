import { getFormatInfo } from '../lib/formatUtils';
import type { OutputFormat } from '../types';

interface FormatSelectorProps {
  formats: OutputFormat[];
  selected: OutputFormat | null;
  onSelect: (format: OutputFormat) => void;
}

const formatCategories: { label: string; formats: OutputFormat[] }[] = [
  { label: 'Images', formats: ['Png', 'Jpeg', 'Webp', 'Bmp', 'Tiff', 'Gif', 'Ico', 'Avif'] },
  { label: 'Documents', formats: ['Pdf', 'Txt'] },
  { label: 'Archives', formats: ['Zip'] },
  { label: 'Data', formats: ['Json', 'Csv', 'Tsv', 'Yaml', 'Xml'] },
];

export default function FormatSelector({ formats, selected, onSelect }: FormatSelectorProps) {
  if (formats.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400 dark:text-gray-500 animate-fade-in">
        <p className="text-sm">No compatible output formats found for the selected files.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Convert to
      </h3>
      <div className="space-y-4">
        {formatCategories.map(({ label, formats: categoryFormats }) => {
          const available = categoryFormats.filter(f => formats.includes(f));
          if (available.length === 0) return null;

          return (
            <div key={label}>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">
                {label}
              </p>
              <div className="flex flex-wrap gap-2">
                {available.map(format => {
                  const info = getFormatInfo(format);
                  const isSelected = selected === format;
                  return (
                    <button
                      key={format}
                      onClick={() => onSelect(format)}
                      className={`
                        px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                        flex items-center gap-2 border backdrop-blur-2xl cursor-pointer
                        ${isSelected
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-white/40 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.6),0_8px_20px_rgba(99,102,241,0.35)] scale-[1.02]'
                          : 'bg-white/50 dark:bg-white/[0.04] border-white/60 dark:border-white/10 text-gray-700 dark:text-zinc-200 hover:border-indigo-400/50 hover:bg-white/70 dark:hover:bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
                        }
                      `}
                    >
                      <span className={`w-2 h-2 rounded-full ${info.color}`} />
                      <span>{info.label}</span>
                      <span className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                        .{info.extension}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
