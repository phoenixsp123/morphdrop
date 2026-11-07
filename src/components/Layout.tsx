import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import type { View } from '../App';

interface LayoutProps {
  children: ReactNode;
  currentView: View;
  onNavigate: (view: View) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Layout({ children, currentView, onNavigate, theme, onToggleTheme }: LayoutProps) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-100/90 dark:bg-[#0c0c12] text-gray-900 dark:text-gray-100 transition-colors">
      {/* Liquid Glass Ambient Mesh Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
        {/* Violet / Indigo Top-Left Orb */}
        <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-transparent blur-[110px] dark:from-indigo-600/20 dark:via-purple-700/15 dark:to-transparent animate-orb-1" />
        
        {/* Cyan / Blue Right Orb */}
        <div className="absolute top-1/4 -right-28 w-[28rem] h-[28rem] rounded-full bg-gradient-to-bl from-cyan-400/20 via-sky-500/15 to-transparent blur-[120px] dark:from-cyan-500/15 dark:via-blue-600/10 dark:to-transparent animate-orb-2" />
        
        {/* Pink / Violet Bottom Center Orb */}
        <div className="absolute -bottom-36 left-1/3 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-pink-500/15 via-violet-600/15 to-transparent blur-[130px] dark:from-pink-600/10 dark:via-violet-800/10 dark:to-transparent animate-orb-3" />
      </div>

      <Sidebar
        currentView={currentView}
        onNavigate={onNavigate}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      
      <main className="relative flex-1 flex flex-col overflow-hidden z-10 backdrop-blur-sm">
        {children}
      </main>
    </div>
  );
}
