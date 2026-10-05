import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose a New Password | Fantasy Dota 2',
  description: 'Set a new password for your Fantasy Dota 2 account.',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
