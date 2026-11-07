import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Folder,
  Trash2,
  Cpu,
  ShieldCheck,
  Palette,
  Layers,
  Check,
  ExternalLink,
  Terminal,
  RefreshCw,
  Sparkles,
  Keyboard,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import {
  clearHistory,
  probeExternalDependencies,
  toggleSmartDropWindow,
  getSmartDropShortcut,
  setSmartDropShortcut,
} from '../lib/tauri';
import type { DependencyStatus } from '../types';

export default function SettingsView() {
  const { settings, updateSettings } = useSettings();
  const { preference, setPreference } = useTheme();
  const [clearedNotice, setClearedNotice] = useState(false);
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [isProbing, setIsProbing] = useState(false);

  // SmartDrop shortcut state
  const [shortcut, setShortcut] = useState('Command+Shift+Space');
  const [isRecording, setIsRecording] = useState(false);
  const [shortcutStatus, setShortcutStatus] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || navigator.platform);

  useEffect(() => {
    getSmartDropShortcut()
      .then((sc) => {
        if (sc) setShortcut(sc);
      })
      .catch((e) => console.error('Failed to load shortcut:', e));
  }, []);

  const handleSaveShortcut = useCallback(async (newSc: string) => {
    setShortcutStatus(null);
    setShortcutError(null);
    try {
      const saved = await setSmartDropShortcut(newSc);
      setShortcut(saved);
      setShortcutStatus('Shortcut updated successfully!');
      setTimeout(() => setShortcutStatus(null), 3000);
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : (err as Error)?.message || 'Failed to register shortcut';
      setShortcutError(msg);
      setTimeout(() => setShortcutError(null), 4000);
    }
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setIsRecording(false);
        return;
      }

      if (['Meta', 'Control', 'Alt', 'Shift', 'CapsLock'].includes(e.key)) {
        return;
      }

      const parts: string[] = [];
      if (e.metaKey) parts.push('Command');
      if (e.ctrlKey) parts.push('Control');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      if (parts.length === 0) {
        setShortcutError('Please include at least one modifier key (⌘, ⌥, ⇧ or Ctrl)');
        setTimeout(() => setShortcutError(null), 3500);
        setIsRecording(false);
        return;
      }

      let key = e.key;
      if (key === ' ') key = 'Space';
      else if (key.length === 1) key = key.toUpperCase();

      parts.push(key);
      const newShortcut = parts.join('+');

      setIsRecording(false);
      handleSaveShortcut(newShortcut);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecording, handleSaveShortcut]);

  const presets = isMac
    ? [
        { label: '⌘ ⇧ Space', value: 'Command+Shift+Space', desc: 'Default' },
        { label: '⌘ ⇧ D', value: 'Command+Shift+D', desc: 'Quick Drop' },
        { label: '⌘ ⇧ M', value: 'Command+Shift+M', desc: 'Morph' },
        { label: '⌥ Space', value: 'Alt+Space', desc: 'Spotlight style' },
      ]
    : [
        { label: 'Ctrl+Shift+Space', value: 'Control+Shift+Space', desc: 'Default' },
        { label: 'Ctrl+Shift+D', value: 'Control+Shift+D', desc: 'Quick Drop' },
        { label: 'Ctrl+Shift+M', value: 'Control+Shift+M', desc: 'Morph' },
        { label: 'Alt+Space', value: 'Alt+Space', desc: 'Quick' },
      ];

  const formatKeyToken = (token: string) => {
    const t = token.trim();
    if (/^(command|cmd|super)$/i.test(t)) return isMac ? '⌘' : 'Win';
    if (/^shift$/i.test(t)) return isMac ? '⇧' : 'Shift';
    if (/^(alt|option)$/i.test(t)) return isMac ? '⌥' : 'Alt';
    if (/^(control|ctrl)$/i.test(t)) return isMac ? '⌃' : 'Ctrl';
    return t;
  };

  const checkDeps = async () => {
    setIsProbing(true);
    try {
      const deps = await probeExternalDependencies();
      setDependencies(deps);
    } catch (err) {
      console.error('Failed to probe dependencies:', err);
    } finally {
      setIsProbing(false);
    }
  };

  useEffect(() => {
    checkDeps();
  }, []);

  const handlePickFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Select default output directory',
      });
      if (selected && typeof selected === 'string') {
        updateSettings({ default_output_folder: selected });
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 2500);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-fade-in max-w-2xl mx-auto w-full">
      <div className="pb-4 border-b border-gray-200 dark:border-[#2a2a3a] mb-6">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Settings &amp; Engines
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Configure preferences, file safety behaviors, shortcuts, and conversion engines
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.3)] p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-800 dark:text-gray-200">
            <Palette size={16} className="text-indigo-500" />
            <span>Appearance &amp; Theme</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setPreference(t);
                  updateSettings({ theme: t });
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold capitalize transition-all duration-200 cursor-pointer ${
                  preference === t
                    ? 'border-indigo-400/50 bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_12px_rgba(99,102,241,0.15)]'
                    : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] text-gray-600 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-white/[0.06]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Floating Utility Shortcut */}
        <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.3)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                <Sparkles size={16} className="text-indigo-500" />
                <span>SmartDrop Floating Utility</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                Always-on-top quick drag &amp; drop utility window
              </p>
            </div>
            <button
              onClick={() => toggleSmartDropWindow()}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink size={13} />
              <span>Toggle Utility</span>
            </button>
          </div>

          {/* Current Shortcut & Recorder */}
          <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-[#14141d]/70 border border-white/60 dark:border-white/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Keyboard size={14} className="text-gray-400 dark:text-zinc-500" />
                <span>Global Hotkey Shortcut</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                Press anywhere across your desktop to summon SmartDrop
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Shortcut Badges */}
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100/80 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
                {shortcut.split('+').map((part, i) => (
                  <span key={i} className="flex items-center">
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-700 border border-gray-200/80 dark:border-zinc-600 font-mono text-[11px] font-bold text-gray-800 dark:text-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                      {formatKeyToken(part)}
                    </kbd>
                    {i < shortcut.split('+').length - 1 && (
                      <span className="text-gray-400 dark:text-zinc-500 text-[10px] mx-1 font-bold">+</span>
                    )}
                  </span>
                ))}
              </div>

              {/* Record Button */}
              <button
                type="button"
                onClick={() => {
                  setShortcutError(null);
                  setShortcutStatus(null);
                  setIsRecording(!isRecording);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/25'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                }`}
              >
                {isRecording ? (
                  <span>Press keys... (Esc to cancel)</span>
                ) : (
                  <>
                    <Keyboard size={13} />
                    <span>Change</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status / Error Alerts */}
          {shortcutStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs animate-fade-in">
              <Check size={13} />
              <span>{shortcutStatus}</span>
            </div>
          )}
          {shortcutError && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs animate-fade-in">
              <AlertCircle size={13} />
              <span>{shortcutError}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quick Presets
              </span>
              <button
                type="button"
                onClick={() => handleSaveShortcut(isMac ? 'Command+Shift+Space' : 'Control+Shift+Space')}
                className="text-[11px] text-gray-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Reset Default</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map((p) => {
                const isActive = shortcut.toLowerCase() === p.value.toLowerCase();
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleSaveShortcut(p.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'border-indigo-400/60 bg-indigo-500/15 dark:bg-indigo-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_12px_rgba(99,102,241,0.15)]'
                        : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] hover:bg-white/70 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold text-gray-800 dark:text-zinc-100 flex items-center justify-between">
                      {p.label}
                      {isActive && <Check size={12} className="text-indigo-600 dark:text-indigo-400" />}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Output & File Safety */}
        <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.3)] p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
            <ShieldCheck size={16} className="text-indigo-500" />
            <span>Output &amp; File Safety</span>
          </div>

          {/* Default Folder */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              Default Output Directory
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                placeholder="Defaults to source folder or Desktop"
                value={settings.default_output_folder || ''}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-800 dark:text-gray-200"
              />
              <button
                onClick={handlePickFolder}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a3a] flex items-center gap-1.5 transition-colors"
              >
                <Folder size={14} />
                <span>Choose</span>
              </button>
            </div>
          </div>

          {/* Preserve originals */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                Preserve Original Files
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Never delete, replace, or modify original files during conversion
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.preserve_originals}
              onChange={(e) => updateSettings({ preserve_originals: e.target.checked })}
              className="accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Collision handling */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                Filename Collision Behavior
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Action when an output file with identical name exists
              </p>
            </div>
            <select
              value={settings.filename_collision}
              onChange={(e) =>
                updateSettings({
                  filename_collision: e.target.value as 'rename' | 'overwrite' | 'ask',
                })
              }
              className="px-2.5 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="rename">Auto-rename (add _1, _2)</option>
              <option value="overwrite">Overwrite existing</option>
              <option value="ask">Ask every time</option>
            </select>
          </div>
        </section>

        {/* Quality & Performance */}
        <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.3)] p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
            <Cpu size={16} className="text-indigo-500" />
            <span>Conversion Performance &amp; Defaults</span>
          </div>

          {/* Quality slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Default Image Quality
              </span>
              <span className="font-semibold text-indigo-500">
                {settings.default_image_quality}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={settings.default_image_quality}
              onChange={(e) =>
                updateSettings({ default_image_quality: parseInt(e.target.value) })
              }
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Concurrency */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                Parallel Conversion Concurrency
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Number of files to convert simultaneously
              </p>
            </div>
            <input
              type="number"
              min="1"
              max="8"
              value={settings.conversion_concurrency}
              onChange={(e) =>
                updateSettings({ conversion_concurrency: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="w-16 px-2.5 py-1 text-xs rounded-lg bg-gray-50 dark:bg-[#141419] border border-gray-200 dark:border-[#2a2a3a] text-center"
            />
          </div>
        </section>

        {/* External Conversion Engines Health Check */}
        <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.3)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                <Terminal size={16} className="text-indigo-500" />
                <span>Conversion Engines &amp; CLI Dependencies</span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                Automatically discovered system tools for video, audio, office documents &amp; archives
              </p>
            </div>
            <button
              onClick={checkDeps}
              disabled={isProbing}
              title="Re-check system tools"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 border border-white/60 dark:border-white/10 text-gray-700 dark:text-zinc-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={12} className={isProbing ? 'animate-spin text-indigo-500' : ''} />
              <span>{isProbing ? 'Checking...' : 'Check Again'}</span>
            </button>
          </div>

          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Native built-in engines (Images, PDF, ZIP, Structured Data) run out of the box. Additional CLI media and document engines are discovered dynamically:
          </div>

          <div className="space-y-2.5 pt-1">
            {dependencies.map((dep) => (
              <div
                key={dep.name}
                className="p-3.5 rounded-2xl bg-white/50 dark:bg-[#141419]/80 border border-white/60 dark:border-white/5 shadow-sm flex flex-col gap-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {dep.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({dep.license})
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      dep.is_available
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {dep.is_available ? (
                      <>
                        <Check size={10} />
                        <span>Available</span>
                      </>
                    ) : (
                      'Optional (Not Found)'
                    )}
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {dep.required_for}
                </p>

                {dep.is_available && dep.version && (
                  <div className="mt-0.5 text-[10px] font-mono text-gray-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-2">
                    <span className="truncate max-w-[280px]">{dep.version}</span>
                    {dep.path && (
                      <span className="text-gray-400 dark:text-zinc-600 truncate max-w-[220px]">
                        • {dep.path}
                      </span>
                    )}
                  </div>
                )}

                {!dep.is_available && (
                  <div className="mt-1 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                    💡 Install hint: {dep.install_hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* History Management */}
        <section className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-3xl shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.3)] p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Clear All Conversion History
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Removes all logged records from the local SQLite database
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
          >
            {clearedNotice ? <Check size={14} className="text-green-500" /> : <Trash2 size={14} />}
            <span>{clearedNotice ? 'Cleared!' : 'Clear Database'}</span>
          </button>
        </section>

        {/* About */}
        <div className="text-center pt-2 pb-6 text-gray-400 dark:text-gray-600 text-xs space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400 font-medium">
            <Layers size={14} />
            <span>MorphDrop Universal File Converter v0.1.0</span>
          </div>
          <p className="text-[11px]">
            100% Local processing · Offline privacy guaranteed · Cross-platform macOS &amp; Windows
          </p>
        </div>
      </div>
    </div>
  );
}
