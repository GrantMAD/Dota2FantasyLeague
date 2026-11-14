import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Fantasy Dota 2',
  description: 'Terms of service and competition rules for the Fantasy Dota 2 platform.',
};

export default function TermsPage() {
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
          <div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-4">
            Official Competition Terms
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </header>

        {/* Disclaimer Callout */}
        <div className="mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200/90">
          <p className="font-semibold text-amber-300 mb-1">Notice of Independent Platform</p>
          <p className="text-xs leading-relaxed text-slate-300">
            Fantasy Dota 2 is an independent esports companion application created for competitive Dota 2 fans. Dota 2 is
            a registered trademark of Valve Corporation. This platform is not endorsed by, sponsored by, or affiliated
            with Valve Corporation, tournament organizers, or professional esports organizations.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-7 text-slate-300">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Agreement to Terms & Eligibility</h2>
            <p>
              By creating an account, browsing our website, or participating in any fantasy leagues, you agree to be bound
              by these Terms of Service and our Privacy Policy. If you do not agree with any part of these terms, you must
              discontinue using the platform immediately.
            </p>
            <p>
              You must be at least 13 years of age (or the minimum legal age required in your country of residence) to register
              an account and play. By creating an account, you represent and warrant that you meet this age requirement.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Account Responsibility & Acceptable Use</h2>
            <p>To preserve fair competition and protect all players, managers agree to the following standards:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                <strong className="text-white">One Account Per Manager:</strong> Each player may create and operate only one active account.
                Operating multiple accounts to manipulate leagues, standings, or player values is strictly prohibited.
              </li>
              <li>
                <strong className="text-white">Account Security:</strong> You are responsible for safeguarding your login credentials. You must
                notify us immediately if you suspect unauthorized access to your account.
              </li>
              <li>
                <strong className="text-white">Respectful Conduct:</strong> Manager usernames, squad names, and custom league titles must not
                contain hate speech, harassment, vulgarity, or defamatory content.
              </li>
              <li>
                <strong className="text-white">Fair Play & Automation:</strong> You may not use automated bots, scrapers, exploits, or unauthorized
                third-party tools to interact with our APIs or gain an unfair competitive advantage.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Fantasy Rules, Deadlines & Scoring Finality</h2>
            <p>
              Participation in Fantasy Dota 2 is governed by the official competition rules published on the platform:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
              <li>
                <strong className="text-white">Gameweek Deadlines:</strong> Lineups, captaincy designations, transfers, and chip activations lock
                strictly at the announced deadline prior to match start times. Late changes cannot be accommodated under any circumstances.
              </li>
              <li>
                <strong className="text-white">Scoring Calculations:</strong> Fantasy points are computed from official game statistics ingested from
                trusted data providers (STRATZ, OpenDota, and Valve).
              </li>
              <li>
                <strong className="text-white">Stat Corrections:</strong> If an official provider issues an updated match summary or box score correction,
                our automated recalculation jobs adjust fantasy points accordingly.
              </li>
              <li>
                <strong className="text-white">Administrative Finality:</strong> All gameweek score resolutions, tie-breaker determinations, and
                leaderboard outcomes finalized by platform administration are final and binding.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Leagues & Community Competitions</h2>
            <p>
              Managers may join public global leagues or create private custom leagues with friend codes. Private league
              creators act as community coordinators and must uphold these Terms of Service.
            </p>
            <p>
              We reserve the right, at our sole discretion, to remove offensive leagues, reassign league ownership, or
              disqualify squads that engage in collusion, intentional match-throwing, or harassment.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Intellectual Property Rights</h2>
            <p>
              The platform design, source code, visual layout, animations, and proprietary scoring algorithms are the
              intellectual property of Fantasy Dota 2.
            </p>
            <p>
              By creating a squad name, manager bio, or submitting feedback, you grant us a perpetual, non-exclusive,
              royalty-free license to display your squad name, manager handle, avatar, and match scores across public
              leaderboards and match summaries.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">6. Service Availability & Disclaimers</h2>
            <p>
              Fantasy Dota 2 is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of
              any kind, either express or implied.
            </p>
            <p>
              While we strive for 100% uptime, we do not guarantee uninterrupted access. We are not liable for delayed match
              updates, provider API outages, scheduled maintenance, or network errors that prevent lineup submissions before a
              deadline.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, Fantasy Dota 2, its developers, and contributors shall not
              be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or
              inability to use the platform. Fantasy Dota 2 is a free entertainment application; fantasy points and virtual
              ranks possess no real-world monetary value.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">8. Account Termination & Suspension</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms of Service, engage in fraudulent
              behavior, or disrupt the community experience. Terminated accounts forfeit active squad registrations and
              leaderboard standings.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">9. Changes to Terms</h2>
            <p>
              We may revise these Terms of Service periodically to reflect gameplay updates or regulatory requirements. Material
              revisions will be noted by updating the &ldquo;Last updated&rdquo; date at the top of this page. Your continued use of
              the platform after revisions are published constitutes your acceptance of the new terms.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">10. Contact Us</h2>
            <p>
              If you have any questions regarding these Terms of Service, please contact us through the in-app Issue Reporter
              or contact the platform administration.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}