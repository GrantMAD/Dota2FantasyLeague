'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Check,
  X,
  Sliders,
  Loader2,
  FileText,
  Database,
  Info,
  Shield,
  User,
  Trophy,
  Swords,
  ExternalLink,
  Image as ImageIcon,
  HelpCircle,
  CheckCheck,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface DataConflict {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  field_name: string;
  value_1: unknown;
  value_2: unknown;
  provider_1?: string;
  provider_2?: string;
  resolved_value?: unknown;
  resolved_provider?: string;
  status: string;
  resolved_at?: string;
  resolved_by?: string;
  notes?: string;
  created_at?: string;
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

type EntityFilter = 'all' | 'player' | 'team' | 'match' | 'tournament';
type StatusFilter = 'all' | 'unresolved' | 'resolved' | 'ignored';

function isImageUrl(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const str = val.trim().toLowerCase();
  return (
    (str.startsWith('http://') || str.startsWith('https://')) &&
    (str.includes('.png') ||
      str.includes('.jpg') ||
      str.includes('.jpeg') ||
      str.includes('.webp') ||
      str.includes('.svg') ||
      str.includes('steamcdn') ||
      str.includes('opendota') ||
      str.includes('stratz') ||
      str.includes('cloudflare') ||
      str.includes('image'))
  );
}

function getConflictGuidance(conflict: DataConflict): {
  title: string;
  explanation: string;
  recommendation: string;
} {
  const field = conflict.field_name.toLowerCase();
  const entityTitle = conflict.entity_name
    ? `"${conflict.entity_name}"`
    : `${conflict.entity_type} #${conflict.entity_id}`;

  if (field.includes('logo') || field.includes('avatar') || field.includes('image')) {
    return {
      title: 'Logo / Image Discrepancy',
      explanation: `Both data providers supplied different image URLs for ${entityTitle}. Check the visual thumbnails below to verify which logo is active, high-resolution, or not broken.`,
      recommendation:
        'Compare the image previews. If one link fails to load or is outdated, accept the working one.',
    };
  }

  if (field === 'name' || field === 'real_name') {
    return {
      title: 'Name / Spelling Mismatch',
      explanation: `Differing names found for ${entityTitle}. One source may include sponsor prefixes, legacy nicknames, or alternate language spelling.`,
      recommendation: 'Choose the official current competitive nickname or standard English spelling.',
    };
  }

  if (field === 'tag') {
    return {
      title: 'Team Tag Difference',
      explanation: `Different abbreviation tags provided for ${entityTitle}.`,
      recommendation: 'Pick the official tournament ticker/tag currently used by the team.',
    };
  }

  if (field.includes('team_id')) {
    return {
      title: 'Team Roster Affiliation',
      explanation: `The providers disagree on which team ${entityTitle} belongs to. This usually indicates a recent roster change or stand-in match.`,
      recommendation: 'Verify the player’s most recent official roster announcement.',
    };
  }

  if (field.includes('role') || field.includes('position')) {
    return {
      title: 'Role / Position Classification',
      explanation: `Providers have classified ${entityTitle}'s primary in-game position differently (e.g. Core vs Support, or Position 1 vs Position 2).`,
      recommendation: 'Pick the position the player predominantly plays in the current patch or tournament.',
    };
  }

  return {
    title: `Discrepancy on '${conflict.field_name}'`,
    explanation: `Providers have conflicting values for ${entityTitle}'s ${conflict.field_name} attribute.`,
    recommendation: 'Review both provider records and choose the more accurate or updated one.',
  };
}

export default function DataQualityPage() {
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Track image load failures to show graceful fallback
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Resolution in progress
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state for custom resolution
  const [modalConflict, setModalConflict] = useState<DataConflict | null>(null);
  const [modalChoice, setModalChoice] = useState<'provider_1' | 'provider_2' | 'custom'>('provider_1');
  const [modalCustomValue, setModalCustomValue] = useState<string>('');
  const [modalProvider, setModalProvider] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalApplyToEntity, setModalApplyToEntity] = useState<boolean>(true);
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);

  // Bulk ignore state
  const [bulkIgnoring, setBulkIgnoring] = useState<boolean>(false);
  const [showIgnoreAllModal, setShowIgnoreAllModal] = useState<boolean>(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const entityParam = entityFilter !== 'all' ? `entity_type=${entityFilter}` : '';
      const statusParam = statusFilter !== 'all' ? `status=${statusFilter}` : '';
      const queryParams = [entityParam, statusParam].filter(Boolean).join('&');
      const conflictsUrl = `/api/admin/data/conflicts${queryParams ? `?${queryParams}` : ''}`;

      const [conflictsRes, metricsRes] = await Promise.all([
        fetchWithAuth(conflictsUrl),
        fetchWithAuth('/api/admin/data/quality'),
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
      setFeedback({ type: 'error', message: 'Failed to load data conflicts or metrics.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entityFilter, statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Direct 1-click resolution
  const handleQuickResolve = async (
    conflict: DataConflict,
    choice: 'provider_1' | 'provider_2'
  ) => {
    const chosenValue = choice === 'provider_1' ? conflict.value_1 : conflict.value_2;
    const chosenProvider =
      (choice === 'provider_1' ? conflict.provider_1 : conflict.provider_2) ||
      (choice === 'provider_1' ? 'Provider 1' : 'Provider 2');

    setActionLoadingId(conflict.id);
    setFeedback(null);

    try {
      const res = await fetchWithAuth('/api/admin/data/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({
          conflict_id: conflict.id,
          resolved_value: chosenValue,
          resolved_provider: chosenProvider,
          status: 'resolved',
          apply_to_entity: true,
          notes: `Quick-resolved using ${chosenProvider} value`,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to resolve conflict');
      }

      setFeedback({
        type: 'success',
        message: `Conflict for ${conflict.entity_name || conflict.entity_type} (${conflict.field_name}) marked as resolved in database.`,
      });

      // Update local state immediately
      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflict.id
            ? {
                ...c,
                status: 'resolved',
                resolved_value: chosenValue,
                resolved_provider: chosenProvider,
                resolved_at: new Date().toISOString(),
                notes: `Quick-resolved using ${chosenProvider} value`,
              }
            : c
        )
      );
    } catch (err: any) {
      console.error('Resolution failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error occurred while resolving conflict',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Direct Ignore
  const handleIgnore = async (conflict: DataConflict) => {
    setActionLoadingId(conflict.id);
    setFeedback(null);

    try {
      const res = await fetchWithAuth('/api/admin/data/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({
          conflict_id: conflict.id,
          status: 'ignored',
          notes: 'Marked as ignored by admin',
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to ignore conflict');
      }

      setFeedback({
        type: 'success',
        message: `Conflict for ${conflict.entity_name || conflict.entity_type} marked as ignored in database.`,
      });

      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflict.id
            ? {
                ...c,
                status: 'ignored',
                resolved_at: new Date().toISOString(),
                notes: 'Marked as ignored by admin',
              }
            : c
        )
      );
    } catch (err: any) {
      console.error('Ignore failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error occurred while ignoring conflict',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Bulk Ignore All Unresolved Conflicts
  const handleIgnoreAll = async () => {
    setBulkIgnoring(true);
    setFeedback(null);

    try {
      const res = await fetchWithAuth('/api/admin/data/ignore-all-conflicts', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: entityFilter !== 'all' ? entityFilter : undefined,
          notes: `Bulk ignored by admin (${entityFilter !== 'all' ? entityFilter : 'all entities'})`,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to ignore conflicts');
      }

      setFeedback({
        type: 'success',
        message: result.message || `Successfully ignored ${result.count ?? 0} conflicts. No entity data was modified.`,
      });

      // Update local state: mark all currently unresolved conflicts as ignored
      setConflicts((prev) =>
        prev.map((c) => {
          if (c.status === 'unresolved' && (entityFilter === 'all' || c.entity_type === entityFilter)) {
            return {
              ...c,
              status: 'ignored',
              resolved_at: new Date().toISOString(),
              notes: 'Bulk ignored by admin',
            };
          }
          return c;
        })
      );

      setShowIgnoreAllModal(false);
    } catch (err: any) {
      console.error('Bulk ignore failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error occurred while bulk ignoring conflicts',
      });
    } finally {
      setBulkIgnoring(false);
    }
  };

  // Open custom resolution modal
  const openCustomModal = (conflict: DataConflict) => {
    setModalConflict(conflict);
    setModalChoice('provider_1');
    setModalProvider(conflict.provider_1 || 'manual');
    setModalNotes(conflict.notes || '');
    setModalApplyToEntity(true);

    const initialVal = conflict.value_1;
    setModalCustomValue(
      typeof initialVal === 'object' && initialVal !== null
        ? JSON.stringify(initialVal, null, 2)
        : String(initialVal ?? '')
    );
  };

  // Submit modal resolution
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConflict) return;

    setModalSubmitting(true);
    setFeedback(null);

    try {
      let finalValue: unknown;
      let finalProvider: string = modalProvider.trim() || 'manual';

      if (modalChoice === 'provider_1') {
        finalValue = modalConflict.value_1;
        finalProvider = modalConflict.provider_1 || finalProvider;
      } else if (modalChoice === 'provider_2') {
        finalValue = modalConflict.value_2;
        finalProvider = modalConflict.provider_2 || finalProvider;
      } else {
        const trimmed = modalCustomValue.trim();
        try {
          if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
          ) {
            finalValue = JSON.parse(trimmed);
          } else if (trimmed === 'true') {
            finalValue = true;
          } else if (trimmed === 'false') {
            finalValue = false;
          } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
            finalValue = Number(trimmed);
          } else {
            finalValue = trimmed;
          }
        } catch {
          finalValue = trimmed;
        }
      }

      const res = await fetchWithAuth('/api/admin/data/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({
          conflict_id: modalConflict.id,
          resolved_value: finalValue,
          resolved_provider: finalProvider,
          status: 'resolved',
          apply_to_entity: modalApplyToEntity,
          notes: modalNotes.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to resolve conflict');
      }

      setFeedback({
        type: 'success',
        message: `Conflict for ${modalConflict.entity_name || modalConflict.entity_type} (${modalConflict.field_name}) resolved in database!`,
      });

      setConflicts((prev) =>
        prev.map((c) =>
          c.id === modalConflict.id
            ? {
                ...c,
                status: 'resolved',
                resolved_value: finalValue,
                resolved_provider: finalProvider,
                resolved_at: new Date().toISOString(),
                notes: modalNotes.trim() || c.notes,
              }
            : c
        )
      );

      setModalConflict(null);
    } catch (err: any) {
      console.error('Modal resolution failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error occurred while resolving conflict',
      });
    } finally {
      setModalSubmitting(false);
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '<null>';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  const getEntityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'team':
        return <Shield className="h-4 w-4 text-sky-400" />;
      case 'player':
        return <User className="h-4 w-4 text-emerald-400" />;
      case 'tournament':
        return <Trophy className="h-4 w-4 text-amber-400" />;
      case 'match':
        return <Swords className="h-4 w-4 text-rose-400" />;
      default:
        return <Database className="h-4 w-4 text-indigo-400" />;
    }
  };

  const unresolvedCount = conflicts.filter((c) => c.status === 'unresolved').length;
  const resolvedCount = conflicts.filter((c) => c.status === 'resolved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span>Loading data quality dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <AlertCircle className="h-8 w-8 text-amber-400" />
            Data Quality Dashboard
          </h1>
          <p className="mt-1 text-gray-400">
            Monitor and resolve cross-provider data conflicts, track consistency, and enforce quality standards
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unresolvedCount > 0 && (
            <button
              onClick={() => setShowIgnoreAllModal(true)}
              disabled={bulkIgnoring}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 hover:text-white disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Resolve All (Ignore {unresolvedCount})</span>
            </button>
          )}
          <button
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg border p-4 ${
            feedback.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quality Metrics */}
      {metrics && (
        <div className="rounded-xl border border-gray-700/80 bg-gray-850 p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-white">Overall Quality Metrics</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Data Conflicts{' '}
              <span className="ml-2 inline-flex items-center rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-300">
                {conflicts.length}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review discrepancies between providers and choose which value to save in the database
            </p>
          </div>

          {/* Filter bars */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status filters */}
            <div className="flex rounded-lg border border-gray-700 bg-gray-900/60 p-1">
              {(
                [
                  { id: 'all', label: 'All Status' },
                  { id: 'unresolved', label: `Unresolved (${unresolvedCount})` },
                  { id: 'resolved', label: `Resolved (${resolvedCount})` },
                  { id: 'ignored', label: 'Ignored' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    statusFilter === s.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Entity filters */}
            <div className="flex rounded-lg border border-gray-700 bg-gray-900/60 p-1">
              {(['all', 'player', 'team', 'match', 'tournament'] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEntityFilter(e)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    entityFilter === e
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>

            {/* Bulk Ignore Button in Filter Bar */}
            {unresolvedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowIgnoreAllModal(true)}
                disabled={bulkIgnoring}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 hover:text-white transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Ignore All ({unresolvedCount})
              </button>
            )}
          </div>
        </div>

        {conflicts.length === 0 ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <p className="mt-3 font-semibold text-green-400">No conflicts found</p>
            <p className="mt-1 text-sm text-green-300/80">
              {statusFilter === 'unresolved'
                ? 'All data conflicts have been resolved or ignored!'
                : 'No conflicts matched the current filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map((conflict) => {
              const isResolved = conflict.status === 'resolved';
              const isIgnored = conflict.status === 'ignored';
              const isActionLoading = actionLoadingId === conflict.id;

              const provider1Name = conflict.provider_1 || 'Provider 1';
              const provider2Name = conflict.provider_2 || 'Provider 2';

              const guidance = getConflictGuidance(conflict);
              const isImgField =
                conflict.field_name.toLowerCase().includes('logo') ||
                conflict.field_name.toLowerCase().includes('avatar') ||
                conflict.field_name.toLowerCase().includes('image') ||
                isImageUrl(conflict.value_1) ||
                isImageUrl(conflict.value_2);

              const val1IsImg = isImageUrl(conflict.value_1);
              const val2IsImg = isImageUrl(conflict.value_2);

              return (
                <div
                  key={conflict.id}
                  className={`rounded-xl border bg-gray-800/60 p-5 shadow-sm transition-all ${
                    isResolved
                      ? 'border-green-500/30'
                      : isIgnored
                      ? 'border-gray-700 opacity-75'
                      : 'border-amber-500/40'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/60 pb-3">
                    <div className="flex items-center gap-3">
                      {isResolved ? (
                        <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
                      ) : isIgnored ? (
                        <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1.5 font-bold text-white">
                            {getEntityIcon(conflict.entity_type)}
                            {conflict.entity_name ? (
                              <span>{conflict.entity_name}</span>
                            ) : (
                              <span className="capitalize">{conflict.entity_type}</span>
                            )}
                          </span>
                          <span className="font-mono text-xs text-gray-400">
                            (ID: {conflict.entity_id})
                          </span>
                          <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-xs font-mono font-medium text-indigo-400 border border-indigo-500/20">
                            Field: {conflict.field_name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                          isResolved
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : isIgnored
                            ? 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {conflict.status}
                      </span>
                      {conflict.created_at && (
                        <span className="text-xs text-gray-500">
                          {new Date(conflict.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contextual Guidance & Human Explanation */}
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold text-amber-300">
                          {guidance.title}
                        </p>
                        <p className="text-gray-300 leading-relaxed">
                          {guidance.explanation}
                        </p>
                        <p className="text-amber-200/80 font-medium">
                          <span className="text-amber-400">Resolution tip:</span>{' '}
                          {guidance.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Provider Values Comparison */}
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Provider 1 */}
                    <div className="flex flex-col justify-between rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/30 uppercase tracking-wide">
                            {provider1Name}
                          </span>
                          <span className="text-xs text-gray-500">Source 1</span>
                        </div>

                        {/* Image Preview if applicable */}
                        {isImgField && val1IsImg && (
                          <div className="mt-3 flex items-center gap-3 rounded bg-black/50 p-2.5 border border-gray-800">
                            <div className="relative h-16 w-16 shrink-0 rounded bg-gray-950 p-1 border border-gray-700/80 flex items-center justify-center overflow-hidden">
                              {failedImages[`${conflict.id}-1`] ? (
                                <div className="text-center text-[10px] text-red-400 p-1">
                                  Broken Image
                                </div>
                              ) : (
                                <img
                                  src={String(conflict.value_1)}
                                  alt={`${provider1Name} preview`}
                                  className="max-h-full max-w-full object-contain"
                                  onError={() =>
                                    setFailedImages((prev) => ({
                                      ...prev,
                                      [`${conflict.id}-1`]: true,
                                    }))
                                  }
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Image Preview
                              </span>
                              <div className="mt-0.5">
                                <a
                                  href={String(conflict.value_1)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                                >
                                  Open image in new tab <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 rounded bg-black/40 p-3 font-mono text-xs text-gray-200 break-all leading-relaxed whitespace-pre-wrap select-all">
                          {formatValue(conflict.value_1)}
                        </div>
                      </div>

                      {!isResolved && (
                        <div className="mt-3 flex justify-end pt-2 border-t border-gray-800/60">
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => void handleQuickResolve(conflict, 'provider_1')}
                            className="inline-flex items-center gap-1.5 rounded bg-sky-600/20 px-3 py-1.5 text-xs font-semibold text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 hover:text-white transition-colors disabled:opacity-50"
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Accept {provider1Name}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Provider 2 */}
                    <div className="flex flex-col justify-between rounded-lg border border-gray-700 bg-gray-900/60 p-4">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                          <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/30 uppercase tracking-wide">
                            {provider2Name}
                          </span>
                          <span className="text-xs text-gray-500">Source 2</span>
                        </div>

                        {/* Image Preview if applicable */}
                        {isImgField && val2IsImg && (
                          <div className="mt-3 flex items-center gap-3 rounded bg-black/50 p-2.5 border border-gray-800">
                            <div className="relative h-16 w-16 shrink-0 rounded bg-gray-950 p-1 border border-gray-700/80 flex items-center justify-center overflow-hidden">
                              {failedImages[`${conflict.id}-2`] ? (
                                <div className="text-center text-[10px] text-red-400 p-1">
                                  Broken Image
                                </div>
                              ) : (
                                <img
                                  src={String(conflict.value_2)}
                                  alt={`${provider2Name} preview`}
                                  className="max-h-full max-w-full object-contain"
                                  onError={() =>
                                    setFailedImages((prev) => ({
                                      ...prev,
                                      [`${conflict.id}-2`]: true,
                                    }))
                                  }
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Image Preview
                              </span>
                              <div className="mt-0.5">
                                <a
                                  href={String(conflict.value_2)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:underline"
                                >
                                  Open image in new tab <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 rounded bg-black/40 p-3 font-mono text-xs text-gray-200 break-all leading-relaxed whitespace-pre-wrap select-all">
                          {formatValue(conflict.value_2)}
                        </div>
                      </div>

                      {!isResolved && (
                        <div className="mt-3 flex justify-end pt-2 border-t border-gray-800/60">
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => void handleQuickResolve(conflict, 'provider_2')}
                            className="inline-flex items-center gap-1.5 rounded bg-purple-600/20 px-3 py-1.5 text-xs font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 hover:text-white transition-colors disabled:opacity-50"
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Accept {provider2Name}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resolution Details if already resolved */}
                  {isResolved && (
                    <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-green-400">Resolved Value:</span>
                          <span className="font-mono text-green-200 bg-green-950/60 px-2 py-0.5 rounded border border-green-500/30 break-all select-all">
                            {formatValue(conflict.resolved_value)}
                          </span>
                          <span className="text-gray-400">
                            (via <span className="text-green-300 uppercase">{conflict.resolved_provider || 'manual'}</span>)
                          </span>
                        </div>
                        {conflict.resolved_at && (
                          <span className="text-gray-400">
                            Resolved on {new Date(conflict.resolved_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {conflict.notes && (
                        <p className="mt-2 text-gray-300 break-words">
                          <span className="font-medium text-gray-400">Notes:</span> {conflict.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-gray-700/50 pt-3">
                    {!isResolved && (
                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => void handleIgnore(conflict)}
                        className="rounded px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors disabled:opacity-50"
                      >
                        Ignore Conflict
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => openCustomModal(conflict)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      {isResolved ? 'Re-resolve / Edit' : 'Custom Resolution & Notes'}
                    </button>
                  </div>
                </div>
              );
            })}
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
                <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
                <p className="text-sm text-yellow-300">{issue}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Resolution Modal */}
      {modalConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-amber-400" />
                Resolve Conflict in Database
              </h3>
              <button
                onClick={() => setModalConflict(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="mt-4 space-y-4">
              <div className="rounded-lg bg-gray-800/60 p-3 text-xs text-gray-300 space-y-1">
                <div>
                  <span className="text-gray-400">Target Entity:</span>{' '}
                  <span className="font-semibold text-white">
                    {modalConflict.entity_name ? (
                      `${modalConflict.entity_name} (${modalConflict.entity_type} #${modalConflict.entity_id})`
                    ) : (
                      <span className="capitalize">{modalConflict.entity_type} #{modalConflict.entity_id}</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Target Field:</span>{' '}
                  <span className="font-mono text-indigo-400 font-semibold">
                    {modalConflict.field_name}
                  </span>
                </div>
              </div>

              {/* Resolution Choice */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Select Resolution Value
                </label>
                <div className="space-y-2">
                  {/* Provider 1 Option */}
                  <label
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      modalChoice === 'provider_1'
                        ? 'border-sky-500 bg-sky-950/30'
                        : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution_choice"
                      className="mt-1"
                      checked={modalChoice === 'provider_1'}
                      onChange={() => {
                        setModalChoice('provider_1');
                        setModalProvider(modalConflict.provider_1 || 'provider_1');
                      }}
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-sky-400 uppercase">
                        Use {modalConflict.provider_1 || 'Provider 1'} Value
                      </div>
                      <div className="mt-1 font-mono text-gray-200 bg-black/40 p-2.5 rounded break-all whitespace-pre-wrap select-all">
                        {formatValue(modalConflict.value_1)}
                      </div>
                    </div>
                  </label>

                  {/* Provider 2 Option */}
                  <label
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      modalChoice === 'provider_2'
                        ? 'border-purple-500 bg-purple-950/30'
                        : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution_choice"
                      className="mt-1"
                      checked={modalChoice === 'provider_2'}
                      onChange={() => {
                        setModalChoice('provider_2');
                        setModalProvider(modalConflict.provider_2 || 'provider_2');
                      }}
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-purple-400 uppercase">
                        Use {modalConflict.provider_2 || 'Provider 2'} Value
                      </div>
                      <div className="mt-1 font-mono text-gray-200 bg-black/40 p-2.5 rounded break-all whitespace-pre-wrap select-all">
                        {formatValue(modalConflict.value_2)}
                      </div>
                    </div>
                  </label>

                  {/* Custom Value Option */}
                  <label
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      modalChoice === 'custom'
                        ? 'border-amber-500 bg-amber-950/30'
                        : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution_choice"
                      className="mt-1"
                      checked={modalChoice === 'custom'}
                      onChange={() => {
                        setModalChoice('custom');
                        setModalProvider('manual');
                      }}
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-amber-400">
                        Custom Value (Override)
                      </div>
                      {modalChoice === 'custom' && (
                        <div className="mt-2">
                          <textarea
                            rows={3}
                            value={modalCustomValue}
                            onChange={(e) => setModalCustomValue(e.target.value)}
                            placeholder="Enter custom string, number, or JSON object"
                            className="w-full rounded border border-gray-700 bg-black/60 p-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Provider attribution name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Provider Attribution Name
                </label>
                <input
                  type="text"
                  value={modalProvider}
                  onChange={(e) => setModalProvider(e.target.value)}
                  placeholder="e.g. stratz, opendota, manual"
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Resolution Notes (Audit Trail)
                </label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. Verified via Liquipedia / official match client"
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Apply to entity checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={modalApplyToEntity}
                  onChange={(e) => setModalApplyToEntity(e.target.checked)}
                  className="rounded border-gray-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs text-gray-300">
                  Also update the <span className="font-semibold text-amber-300">{modalConflict.entity_name || modalConflict.entity_type}</span> record in the database directly
                </span>
              </label>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-700 pt-4">
                <button
                  type="button"
                  onClick={() => setModalConflict(null)}
                  className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving to Database...
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5" />
                      Save & Mark Resolved
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ignore All Confirmation Modal */}
      {showIgnoreAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Resolve All Conflicts (Ignore)
              </h3>
              <button
                onClick={() => setShowIgnoreAllModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-300 space-y-3">
              <p>
                Are you sure you want to resolve and ignore all{' '}
                <strong className="text-white">{unresolvedCount}</strong> unresolved conflict(s)
                {entityFilter !== 'all' ? ` for ${entityFilter}s` : ''}?
              </p>
              <div className="rounded-lg bg-gray-800/80 p-3.5 border border-gray-700 space-y-1.5">
                <div className="font-semibold text-green-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  No database entity data will be modified
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  All current player and team values in your database remain untouched. These conflict records will simply be marked as{' '}
                  <span className="text-amber-300 font-semibold">Ignored</span> and removed from your active review queue.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-700 pt-4">
              <button
                type="button"
                onClick={() => setShowIgnoreAllModal(false)}
                className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkIgnoring}
                onClick={() => void handleIgnoreAll()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50"
              >
                {bulkIgnoring ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Ignoring All...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-3.5 w-3.5" />
                    Yes, Ignore All ({unresolvedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface QualityMetricBadgeProps {
  label: string;
  value?: number | null;
  target: number;
}

function QualityMetricBadge({ label, value, target }: QualityMetricBadgeProps) {
  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const percentage = Math.round(numValue * 100);
  const isGood = numValue >= target;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isGood ? 'border-green-500/30 bg-green-500/10' : 'border-yellow-500/30 bg-yellow-500/10'
      }`}
    >
      <p className={`text-sm font-medium ${isGood ? 'text-green-400' : 'text-yellow-400'}`}>
        {label}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full ${isGood ? 'bg-green-500' : 'bg-yellow-500'}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
      <p className={`mt-2 text-2xl font-bold ${isGood ? 'text-green-400' : 'text-yellow-400'}`}>
        {percentage}%
      </p>
    </div>
  );
}
