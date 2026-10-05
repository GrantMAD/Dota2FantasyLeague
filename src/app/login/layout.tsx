import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Fantasy Dota 2',
  description: 'Sign in to manage your Dota 2 fantasy squad, set lineups, and compete in leagues.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
