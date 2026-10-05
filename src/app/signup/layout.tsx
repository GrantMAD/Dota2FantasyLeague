import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Account | Fantasy Dota 2',
  description: 'Create a Fantasy Dota 2 account to build your pro player squad and compete with managers worldwide.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
