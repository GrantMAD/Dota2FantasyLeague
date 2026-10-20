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
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] backdrop-blur-md transition hover:bg-[var(--surface-raised)] focus:outline-none focus:ring-2 focus:ring-cyan-400"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Palette className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300" />
        <span>Banner: <strong className="font-bold text-[var(--text-primary)]">{currentTheme.name}</strong></span>
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
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xl backdrop-blur-xl sm:w-96"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Choose Hero Banner Theme</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
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
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-[var(--border)] bg-[var(--surface-raised)] hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-7 w-7 shrink-0 rounded-md bg-linear-to-r ${theme.gradientClass} border border-white/20 shadow-xs`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">{theme.name}</p>
                          <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.2 text-[9px] font-semibold text-[var(--text-secondary)]">
                            {theme.dotaRole}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-[var(--text-secondary)]">{theme.heroInspiration}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" />}
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
