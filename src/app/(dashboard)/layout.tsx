import { Header } from '@/components/Header';
import { PageTransition } from '@/components/PageTransition';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="dashboard-main flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </>
  );
}
