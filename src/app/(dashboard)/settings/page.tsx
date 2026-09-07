'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme, type Theme } from '@/components/theme/ThemeProvider';

type SettingsTab = 'overview' | 'account' | 'profile' | 'notifications' | 'security';

const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400';

const tabs: Array<{ key: SettingsTab; label: string; description: string }> = [
  { key: 'overview', label: 'Overview', description: 'Account status and quick actions' },
  { key: 'account', label: 'Account', description: 'Username, email, and region' },
  { key: 'profile', label: 'Edit Profile', description: 'Display name and appearance' },
  { key: 'notifications', label: 'Notifications', description: 'Alert delivery preferences' },
  { key: 'security', label: 'Security', description: 'Password and account protection' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const requestedSection = new URLSearchParams(window.location.search).get('section');
    return requestedSection === 'account' || requestedSection === 'profile' || requestedSection === 'notifications' || requestedSection === 'security'
      ? requestedSection
      : 'overview';
  });
  const [formData, setFormData] = useState({
    displayName: '',
    countryCode: '',
    timezone: 'UTC',
    emailNotifications: true,
    pushNotifications: true,
  });
  const [accountData, setAccountData] = useState({ username: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: { display_name?: string | null; username?: string; email?: string; country_code?: string | null; timezone?: string | null } };
        const profile = data.profile;
        if (!profile) return;
        setAccountData({ username: profile.username || '', email: profile.email || '' });
        setFormData((current) => ({
          ...current,
          displayName: profile.display_name || profile.username || '',
          countryCode: profile.country_code || 'US',
          timezone: profile.timezone || 'UTC',
        }));
      } catch {
        setMessage('Unable to load profile preferences');
        setMessageIsError(true);
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const changeTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'overview') url.searchParams.delete('section');
    else url.searchParams.set('section', tab);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setMessageIsError(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: formData.displayName,
        }),
      });

      if (!res.ok) throw new Error('Unable to save profile');
      setMessage('Profile preferences saved successfully');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Profile update failed');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (nextTheme: Theme) => {
    setThemeSaving(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await setTheme(nextTheme);
      setMessage(`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme saved`);
    } catch {
      setMessage('Theme preference could not be saved');
      setMessageIsError(true);
    } finally {
      setThemeSaving(false);
    }
  };

  const handleAccountSave = async () => {
    setSaving(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: accountData.username,
          country_code: formData.countryCode,
          timezone: formData.timezone,
        }),
      });
      const data = (await res.json()) as { profile?: { username?: string; email?: string }; error?: string };
      if (!res.ok || !data.profile) throw new Error(data.error || 'Unable to save account details');
      setAccountData({ username: data.profile.username || accountData.username, email: data.profile.email || accountData.email });
      setMessage('Account details saved successfully');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Account update failed');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const renderToggle = (label: string, description: string, enabled: boolean, onToggle: () => void) => (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div>
        <h3 className="font-semibold text-white">{label}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <button type="button" onClick={onToggle} aria-pressed={enabled} className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-cyan-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Personal control center</p>
          <h1 className="text-3xl font-black text-white">Settings</h1>
          <p className="mt-2 text-sm text-slate-400">Tune your fantasy identity, alerts, appearance, and account protection.</p>
        </div>
        <Link href="/profile" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">View profile →</Link>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Account</p>
          <p className="mt-2 font-semibold text-emerald-300">Authenticated and active</p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Appearance</p>
          <p className="mt-2 font-semibold capitalize text-cyan-200">{theme} theme</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Alerts</p>
          <p className="mt-2 font-semibold text-amber-200">{formData.pushNotifications || formData.emailNotifications ? 'Enabled' : 'Paused'}</p>
        </div>
      </section>

      {message && <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${messageIsError ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'}`}>{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit rounded-2xl border border-slate-800 bg-slate-900/70 p-2" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => changeTab(tab.key)} className={`mb-1 w-full rounded-xl border-l-2 px-4 py-3 text-left transition last:mb-0 ${activeTab === tab.key ? 'border-cyan-400 bg-cyan-500/10 text-white' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{tab.description}</span>
            </button>
          ))}
        </nav>

        <main className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 md:p-8">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-bold text-white">Account overview</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Your core settings are organised here so you can quickly review what is active and jump to the section that needs attention.</p>
              <div className="mt-6 space-y-3">
                {[
                  ['Profile identity', formData.displayName ? 'Configured' : 'Needs attention', formData.displayName],
                  ['Regional settings', formData.countryCode && formData.timezone ? 'Configured' : 'Needs attention', Boolean(formData.countryCode && formData.timezone)],
                  ['Notification channels', formData.pushNotifications || formData.emailNotifications ? 'At least one channel active' : 'All channels paused', formData.pushNotifications || formData.emailNotifications],
                  ['Theme preference', `${theme} mode active`, true],
                ].map(([label, status, complete]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <span className="text-sm text-slate-300">{String(label)}</span>
                    <span className={complete ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}>{String(status)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => changeTab('account')} className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Review account</button>
                <button type="button" onClick={() => changeTab('notifications')} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500">Manage alerts</button>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <h2 className="text-xl font-bold text-white">Account details</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Manage the login identity and regional information connected to your fantasy account.</p>
              <div className="mt-6 space-y-5">
                <div>
                  <label htmlFor="settings-username" className="mb-2 block text-sm font-medium text-slate-300">Username</label>
                  <input id="settings-username" value={accountData.username} onChange={(event) => setAccountData({ ...accountData, username: event.target.value })} className={inputClass} />
                  <p className="mt-2 text-xs text-slate-500">Your username identifies you across leagues and account menus.</p>
                </div>
                <div>
                  <label htmlFor="settings-email" className="mb-2 block text-sm font-medium text-slate-300">Login email</label>
                  <input id="settings-email" type="email" value={accountData.email} disabled className={`${inputClass} cursor-not-allowed text-slate-500`} />
                  <p className="mt-2 text-xs text-slate-500">Email changes are managed securely through Supabase Auth.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="settings-account-country" className="mb-2 block text-sm font-medium text-slate-300">Country or region</label>
                    <select id="settings-account-country" value={formData.countryCode} onChange={(event) => setFormData({ ...formData, countryCode: event.target.value })} className={inputClass}>
                      <option value="US">United States</option><option value="UK">United Kingdom</option><option value="CN">China</option><option value="RU">Russia</option><option value="PH">Philippines</option><option value="PE">Peru</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="settings-account-timezone" className="mb-2 block text-sm font-medium text-slate-300">Timezone</label>
                    <select id="settings-account-timezone" value={formData.timezone} onChange={(event) => setFormData({ ...formData, timezone: event.target.value })} className={inputClass}>
                      <option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="Europe/London">London</option><option value="Europe/Berlin">Central Europe</option><option value="Asia/Manila">Manila</option><option value="Asia/Singapore">Singapore</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
                  <button onClick={handleAccountSave} disabled={saving} className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">{saving ? 'Saving account...' : 'Save account details'}</button>
                  <Link href="/forgot-password" className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-white">Reset password</Link>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <h2 className="text-xl font-bold text-white">Profile and appearance</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Update the identity and regional details shown across your fantasy experience.</p>
              <div className="mt-6 space-y-5">
                <div>
                  <label htmlFor="settings-display-name" className="mb-2 block text-sm font-medium text-slate-300">Display name</label>
                  <input id="settings-display-name" type="text" value={formData.displayName} onChange={(event) => setFormData({ ...formData, displayName: event.target.value })} className={inputClass} />
                  <p className="mt-2 text-xs text-slate-500">This is how you appear on leaderboards and in leagues.</p>
                </div>
                <div className="border-t border-slate-800 pt-6">
                  <h3 className="font-semibold text-white">Appearance</h3>
                  <p className="mt-1 text-sm text-slate-400">Choose the interface theme saved to your account.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(['light', 'dark'] as Theme[]).map((option) => (
                      <button key={option} type="button" disabled={themeSaving} onClick={() => void handleThemeChange(option)} className={`rounded-xl border p-4 text-left transition ${theme === option ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600'}`}>
                        <span className="block font-semibold capitalize">{option} mode</span>
                        <span className="mt-1 block text-xs text-slate-500">{option === 'dark' ? 'Low-light competitive interface' : 'Bright, high-contrast interface'}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">{saving ? 'Saving changes...' : 'Save profile changes'}</button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold text-white">Notification preferences</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Choose the channels you want to keep active for important fantasy updates.</p>
              <div className="mt-6 space-y-3">
                {renderToggle('Push notifications', 'Receive device alerts for deadlines, price changes, and important fantasy actions.', formData.pushNotifications, () => setFormData({ ...formData, pushNotifications: !formData.pushNotifications }))}
                {renderToggle('Email summaries', 'Receive weekly summaries and important account updates by email.', formData.emailNotifications, () => setFormData({ ...formData, emailNotifications: !formData.emailNotifications }))}
              </div>
              <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">These controls currently apply to this session UI. Delivery preferences can be persisted when the notification preference API is connected.</div>
              <Link href="/notifications" className="mt-5 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open notification center →</Link>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className="text-xl font-bold text-white">Security and sessions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Keep your fantasy account protected with the authenticated password reset flow.</p>
              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="font-semibold text-emerald-200">Session active</p>
                  <p className="mt-1 text-sm text-slate-400">Your current session is authenticated and protected by Supabase Auth.</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="font-semibold text-white">Password access</p>
                  <p className="mt-1 text-sm text-slate-400">Use the reset flow to choose a new password securely.</p>
                  <Link href="/forgot-password" className="mt-4 inline-flex rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-white">Reset password</Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
