import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive Guide | Fantasy Dota 2',
  description: 'Learn how to build your fantasy squad, set lineups, manage transfers, and follow Dota 2 competitions.',
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
