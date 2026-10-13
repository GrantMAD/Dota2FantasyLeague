import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Fantasy Dota 2',
  description: 'Terms of service for the Fantasy Dota 2 platform.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl">
        <Link href="/" className="mb-8 inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300">
          ← Back to home
        </Link>

        <h1 className="mb-6 text-4xl font-bold text-white">Terms of Service</h1>
        <p className="mb-6 text-slate-300">
          These terms are a placeholder while the full legal policy is being finalised.
        </p>

        <div className="space-y-6 text-sm leading-7 text-slate-300">
          <p>
            By using the Fantasy Dota 2 platform, you agree to use the service responsibly and in line with the
            rules of the competitions and leagues offered through the app.
          </p>
          <p>
            Users are responsible for the accuracy of the information they provide, the integrity of their squad and
            lineup decisions, and compliance with any league-specific rules or deadlines.
          </p>
          <p>
            The platform may update rules, scoring logic, and contest availability over time. Continued use of the
            service means you accept the most recent published terms and gameplay rules.
          </p>
          <p>
            If you do not agree with the rules or policies in effect, you should stop using the platform.
          </p>
        </div>
      </div>
    </main>
  );
}
