import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | Fantasy Dota 2',
  description: 'Request a secure password reset link for your Fantasy Dota 2 account.',
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
