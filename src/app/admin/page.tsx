'use client';

import { LayoutDashboard } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-white"><LayoutDashboard className="h-8 w-8 text-amber-400" />Admin Console</h1>
        <p className="mt-1 text-gray-400">Please select an option from the sidebar</p>
      </div>
    </div>
  );
}
