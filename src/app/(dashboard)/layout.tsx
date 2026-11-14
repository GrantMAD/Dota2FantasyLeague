import { Header } from '@/components/Header';
import { PageTransition } from '@/components/PageTransition';
import { HeaderDataProvider } from '@/context/HeaderDataContext';
import { DataFreshnessProvider } from '@/context/DataFreshnessContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderDataProvider>
      <DataFreshnessProvider>
        <>
          <Header />
          <main className="dashboard-main flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
        </>
      </DataFreshnessProvider>
    </HeaderDataProvider>
  );
}
