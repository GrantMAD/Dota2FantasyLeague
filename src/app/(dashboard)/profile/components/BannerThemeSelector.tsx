'use client';

import { useState } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { BANNER_THEMES, type BannerTheme, type BannerThemeId } from './bannerThemes';

interface BannerThemeSelectorProps {
  currentTheme: BannerTheme;
  onSelectTheme: (themeId: BannerThemeId) => void;
}

export function BannerThemeSelector({ currentTheme, onSelectTheme }: BannerThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Palette className="h-3.5 w-3.5 text-cyan-400" />
        <span>Banner: <strong className="font-bold text-white">{currentTheme.name}</strong></span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Choose Banner Theme"
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl sm:w-96"
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Choose Hero Banner Theme</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 transition hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
              {BANNER_THEMES.map((theme) => {
                const isSelected = theme.id === currentTheme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onSelectTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={`group flex items-center justify-between rounded-lg border p-2.5 text-left transition ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/30'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-7 w-7 shrink-0 rounded-md bg-linear-to-r ${theme.gradientClass} border border-white/20 shadow-xs`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-white">{theme.name}</p>
                          <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-semibold text-slate-300">
                            {theme.dotaRole}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-400">{theme.heroInspiration}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
