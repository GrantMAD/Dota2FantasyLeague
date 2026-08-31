import type { ReactNode } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const metadata = {
  title: 'Admin Console | Fantasy Dota 2',
  description: 'Administration dashboard for Fantasy Dota 2',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-screen bg-gray-900 text-white">
          {/* Top Bar */}
          <div className="border-b border-gray-800 bg-gray-800/50 px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Admin Console</h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  {new Date().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
