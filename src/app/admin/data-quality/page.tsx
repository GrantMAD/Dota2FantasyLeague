'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface DataConflict {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  value_1: string;
  value_2: string;
  status: string;
}

interface QualityMetrics {
  overall_score: number;
  completeness_score: number;
  consistency_score: number;
  freshness_score: number;
  reliability_score: number;
  issues: string[];
  entity_type?: string;
}

export default function DataQualityPage() {
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'player' | 'team'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [conflictsRes, metricsRes] = await Promise.all([
        fetch(`/api/admin/data/conflicts${filter !== 'all' ? `?entity_type=${filter}` : ''}`),
        fetch('/api/admin/data/quality'),
      ]);

      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch data quality info:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading data quality dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Data Quality Dashboard</h1>
        <p className="mt-1 text-gray-400">Monitor data conflicts, inconsistencies, and quality metrics</p>
      </div>

      {/* Quality Metrics */}
      {metrics && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">Overall Quality Metrics</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <QualityMetricBadge
              label="Overall Score"
              value={metrics.overall_score}
              target={0.8}
            />
            <QualityMetricBadge
              label="Completeness"
              value={metrics.completeness_score}
              target={0.8}
            />
            <QualityMetricBadge
              label="Consistency"
              value={metrics.consistency_score}
              target={0.8}
            />
            <QualityMetricBadge
              label="Freshness"
              value={metrics.freshness_score}
              target={0.8}
            />
            <QualityMetricBadge
              label="Reliability"
              value={metrics.reliability_score}
              target={0.8}
            />
          </div>
        </div>
      )}

      {/* Conflicts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Data Conflicts ({conflicts.length})</h2>
          <div className="flex gap-2">
            {(['all', 'player', 'team'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {conflicts.length === 0 ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <p className="mt-2 font-medium text-green-400">No conflicts detected</p>
            <p className="text-sm text-green-300/80">All data is consistent across providers</p>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/50">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="border-b border-gray-700 p-4 last:border-b-0"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      <div>
                        <p className="font-medium text-white">
                          {conflict.entity_type.charAt(0).toUpperCase() + conflict.entity_type.slice(1)} #{conflict.entity_id}
                        </p>
                        <p className="text-sm text-gray-400">{conflict.field_name}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 rounded bg-gray-700/50 p-3 font-mono text-xs">
                      <div>
                        <span className="text-gray-400">Provider 1: </span>
                        <span className="text-gray-300">{conflict.value_1}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Provider 2: </span>
                        <span className="text-gray-300">{conflict.value_2}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <button
                      onClick={() => {
                        // TODO: Implement conflict resolution
                        console.log('Resolve conflict:', conflict.id);
                      }}
                      className="rounded bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/30"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issues Section */}
      {metrics?.issues && metrics.issues.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Issues Detected</h2>
          <div className="space-y-2">
            {metrics.issues.map((issue, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4"
              >
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <p className="text-sm text-yellow-300">{issue}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface QualityMetricBadgeProps {
  label: string;
  value: number;
  target: number;
}

function QualityMetricBadge({ label, value, target }: QualityMetricBadgeProps) {
  const percentage = Math.round(value * 100);
  const isGood = value >= target;

  return (
    <div className={`rounded-lg border p-4 ${isGood ? 'border-green-500/30 bg-green-500/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
      <p className={`text-sm font-medium ${isGood ? 'text-green-400' : 'text-yellow-400'}`}>
        {label}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full ${isGood ? 'bg-green-500' : 'bg-yellow-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className={`mt-2 text-2xl font-bold ${isGood ? 'text-green-400' : 'text-yellow-400'}`}>
        {percentage}%
      </p>
    </div>
  );
}
