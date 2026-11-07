import { Sparkles, FileArchive, Minimize2, FileCheck2, FileStack } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

interface SmartActionsProps {
  onFilesDetected: (paths: string[]) => void;
}

export default function SmartActions({ onFilesDetected }: SmartActionsProps) {
  const handleActionClick = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: 'Select files for Smart Action',
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          onFilesDetected(paths);
        }
      }
    } catch (err) {
      console.error('Smart action open error:', err);
    }
  };

  const actions = [
    {
      title: 'Make Smaller',
      desc: 'Compress images or docs using optimized quality presets',
      icon: Minimize2,
      badge: 'Optimized',
      color: 'from-amber-500/20 to-orange-500/20 text-amber-500',
    },
    {
      title: 'Make Compatible',
      desc: 'Convert WebP, AVIF, or raw formats into standard JPEG or PNG',
      icon: FileCheck2,
      badge: 'Universal',
      color: 'from-blue-500/20 to-indigo-500/20 text-blue-500',
    },
    {
      title: 'Combine into PDF',
      desc: 'Merge multiple images or PDFs into a single polished document',
      icon: FileStack,
      badge: 'Merge',
      color: 'from-purple-500/20 to-pink-500/20 text-purple-500',
    },
    {
      title: 'Package as ZIP',
      desc: 'Bundle multiple files into an encrypted, safe ZIP archive',
      icon: FileArchive,
      badge: 'Archive',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-500',
    },
  ];

  return (
    <div className="px-8 pb-8 max-w-4xl mx-auto w-full z-10">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-indigo-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          Smart Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.title}
              onClick={handleActionClick}
              className="group relative p-4 rounded-2xl border border-white/50 dark:border-white/10 bg-white/45 dark:bg-white/[0.035] backdrop-blur-2xl text-left hover:bg-white/70 dark:hover:bg-white/[0.07] hover:border-indigo-400/50 hover:scale-[1.02] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_10px_25px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),0_15px_30px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),0_20px_40px_rgba(99,102,241,0.15)] transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${act.color} border border-white/40 dark:border-white/10 flex items-center justify-center shadow-sm`}>
                    <Icon size={15} />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10 border border-white/50 dark:border-white/10 text-gray-600 dark:text-zinc-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                    {act.badge}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-gray-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {act.title}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {act.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
