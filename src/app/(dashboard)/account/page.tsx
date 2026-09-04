'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AccountProfile = {
  username: string;
  email: string;
  country_code: string | null;
  timezone: string | null;
};

export default function AccountPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccount() {
      try {
        const response = await fetch('/api/user/profile');
        const data = (await response.json()) as { profile?: AccountProfile; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error || 'Unable to load account');
        setProfile(data.profile);
        setUsername(data.profile.username);
        setCountryCode(data.profile.country_code || '');
        setTimezone(data.profile.timezone || 'UTC');
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : 'Unable to load account');
      } finally {
        setLoading(false);
      }
    }

    void loadAccount();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, country_code: countryCode, timezone }),
      });
      const data = (await response.json()) as { profile?: AccountProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || 'Unable to save account');
      setProfile(data.profile);
      setUsername(data.profile.username);
      setMessage('Account details updated');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to save account');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Loading account...</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">Account</h1>
        <p className="text-slate-400">Manage your login identity and account details.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-6 text-xl font-bold text-white">Account Details</h2>
          {message && <p className="mb-4 text-sm text-amber-400">{message}</p>}
          <div className="space-y-5">
            <div>
              <label htmlFor="account-username" className="mb-2 block text-sm font-medium text-slate-300">Username</label>
              <input id="account-username" value={username} onChange={(event) => setUsername(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="account-email" className="mb-2 block text-sm font-medium text-slate-300">Email</label>
              <input id="account-email" type="email" value={profile?.email || ''} disabled className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-slate-400" />
              <p className="mt-2 text-xs text-slate-500">Email changes are managed through Supabase Auth.</p>
            </div>
            <div>
              <label htmlFor="account-country" className="mb-2 block text-sm font-medium text-slate-300">Country</label>
              <select id="account-country" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none">
                <option value="">Select country</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="CN">China</option>
                <option value="PH">Philippines</option>
                <option value="PE">Peru</option>
              </select>
            </div>
            <div>
              <label htmlFor="account-timezone" className="mb-2 block text-sm font-medium text-slate-300">Timezone</label>
              <select id="account-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none">
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Berlin">Central Europe</option>
                <option value="Asia/Manila">Manila</option>
                <option value="Asia/Singapore">Singapore</option>
              </select>
            </div>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-6 text-xl font-bold text-white">Security</h2>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Use the password reset flow to set a new password securely through Supabase Auth.</p>
            <Link href="/forgot-password" className="inline-flex rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-amber-500 hover:text-white">
              Reset Password
            </Link>
            <div className="border-t border-slate-700 pt-5">
              <p className="mb-3 text-sm text-slate-400">Profile editing, appearance, and notification preferences are available in Settings.</p>
              <Link href="/settings" className="text-sm font-medium text-amber-500 hover:text-amber-400">Open Settings</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
