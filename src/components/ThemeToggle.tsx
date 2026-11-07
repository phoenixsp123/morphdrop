import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import type { ThemePreference } from "../types";

export interface ThemeToggleProps {
  preference?: ThemePreference;
  onSetPreference?: (pref: ThemePreference) => void;
  theme?: "light" | "dark";
  onToggle?: () => void;
}

const options: { value: ThemePreference; icon: React.ReactNode; label: string }[] = [
  { value: "light", icon: <Sun className="w-3.5 h-3.5" />, label: "Light" },
  { value: "system", icon: <Monitor className="w-3.5 h-3.5" />, label: "System" },
  { value: "dark", icon: <Moon className="w-3.5 h-3.5" />, label: "Dark" },
];

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  preference,
  onSetPreference,
  theme,
  onToggle,
}) => {
  // If simple toggle callback provided
  if (onToggle && theme) {
    return (
      <button
        onClick={onToggle}
        className="p-1.5 rounded-xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.05] text-gray-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-md transition-all active:scale-95"
        title="Toggle dark/light mode"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    );
  }

  // Tri-state switcher
  const currentPref = preference || "system";
  return (
    <div className="flex items-center rounded-xl bg-white/40 dark:bg-white/[0.04] border border-white/50 dark:border-white/10 p-0.5 gap-0.5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      {options.map((opt) => {
        const isActive = currentPref === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSetPreference?.(opt.value)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              transition-all duration-200 cursor-pointer
              ${
                isActive
                  ? "bg-white dark:bg-white/15 text-indigo-600 dark:text-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/70 dark:border-white/20 font-semibold"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-white/40 dark:hover:bg-white/5 border border-transparent"
              }
            `}
            aria-label={`Set theme to ${opt.label}`}
            aria-pressed={isActive}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
