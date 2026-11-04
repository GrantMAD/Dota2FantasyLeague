import Link from 'next/link';
import { BookOpen, Compass, HelpCircle } from 'lucide-react';

const resources = [
  {
    id: 'learn',
    href: '/learn',
    title: 'Learn Hub',
    description: 'Follow a recommended path through the fantasy basics and key actions.',
    icon: BookOpen,
  },
  {
    id: 'guide',
    href: '/guide',
    title: 'Interactive Guide',
    description: 'Launch a guided walkthrough for a specific screen or feature.',
    icon: Compass,
  },
  {
    id: 'help',
    href: '/help',
    title: 'Help Center',
    description: 'Find FAQ answers, support guidance, or report an issue.',
    icon: HelpCircle,
  },
] as const;

export function LearningResourcesNav({ currentPage }: { currentPage: (typeof resources)[number]['id'] }) {
  return (
    <nav aria-label="Learning and support resources" className="mt-10 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Need something else?</p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Choose a learning or support resource</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {resources.map((resource) => {
          const Icon = resource.icon;
          const isCurrent = currentPage === resource.id;
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                {isCurrent ? (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    Current page
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">{resource.title}</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{resource.description}</p>
            </>
          );

          return isCurrent ? (
            <div
              key={resource.id}
              aria-current="page"
              className="rounded-xl border border-cyan-500/30 bg-[var(--surface-raised)] p-4"
            >
              {content}
            </div>
          ) : (
            <Link
              key={resource.id}
              href={resource.href}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-cyan-500/50 hover:bg-[var(--surface-raised)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
