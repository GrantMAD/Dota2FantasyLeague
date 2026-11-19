import type { ReactNode } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ToastProvider } from '@/components/Toast/ToastContext';
import { ToastContainer } from '@/components/Toast/ToastContainer';

export const metadata = {
  title: 'Admin Console | Fantasy Dota 2',
  description: 'Administration dashboard for Fantasy Dota 2',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-100 dark:bg-gray-900">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Main Content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="min-h-full bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-white transition-colors">
            {/* Top Bar */}
            <div className="border-b border-slate-200 dark:border-gray-800 bg-white/80 dark:bg-gray-800/50 px-4 py-4 md:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 pl-12 md:pl-0">
                  <h1 className="truncate text-xl font-bold md:text-2xl text-slate-900 dark:text-white">Admin Console</h1>
                </div>
                <div className="flex items-center gap-4">
                  <ThemeToggle />
                  <span className="hidden text-sm text-slate-500 dark:text-gray-400 sm:inline">
                    {new Date().toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
      <ToastContainer />
    </ToastProvider>
  );
}
