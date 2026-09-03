'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
interface ThemeContextValue { theme: Theme; setTheme: (theme: Theme) => Promise<void>; ready: boolean; }
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/user/theme');
        if (response.ok) {
          const data = await response.json();
          if (data.theme === 'light' || data.theme === 'dark') setThemeState(data.theme);
        }
      } finally {
        setReady(true);
      }
    };
    void loadTheme();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = async (nextTheme: Theme) => {
    const previous = theme;
    setThemeState(nextTheme);
    try {
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      });
      if (!response.ok) throw new Error('Theme preference could not be saved');
    } catch (error) {
      setThemeState(previous);
      throw error;
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme, ready }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
