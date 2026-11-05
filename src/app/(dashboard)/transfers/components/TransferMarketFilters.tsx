'use client';

import { ArrowDown, ArrowUp, Pin } from 'lucide-react';
import {
  ROLE_ACCENTS,
  STARTER_ROLES,
  type TransferOwnershipFilter,
  type TransferSortBy,
} from '../transfer-types';

interface TransferMarketFiltersProps {
  search: string;
  roleFilter: string;
  ownershipFilter: TransferOwnershipFilter;
  sortBy: TransferSortBy;
  sortDesc: boolean;
  pinOwnedFirst: boolean;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onOwnershipChange: (value: TransferOwnershipFilter) => void;
  onSortChange: (value: TransferSortBy) => void;
  onTogglePinOwnedFirst: () => void;
  onClear: () => void;
}

export function TransferMarketFilters({
  search,
  roleFilter,
  ownershipFilter,
  sortBy,
  sortDesc,
  pinOwnedFirst,
  onSearchChange,
  onRoleChange,
  onOwnershipChange,
  onSortChange,
  onTogglePinOwnedFirst,
  onClear,
}: TransferMarketFiltersProps) {
  return (
    <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-lg backdrop-blur">
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.2fr)_minmax(0,2fr)]">
        <div>
          <label htmlFor="transfer-market-search" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Scout players
          </label>
          <input
            id="transfer-market-search"
            data-tour="transfers-search"
            type="search"
            placeholder="Search player or team..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Role</div>
          <div className="flex flex-wrap gap-1.5">
            {['', ...STARTER_ROLES].map((role) => (
              <button
                key={role || 'all'}
                type="button"
                aria-pressed={roleFilter === role}
                onClick={() => onRoleChange(role)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  roleFilter === role
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]'
                    : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={role && roleFilter === role ? { boxShadow: `inset 0 0 0 1px ${ROLE_ACCENTS[role]}` } : undefined}
              >
                {role || 'All roles'}
              </button>
            ))}
          </div>
          {(roleFilter === 'Support' || roleFilter === 'Hard Support') && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Support and Hard Support players may share fantasy eligibility.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:col-span-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Squad</span>
          {([
            { value: 'all', label: 'All players' },
            { value: 'owned', label: 'My squad' },
            { value: 'available', label: 'Available' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={ownershipFilter === option.value}
              onClick={() => onOwnershipChange(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                ownershipFilter === option.value
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {option.label}
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sort</span>
          {([
            { id: 'price', label: 'Price' },
            { id: 'points', label: 'Points / Form' },
            { id: 'ownership', label: 'Ownership' },
            { id: 'name', label: 'Name' },
          ] as const).map((option) => {
            const isActive = sortBy === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSortChange(option.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-pressed={isActive}
              >
                {option.label}
                {isActive && (sortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onTogglePinOwnedFirst}
            aria-pressed={pinOwnedFirst}
            className={`ml-auto rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              pinOwnedFirst
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Pin className="h-3.5 w-3.5" />
              Pin squad {pinOwnedFirst ? 'on' : 'off'}
            </span>
          </button>
          {(search || roleFilter || ownershipFilter !== 'all') && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full px-2 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
