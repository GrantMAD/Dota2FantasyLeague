import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Fantasy Dota 2',
  description: 'Privacy policy and data handling information for the Fantasy Dota 2 platform.',
};

export default function PrivacyPage() {
  const lastUpdated = 'November 14, 2026';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700/80 bg-slate-900/90 p-8 sm:p-12 shadow-2xl backdrop-blur-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
        >
          <span>←</span> Back to home
        </Link>

        <header className="mb-10 border-b border-slate-800 pb-8">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-4">
            Official Legal Policy
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </header>

        {/* Disclaimer Callout */}
        <div className="mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200/90">
          <p className="font-semibold text-amber-300 mb-1">Independent Fan Project Disclaimer</p>
          <p className="text-xs leading-relaxed text-slate-300">
            Fantasy Dota 2 is an independent community esports application. Dota 2, including its associated logos,
            hero portraits, ability icons, and game media, are registered trademarks and copyrighted material of Valve
            Corporation. This platform is not endorsed by, sponsored by, or directly affiliated with Valve Corporation,
            PGL, ESL, or any official tournament organizer.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-slate-300">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Introduction</h2>
            <p>
              This Privacy Policy explains how Fantasy Dota 2 (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the
              platform&rdquo;) collects, uses, stores, and protects personal information when you create an account,
              manage fantasy squads, participate in competitions, and navigate our web application.
            </p>
            <p>
              We are committed to transparent data practices. We only collect the minimal information necessary to deliver
              a reliable, fair, and engaging fantasy sports experience for professional Dota 2.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
            <p>We collect information in the following categories:</p>

            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="font-semibold text-slate-100">A. Account & Profile Information</h3>
                <p className="text-xs text-slate-400 mt-1">
                  When registering and configuring your manager profile, we collect your email address, chosen username,
                  display name, avatar selection, manager biography, country code, timezone, and UI theme preferences.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="font-semibold text-slate-100">B. Fantasy Gameplay & Competition Data</h3>
                <p className="text-xs text-slate-400 mt-1">
                  We store your gameplay decisions, including your 15-player squad roster, starting lineups, captaincy
                  and vice-captaincy selections, player transfers, chip usage (Triple Captain, Bench Boost, Wildcard),
                  league memberships (public and private leagues), match predictions, followed friends, and calculated
                  gameweek points and global rankings.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="font-semibold text-slate-100">C. Telemetry, Diagnostics & Performance Data</h3>
                <p className="text-xs text-slate-400 mt-1">
                  When telemetry is enabled, we collect aggregated client interaction data (such as page views, button
                  clicks, UI feature adoption, and layout preferences), device and browser information, API response
                  latencies, and application error logs. This data is used solely to maintain stability and optimize user
                  experience.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="font-semibold text-slate-100">D. User Support & Issue Reports</h3>
                <p className="text-xs text-slate-400 mt-1">
                  When submitting a bug or feedback report via our issue reporting feature, we collect your account ID,
                  reporter email, description of the problem, severity rating, and any optional diagnostic screenshots or
                  technical context you attach.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="font-semibold text-slate-100">E. Feature Waitlists & Consents</h3>
                <p className="text-xs text-slate-400 mt-1">
                  If you opt in to feature notifications (such as the Premium waitlist or season recap generation), we
                  store your email address, user ID, and timestamp of consent. You may withdraw consent at any time,
                  which immediately deletes the corresponding waitlist entry.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. How We Use Your Information</h2>
            <p>Your information is used strictly for the following operational purposes:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
              <li>Operating fantasy leagues, computing player statistics, and publishing leaderboard standings.</li>
              <li>Authenticating your identity and maintaining secure session persistence across devices.</li>
              <li>Sending transactional notifications you have opted into (e.g. deadline alerts, price changes, squad injury notices).</li>
              <li>Detecting, preventing, and addressing multi-accounting, unauthorized automated scraping, or rule abuse.</li>
              <li>Troubleshooting technical errors, diagnosing server latency, and improving user interface design.</li>
            </ul>
            <p className="font-medium text-emerald-400 pt-1">
              We never sell, rent, or monetize your personal information or contact details to third-party advertisers.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Cookies & Local Storage</h2>
            <p>The platform utilizes minimal essential cookies and client storage mechanisms:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                <strong className="text-white">Authentication Cookies:</strong> We use secure, <code className="text-amber-300">httpOnly</code> cookies
                (<code className="text-amber-300">sb-auth-token</code> and <code className="text-amber-300">sb-refresh-token</code>)
                to maintain your authenticated session. These cookies cannot be read by third-party scripts.
              </li>
              <li>
                <strong className="text-white">Local Storage:</strong> We use your browser&apos;s <code className="text-amber-300">localStorage</code>
                to remember user interface state, such as whether your navigation sidebar is expanded or collapsed and theme preferences.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Third-Party Service Providers</h2>
            <p>We work with trusted infrastructure and data partners to deliver the platform:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
              <li><strong className="text-white">Supabase:</strong> Provides managed database hosting, user authentication, and row-level security.</li>
              <li><strong className="text-white">Vercel:</strong> Provides serverless hosting, edge routing, and cloud deployment infrastructure.</li>
              <li><strong className="text-white">STRATZ & OpenDota APIs:</strong> Provide official match data, player IDs, and tournament statistics. No personal user data is sent to these services.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">6. Data Retention & User Rights</h2>
            <p>
              We retain account and gameplay data for the duration of the active competitive season. You maintain full control
              over your personal data, including the right to:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
              <li>Access and update your profile information, display name, and preferences directly via the Settings page.</li>
              <li>Opt in or out of email notifications and season recap generation at any time.</li>
              <li>Request full account deletion, which removes your profile, credentials, and personal references from active databases.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">7. Children&apos;s Privacy</h2>
            <p>
              Fantasy Dota 2 is not intended for children under the age of 13 (or under 16 where required by local law). We do
              not knowingly collect or maintain personal data from minors. If you believe a minor has registered an account,
              please contact us to have the information removed.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">8. Contact & Data Inquiries</h2>
            <p>
              For questions regarding this Privacy Policy, your account data, or to submit a deletion request, please contact
              our support team via the in-app Issue Reporter or reach out directly to the platform administration.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}