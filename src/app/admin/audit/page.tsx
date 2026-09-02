'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AuditLog {
  id: number;
  table_name: string;
  record_id: number | null;
  action: string;
  changed_by: string | null;
  changed_by_user?: { username: string } | null;
  old_values: any;
  new_values: any;
  reason: string | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      if (actionFilter) params.append('action', actionFilter);
      if (tableFilter) params.append('table_name', tableFilter);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, tableFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'UPDATE': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'DELETE': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Audit Log</h1>
        <p className="mt-1 text-slate-400">View and track system mutations.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        
        {/* Filters */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-4 items-center">
          <select 
            value={actionFilter} 
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm"
          >
            <option value="">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="CORRECTION">CORRECTION</option>
          </select>

          <input 
            type="text" 
            placeholder="Filter by table name..."
            value={tableFilter}
            onChange={(e) => { setTableFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm flex-grow md:max-w-xs"
          />

          <button onClick={fetchLogs} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition-colors">
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Table</th>
                <th className="px-4 py-3 font-medium">Record ID</th>
                <th className="px-4 py-3 font-medium">Changed By</th>
                <th className="px-4 py-3 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500"></div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium">{log.table_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{log.record_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{log.changed_by_user?.username || log.changed_by || 'System'}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button 
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          className="text-amber-500 hover:text-amber-400 font-medium"
                        >
                          {expandedLogId === log.id ? 'Hide' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                    {expandedLogId === log.id && (
                      <tr className="bg-slate-900/50">
                        <td colSpan={6} className="p-4 border-b border-slate-700">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Old Values</h4>
                              <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                                {log.old_values ? JSON.stringify(log.old_values, null, 2) : 'null'}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">New Values</h4>
                              <pre className="bg-slate-950 p-3 rounded text-xs text-green-400 overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                                {log.new_values ? JSON.stringify(log.new_values, null, 2) : 'null'}
                              </pre>
                            </div>
                          </div>
                          {log.reason && (
                            <div className="mt-4">
                              <h4 className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Reason</h4>
                              <p className="text-sm text-slate-300">{log.reason}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
