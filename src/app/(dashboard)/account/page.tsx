'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AccountProfile = {
  username: string;
  email: string;
  display_name?: string | null;
  country_code: string | null;
  timezone: string | null;
  theme_preference?: 'light' | 'dark' | null;
};

const fieldClass = 'w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400';

export default function AccountPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

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
        setMessageIsError(true);
      } finally {
        setLoading(false);
      }
    }

    void loadAccount();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setMessageIsError(false);
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
      setMessage('Account details updated successfully');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to save account');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Account control center</p>
        <h1 className="text-3xl font-black text-white">Account</h1>
        <p className="mt-2 text-sm text-slate-400">Manage your login identity, regional settings, and account security.</p>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Account status</p>
          <p className="mt-2 font-semibold text-emerald-300">Active</p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Login email</p>
          <p className="mt-2 truncate font-semibold text-cyan-200">{profile?.email || 'Not available'}</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Preferences</p>
          <p className="mt-2 font-semibold text-amber-200">{profile?.theme_preference || 'dark'} theme</p>
        </div>
      </section>

      {message && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${messageIsError ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'}`}>
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 md:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Identity details</h2>
            <p className="mt-1 text-sm text-slate-400">These details identify you across leagues and leaderboards.</p>
          </div>
          <div className="space-y-5">
            <div>
              <label htmlFor="account-username" className="mb-2 block text-sm font-medium text-slate-300">Username</label>
              <input id="account-username" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="account-email" className="mb-2 block text-sm font-medium text-slate-300">Login email</label>
              <input id="account-email" type="email" value={profile?.email || ''} disabled className={`${fieldClass} cursor-not-allowed text-slate-500`} />
              <p className="mt-2 text-xs text-slate-500">Email changes are managed securely through Supabase Auth.</p>
            </div>
            <div>
              <label htmlFor="account-country" className="mb-2 block text-sm font-medium text-slate-300">Country or region</label>
              <select id="account-country" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className={fieldClass}>
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
              <select id="account-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className={fieldClass}>
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
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">
              {saving ? 'Saving changes...' : 'Save account details'}
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-bold text-white">Security</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Keep your credentials protected through the authenticated password reset flow.</p>
            <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">Your account session is active and authenticated.</div>
            <Link href="/forgot-password" className="mt-5 inline-flex rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white">Reset password</Link>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-bold text-white">Preferences</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Manage appearance and alert delivery in one place.</p>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <span className="text-sm text-slate-300">Theme and alerts</span>
              <Link href="/settings" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open settings →</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
