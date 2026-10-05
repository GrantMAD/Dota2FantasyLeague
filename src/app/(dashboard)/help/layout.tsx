import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center & FAQ | Fantasy Dota 2',
  description: 'Find answers about fantasy leagues, player scoring, lineup substitutes, and gameweek results.',
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
