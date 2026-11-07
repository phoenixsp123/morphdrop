import { Home, Clock, Settings } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import type { View } from '../App';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const navItems: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Convert', icon: Home },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ currentView, onNavigate, theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="w-[215px] flex-shrink-0 border-r border-white/40 dark:border-white/[0.08] bg-white/45 dark:bg-[#11111a]/55 backdrop-blur-[40px] flex flex-col z-20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),4px_0_30px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.1),4px_0_35px_rgba(0,0,0,0.5)]">
      {/* Titlebar Drag Region / Logo */}
      <div data-tauri-drag-region className="px-5 pt-7 pb-5 flex items-center gap-3 cursor-move">
        <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/25 border border-white/40 dark:border-white/20 shrink-0">
          <img src="/logo.png" alt="MorphDrop Logo" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xs font-bold tracking-tight text-gray-900 dark:text-zinc-100 truncate">
            MorphDrop
          </h1>
          <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-medium truncate">
            Universal Converter
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = currentView === id || (id === 'home' && (currentView === 'converting' || currentView === 'complete'));
            return (
              <li key={id}>
                <button
                  onClick={() => onNavigate(id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer
                    ${active
                      ? 'bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 dark:border-indigo-400/25 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.7),0_2px_10px_rgba(99,102,241,0.15)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.14),0_2px_12px_rgba(99,102,241,0.25)]'
                      : 'border-transparent text-gray-600 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-white/[0.05] hover:border-white/50 dark:hover:border-white/10 hover:text-gray-900 dark:hover:text-zinc-100'
                    }`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3.5 border-t border-white/40 dark:border-white/[0.08] flex items-center justify-between bg-white/25 dark:bg-white/[0.015]">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">v0.1.0</span>
      </div>
    </aside>
  );
}
