import { Header } from '@/components/Header';
import { ToastProvider } from '@/components/Toast/ToastContext';
import { ToastContainer } from '@/components/Toast/ToastContainer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <Header />
      <main className="dashboard-main flex-1">{children}</main>
      <ToastContainer />
    </ToastProvider>
  );
}
