import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Fantasy Dota 2',
  description: 'Privacy policy and data handling information for the Fantasy Dota 2 platform.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl">
        <Link href="/" className="mb-8 inline-flex items-center text-sm font-medium text-amber-400 hover:text-amber-300">
          ← Back to home
        </Link>

        <h1 className="mb-6 text-4xl font-bold text-white">Privacy Policy</h1>
        <p className="mb-6 text-slate-300">
          This page is intentionally in place as a placeholder while the final privacy policy is prepared.
        </p>

        <div className="space-y-6 text-sm leading-7 text-slate-300">
          <p>
            We collect the information needed to run the fantasy platform, including account data, squad details,
            league participation, and match-related statistics required to calculate fantasy performance.
          </p>
          <p>
            We use this information to provide gameplay features, maintain account security, support league
            operations, and improve the product experience. We do not sell personal data to third parties.
          </p>
          <p>
            When we rely on third-party providers for data, we keep those integrations limited to the information
            required to operate the app and to deliver a functioning fantasy experience.
          </p>
          <p>
            If you choose to join the Premium waitlist, we store the email address you provide, your account ID, and
            the time you gave consent so we can manage your request for future Premium launch updates. Joining does
            not send an email. You can change the address or withdraw at any time using the waitlist controls on the
            Premium page; withdrawal deletes the waitlist entry.
          </p>
          <p>
            If you have questions about how your data is used, please contact the platform admin or support team.
          </p>
        </div>
      </div>
    </main>
  );
}
