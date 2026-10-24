'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import { useSearchParams } from 'next/navigation';
import { useTheme, type Theme } from '@/components/theme/ThemeProvider';
import { useToast } from '@/components/Toast';
import { PROFILE_UPDATED_EVENT } from '@/components/header-types';
import { getCountryOptions } from '@/lib/country-options';
import {
  LayoutDashboard,
  User,
  UserPen,
  Bell,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Moon,
  Sun,
  KeyRound,
  ArrowRight,
  Globe,
  Clock,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Sparkles,
  Check
} from 'lucide-react';

type SettingsTab = 'overview' | 'account' | 'profile' | 'notifications' | 'security';

const inputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20';
const countryOptions = getCountryOptions();

const tabs: Array<{
  key: SettingsTab;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: 'overview', label: 'Overview', description: 'Account status and quick actions', icon: LayoutDashboard },
  { key: 'account', label: 'Account', description: 'Username, email, and region', icon: User },
  { key: 'profile', label: 'Edit Profile', description: 'Display name and appearance', icon: UserPen },
  { key: 'notifications', label: 'Notifications', description: 'Alert delivery preferences', icon: Bell },
  { key: 'security', label: 'Security', description: 'Password and account protection', icon: Shield },
];

function SettingsContent() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section');
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    return requestedSection === 'account' || requestedSection === 'profile' || requestedSection === 'notifications' || requestedSection === 'security'
      ? requestedSection
      : 'overview';
  });
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    displayName: '',
    avatarUrl: null as string | null,
    countryCode: '',
    timezone: 'UTC',
    emailNotifications: true,
    pushNotifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setMessage(null);
    setMessageIsError(false);

    try {
      const res = await fetchWithAuth('/api/user/profile');
      if (!res.ok) throw new Error('Failed to load profile preferences');
      const data = (await res.json()) as {
        profile?: {
          display_name?: string | null;
          avatar_url?: string | null;
          username?: string;
          email?: string;
          country_code?: string | null;
          timezone?: string | null;
          email_notifications?: boolean | null;
          push_notifications?: boolean | null;
        };
      };
      const profile = data.profile;
      if (!profile) throw new Error('No profile record found');
      setFormData((current) => ({
        ...current,
        username: profile.username || '',
        email: profile.email || '',
        displayName: profile.display_name || profile.username || '',
        avatarUrl: profile.avatar_url || null,
        countryCode: profile.country_code || 'US',
        timezone: profile.timezone || 'UTC',
        emailNotifications: profile.email_notifications ?? true,
        pushNotifications: profile.push_notifications ?? true,
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to load profile preferences';
      setLoadError(errMsg);
      setMessage(errMsg);
      setMessageIsError(true);
      toast.error('Settings Error', 'Unable to load your profile settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let ignore = false;

    async function loadInitialProfile() {
      try {
        const res = await fetchWithAuth('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile preferences');
        const data = (await res.json()) as {
          profile?: {
            display_name?: string | null;
            avatar_url?: string | null;
            username?: string;
            email?: string;
            country_code?: string | null;
            timezone?: string | null;
            email_notifications?: boolean | null;
            push_notifications?: boolean | null;
          };
        };
        const profile = data.profile;
        if (!profile) throw new Error('No profile record found');
        if (!ignore) {
          setFormData((current) => ({
            ...current,
            username: profile.username || '',
            email: profile.email || '',
            displayName: profile.display_name || profile.username || '',
            avatarUrl: profile.avatar_url || null,
            countryCode: profile.country_code || 'US',
            timezone: profile.timezone || 'UTC',
            emailNotifications: profile.email_notifications ?? true,
            pushNotifications: profile.push_notifications ?? true,
          }));
        }
      } catch (err: unknown) {
        if (!ignore) {
          const errMsg = err instanceof Error ? err.message : 'Unable to load profile preferences';
          setLoadError(errMsg);
          setMessage(errMsg);
          setMessageIsError(true);
          toast.error('Settings Error', 'Unable to load your profile settings. Please try again.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitialProfile();

    return () => {
      ignore = true;
    };
  }, [toast]);

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
      const res = await fetchWithAuth('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          display_name: formData.displayName,
          country_code: formData.countryCode,
          timezone: formData.timezone,
          email_notifications: formData.emailNotifications,
          push_notifications: formData.pushNotifications,
        }),
      });

      const data = (await res.json()) as {
        profile?: {
          username?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        error?: string;
      };
      if (!res.ok || !data.profile) throw new Error(data.error || 'Unable to save settings');
      setFormData((current) => ({
        ...current,
        username: data.profile?.username || current.username,
        email: data.profile?.email || current.email,
      }));
      window.dispatchEvent(
        new CustomEvent(PROFILE_UPDATED_EVENT, {
          detail: {
            username: data.profile.username,
            display_name: data.profile.display_name,
            avatar_url: data.profile.avatar_url,
          },
        })
      );
      setMessage('Settings saved successfully');
      toast.success('Settings Saved', 'Your changes have been applied.');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Settings update failed';
      setMessage(errMsg);
      setMessageIsError(true);
      toast.error('Save Failed', errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported Image', 'Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      toast.error('Image Too Large', 'Choose an image that is 5 MB or smaller.');
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const response = await fetchWithAuth('/api/user/avatar', { method: 'POST', body });
      const data = (await response.json()) as { avatar_url?: string; error?: string };
      if (!response.ok || !data.avatar_url) throw new Error(data.error || 'Unable to upload profile image');

      setFormData((current) => ({ ...current, avatarUrl: data.avatar_url ?? null }));
      window.dispatchEvent(
        new CustomEvent(PROFILE_UPDATED_EVENT, {
          detail: { avatar_url: data.avatar_url },
        })
      );
      toast.success('Profile Image Updated', 'Your new profile image is now in use.');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unable to upload profile image';
      toast.error('Upload Failed', errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (key: 'pushNotifications' | 'emailNotifications', nextVal: boolean) => {
    const updated = {
      ...formData,
      [key]: nextVal,
    };
    setFormData(updated);

    const label = key === 'pushNotifications' ? 'Push alerts' : 'Email digests';
    try {
      const res = await fetchWithAuth('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_notifications: updated.emailNotifications,
          push_notifications: updated.pushNotifications,
        }),
      });

      if (!res.ok) throw new Error('Failed to save notification preference');
      toast.info('Notification Preference', `${label} ${nextVal ? 'enabled' : 'disabled'}.`);
    } catch (error: unknown) {
      setFormData(formData);
      const errMsg = error instanceof Error ? error.message : 'Failed to save preference';
      toast.error('Save Failed', errMsg);
    }
  };

  const handleThemeChange = async (nextTheme: Theme) => {
    setThemeSaving(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await setTheme(nextTheme);
      setMessage(`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme saved`);
      toast.info('Theme Updated', `Switched to ${nextTheme} mode.`);
    } catch {
      setMessage('Theme preference could not be saved');
      setMessageIsError(true);
      toast.error('Save Failed', 'Theme preference could not be saved');
    } finally {
      setThemeSaving(false);
    }
  };

  const renderToggle = (label: string, description: string, enabled: boolean, onToggle: () => void, unavailable = false) => (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition-all hover:border-slate-500/40">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{label}</h3>
          {unavailable && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Coming Soon
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={unavailable ? undefined : enabled}
        disabled={unavailable}
        aria-label={`${label}${unavailable ? ', not available yet' : ''}`}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40 ${
          !unavailable && enabled ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
            !unavailable && enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header with Title and Profile Link */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-400">
            Personal control center
          </p>
          <h1 className="text-3xl font-black text-[var(--text-primary)]">Settings</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Tune your fantasy identity, alerts, appearance, and account protection.
          </p>
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
        >
          View profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Quick Status Cards Banner */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4.5 backdrop-blur-sm transition-all hover:border-emerald-500/40">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Account</p>
          </div>
          <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-300">Authenticated & Active</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4.5 backdrop-blur-sm transition-all hover:border-cyan-500/40">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Appearance</p>
          </div>
          <p className="mt-2 font-bold capitalize text-cyan-700 dark:text-cyan-300">{theme} theme</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4.5 backdrop-blur-sm transition-all hover:border-amber-500/40">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Alerts</p>
          </div>
          <p className="mt-2 font-bold text-amber-700 dark:text-amber-300">In-app alerts active</p>
        </div>
      </section>

      {/* Error Callout Banner */}
      {loadError && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-rose-700 dark:text-rose-300">Unable to load profile preferences</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Styled Success & Error Alerts */}
      {message && !loadError && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4.5 text-sm shadow-sm transition-all ${
            messageIsError
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {messageIsError ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="font-semibold">{message}</span>
        </div>
      )}

      {/* Main Settings Navigation & Content Layout */}
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* Sleek Vertical Tab Navigation */}
        <nav
          className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-sm space-y-1.5"
          aria-label="Settings sections"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => changeTab(tab.key)}
                className={`relative group w-full rounded-xl px-3.5 py-3 text-left transition-all duration-200 flex items-center gap-3.5 ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
                }`}
              >
                {/* Active Left-Edge Accent Indicator */}
                <div
                  className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-200 ${
                    isActive ? 'bg-gradient-to-b from-cyan-400 to-teal-500 opacity-100' : 'opacity-0'
                  }`}
                />
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300'
                      : 'bg-[var(--surface-raised)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight">{tab.label}</span>
                  <span className="mt-1 block truncate text-[11px] leading-tight text-[var(--text-muted)]">
                    {tab.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Content Panel */}
        <main className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 shadow-sm">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Account overview</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Your core settings are organised here so you can quickly review what is active and jump to the section that needs attention.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Profile identity',
                    status: formData.displayName ? 'Configured' : 'Needs attention',
                    complete: Boolean(formData.displayName),
                    tabTarget: 'profile' as SettingsTab,
                  },
                  {
                    label: 'Regional settings',
                    status: formData.countryCode && formData.timezone ? 'Configured' : 'Needs attention',
                    complete: Boolean(formData.countryCode && formData.timezone),
                    tabTarget: 'account' as SettingsTab,
                  },
                  {
                    label: 'Notification channels',
                    status: 'In-app alerts available; email & push in development',
                    complete: true,
                    tabTarget: 'notifications' as SettingsTab,
                  },
                  {
                    label: 'Theme preference',
                    status: `${theme.charAt(0).toUpperCase() + theme.slice(1)} mode active`,
                    complete: true,
                    tabTarget: 'profile' as SettingsTab,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={() => changeTab(item.tabTarget)}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4.5 py-3.5 transition-all hover:border-slate-500/40"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          item.complete
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.complete ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          item.complete
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {item.status}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => changeTab('account')}
                  className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 shadow-md"
                >
                  Review account
                </button>
                <button
                  type="button"
                  onClick={() => changeTab('notifications')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-slate-500"
                >
                  Manage alerts
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Account details</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Manage the login identity and regional information connected to your fantasy account.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="settings-username" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                    Username
                  </label>
                  <input
                    id="settings-username"
                    value={formData.username}
                    onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                    className={inputClass}
                    placeholder="Enter your username"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    Your username identifies you across leagues, leaderboards, and account menus.
                  </p>
                </div>

                <div>
                  <label htmlFor="settings-email" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                    Login email
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={formData.email}
                    disabled
                    className={`${inputClass} cursor-not-allowed opacity-70`}
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    Email changes are managed securely through Supabase Auth authentication.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="settings-account-country" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                      <Globe className="h-4 w-4 text-cyan-500" /> Country or region
                    </label>
                    <select
                      id="settings-account-country"
                      value={formData.countryCode}
                      onChange={(event) => setFormData({ ...formData, countryCode: event.target.value })}
                      className={inputClass}
                    >
                      {countryOptions.map(({ code, name }) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="settings-account-timezone" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                      <Clock className="h-4 w-4 text-cyan-500" /> Timezone
                    </label>
                    <select
                      id="settings-account-timezone"
                      value={formData.timezone}
                      onChange={(event) => setFormData({ ...formData, timezone: event.target.value })}
                      className={inputClass}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Berlin">Central Europe (CET)</option>
                      <option value="Asia/Manila">Manila (PHT)</option>
                      <option value="Asia/Singapore">Singapore (SGT)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60 shadow-md"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? 'Saving settings...' : 'Save account details'}
                  </button>
                  <Link
                    href="/forgot-password"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4.5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-cyan-500 hover:text-cyan-500"
                  >
                    <KeyRound className="h-4 w-4" /> Reset password
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EDIT PROFILE & APPEARANCE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Profile and appearance</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Update the identity and visual style displayed across your fantasy experience.
                </p>
              </div>

              <div className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:flex-row sm:items-center">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--surface-muted)] text-2xl font-black text-cyan-600 dark:text-cyan-300 shadow-md">
                    {formData.avatarUrl ? (
                      <Image
                        src={formData.avatarUrl}
                        alt="Current profile image"
                        width={80}
                        height={80}
                        unoptimized={!canOptimizeImage(formData.avatarUrl)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (formData.displayName || formData.username || 'U').slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="settings-avatar" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                      Profile image
                    </label>
                    <input
                      id="settings-avatar"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={saving}
                      onChange={(event) => {
                        void handleAvatarUpload(event.currentTarget.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                      className="block w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-secondary)] file:mr-3 file:cursor-pointer file:border-0 file:bg-cyan-500 file:px-4 file:py-2.5 file:font-bold file:text-slate-950 hover:file:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
                    />
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      JPEG, PNG, or WebP · 5 MB maximum. Uploading a new image updates your avatar everywhere in real-time.
                    </p>
                  </div>
                </div>

                {/* Display Name Input */}
                <div>
                  <label htmlFor="settings-display-name" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                    Display name
                  </label>
                  <input
                    id="settings-display-name"
                    type="text"
                    value={formData.displayName}
                    onChange={(event) => setFormData({ ...formData, displayName: event.target.value })}
                    className={inputClass}
                    placeholder="Enter your public display name"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    This is the name rivals see on match rosters, leaderboards, and private leagues.
                  </p>
                </div>

                {/* Visual Theme Selector Cards */}
                <div className="border-t border-[var(--border)] pt-6">
                  <div className="mb-4">
                    <h3 className="font-bold text-[var(--text-primary)]">Interface Theme</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Select your preferred contrast and aesthetic theme.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Dark Mode Card */}
                    <button
                      type="button"
                      disabled={themeSaving}
                      onClick={() => void handleThemeChange('dark')}
                      className={`group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                        theme === 'dark'
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                          : 'border-[var(--border)] bg-[var(--surface-raised)] hover:border-slate-500'
                      }`}
                    >
                      {/* Theme Preview Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 shadow-sm">
                            <Moon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-[var(--text-primary)] block">Dark Mode</span>
                            <span className="text-[11px] text-[var(--text-muted)]">Midnight & Neon Cyan</span>
                          </div>
                        </div>
                        {theme === 'dark' && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Visual UI Miniature Preview Mockup */}
                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-700/60 bg-[#07111f] p-3 text-[10px] space-y-2 pointer-events-none select-none">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-teal-400" />
                            <div className="h-2 w-12 rounded bg-slate-700" />
                          </div>
                          <div className="h-2 w-6 rounded bg-cyan-500/30" />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <div className="rounded bg-[#0d1b2e] border border-[#29415d] p-1.5">
                            <div className="h-1.5 w-6 rounded bg-slate-600 mb-1" />
                            <div className="h-2.5 w-8 rounded bg-teal-400 font-bold" />
                          </div>
                          <div className="rounded bg-[#0d1b2e] border border-[#29415d] p-1.5">
                            <div className="h-1.5 w-6 rounded bg-slate-600 mb-1" />
                            <div className="h-2.5 w-8 rounded bg-cyan-400 font-bold" />
                          </div>
                          <div className="rounded bg-[#0d1b2e] border border-[#29415d] p-1.5">
                            <div className="h-1.5 w-6 rounded bg-slate-600 mb-1" />
                            <div className="h-2.5 w-8 rounded bg-emerald-400 font-bold" />
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                        Deep midnight blue canvas with neon teal & cyan glowing accents. Optimized for low-light gaming setups.
                      </p>
                    </button>

                    {/* Light Mode Card */}
                    <button
                      type="button"
                      disabled={themeSaving}
                      onClick={() => void handleThemeChange('light')}
                      className={`group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                        theme === 'light'
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                          : 'border-[var(--border)] bg-[var(--surface-raised)] hover:border-slate-500'
                      }`}
                    >
                      {/* Theme Preview Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 border border-amber-300 text-amber-600 shadow-sm">
                            <Sun className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-[var(--text-primary)] block">Light Mode</span>
                            <span className="text-[11px] text-[var(--text-muted)]">Clean Slate & Cyan</span>
                          </div>
                        </div>
                        {theme === 'light' && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Visual UI Miniature Preview Mockup */}
                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-300 bg-[#e5ebf2] p-3 text-[10px] space-y-2 pointer-events-none select-none">
                        <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-teal-600" />
                            <div className="h-2 w-12 rounded bg-slate-300" />
                          </div>
                          <div className="h-2 w-6 rounded bg-cyan-600/30" />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <div className="rounded bg-[#f1f5f9] border border-[#c1cedb] p-1.5">
                            <div className="h-1.5 w-6 rounded bg-slate-400 mb-1" />
                            <div className="h-2.5 w-8 rounded bg-teal-700 font-bold" />
                          </div>
                          <div className="rounded bg-[#f1f5f9] border border-[#c1cedb] p-1.5">
                            <div className="h-1.5 w-6 rounded bg-slate-400 mb-1" />
                            <div className="h-2.5 w-8 rounded bg-cyan-700 font-bold" />
                          </div>
                          <div className="rounded bg-[#f1f5f9] border border-[#c1cedb] p-1.5">
                            <div className="h-1.5 w-6 rounded bg-emerald-700 font-bold" />
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                        Crisp light slate canvas with high-contrast typography and vivid teal accents. Easy reading in daylight.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60 shadow-md"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? 'Saving settings...' : 'Save profile changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Notification preferences</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  In-app notifications are delivered to your Notification Hub. External notification pipelines can be toggled below.
                </p>
              </div>

              <div className="space-y-3.5">
                {renderToggle(
                  'Push notifications',
                  'Receive real-time alerts on your mobile device or browser when fantasy rosters lock or market prices fluctuate.',
                  formData.pushNotifications,
                  () => void handleNotificationToggle('pushNotifications', !formData.pushNotifications),
                  true
                )}
                {renderToggle(
                  'Email summaries',
                  'Receive weekly gameweek recaps, transfer digest emails, and head-to-head match outcomes.',
                  formData.emailNotifications,
                  () => void handleNotificationToggle('emailNotifications', !formData.emailNotifications),
                  true
                )}
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4.5 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p>
                  These delivery channels are currently disabled so they do not imply automated external delivery is active. All in-app alerts, price updates, and gameweek notifications continue to operate seamlessly within your Notification Center.
                </p>
              </div>

              <div>
                <Link
                  href="/notifications"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                >
                  Open notification center <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Security and sessions</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Keep your fantasy account protected with authenticated sessions and secure credential management.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">Session active</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Your current session is cryptographically authenticated and protected by Supabase Auth with token rotation.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">Password & Credentials</p>
                      <p className="text-xs text-[var(--text-muted)]">Update or reset your master password</p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Use the secure password reset flow to generate a recovery email and configure new login credentials.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/forgot-password"
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-cyan-500 hover:text-cyan-500 shadow-xs"
                    >
                      <KeyRound className="h-4 w-4" /> Reset password
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
