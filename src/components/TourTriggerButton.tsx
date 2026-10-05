'use client';

import { CircleHelp } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getPageGuide } from '@/lib/pageGuides';
import { useTour } from '@/context/TourContext';
import { useTheme } from '@/components/theme/ThemeProvider';

export function TourTriggerButton() {
  const pathname = usePathname();
  const { isOpen, isGuideOpen, openGuide } = useTour();
  const { theme } = useTheme();
  const pageGuide = getPageGuide(pathname);

  if (!pageGuide || isOpen || isGuideOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={openGuide}
        className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_12px_30px_rgba(34,211,238,0.18)] backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 ${theme === 'dark' ? 'border-cyan-400/50 bg-slate-950/90 text-cyan-300 hover:bg-slate-900' : 'border-cyan-700/40 bg-white/95 text-cyan-800 hover:bg-cyan-50'} `}
        aria-label="Open page guide"
        title="Page guide"
      >
        <CircleHelp className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
}
