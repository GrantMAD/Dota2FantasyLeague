'use client';

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface WaitlistResponse {
  waitlisted?: boolean;
  email?: string;
  error?: string;
}

const WaitlistOpenContext = createContext<((trigger: HTMLButtonElement) => void) | null>(null);

export function PremiumWaitlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(busy);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!isOpen) {
      triggerRef.current?.focus();
      return;
    }
    const dialog = dialogRef.current;
    const getFocusableElements = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      );
    getFocusableElements()?.[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (!focusableElements?.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  async function openDialog(trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setIsOpen(true);
    setLoadingStatus(true);
    setError(null);
    setFeedback(null);
    setEditing(false);
    setConfirmRemoval(false);
    try {
      const response = await fetchWithAuth('/api/premium/waitlist');
      const result = (await response.json()) as WaitlistResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to load waitlist status.');
      setEmail(result.email ?? '');
      setWaitlisted(result.waitlisted === true);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load waitlist status.');
    } finally {
      setLoadingStatus(false);
    }
  }

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetchWithAuth('/api/premium/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email, consent }),
      });
      const result = (await response.json()) as WaitlistResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to join the waitlist.');
      setEmail(email.trim().toLowerCase());
      setWaitlisted(true);
      setEditing(false);
      setConsent(false);
      setFeedback('You are on the Premium waitlist. No email has been sent.');
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to join the waitlist.');
    } finally {
      setBusy(false);
    }
  }

  async function removeWaitlistEntry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetchWithAuth('/api/premium/waitlist', { method: 'DELETE' });
      const result = (await response.json()) as WaitlistResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to remove your waitlist entry.');
      setWaitlisted(false);
      setEditing(false);
      setConfirmRemoval(false);
      setConsent(false);
      setFeedback('Your waitlist entry has been removed.');
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove your waitlist entry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <WaitlistOpenContext.Provider value={(trigger) => void openDialog(trigger)}>
      {children}
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!busy) setIsOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-waitlist-title"
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Premium updates</p>
                <h2 id="premium-waitlist-title" className="mt-2 text-2xl font-bold text-white">
                  Join the waitlist
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close waitlist dialog"
                disabled={busy}
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingStatus ? (
              <p role="status" className="mt-5 text-sm text-slate-300">Checking your waitlist status…</p>
            ) : waitlisted && !editing ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-6 text-slate-200">
                    <span className="font-semibold">{email}</span> is on the Premium waitlist.
                    We are not sending emails yet.
                  </p>
                </div>
                {feedback ? <p role="status" className="text-sm text-cyan-300">{feedback}</p> : null}
                {confirmRemoval ? (
                  <div className="space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="text-sm text-slate-200">Remove your email and withdraw your waitlist consent?</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeWaitlistEntry()}
                        className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                      >
                        {busy ? 'Removing…' : 'Confirm removal'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmRemoval(false)}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Keep me on the list
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setFeedback(null);
                      }}
                      className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoval(true)}
                      className="rounded-lg border border-rose-700/60 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-950/50"
                    >
                      Remove me
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={(event) => void submitWaitlist(event)}>
                <p className="text-sm leading-6 text-slate-300">
                  We will use this address only for Premium launch updates. Joining does not start a subscription,
                  and no email is sent now.
                </p>
                <div>
                  <label htmlFor="premium-waitlist-email" className="mb-1.5 block text-sm font-medium text-slate-200">
                    Email address
                  </label>
                  <input
                    id="premium-waitlist-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-amber-400"
                  />
                  <span className="text-sm leading-5 text-slate-300">
                    I agree to receive Premium launch updates at this address. I can remove my waitlist entry at any time.{' '}
                    <Link href="/privacy" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
                      Privacy policy
                    </Link>
                  </span>
                </label>
                {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
                {feedback ? <p role="status" className="text-sm text-cyan-300">{feedback}</p> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {waitlisted ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(false);
                        setConsent(false);
                        setError(null);
                      }}
                      className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={busy || !consent}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : waitlisted ? 'Update email' : 'Join waitlist'}
                    {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>
                </div>
              </form>
            )}
            {!loadingStatus && error && waitlisted && !editing ? (
              <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>
            ) : null}
          </section>
        </div>
      ) : null}
    </WaitlistOpenContext.Provider>
  );
}

export function PremiumWaitlistButton({
  id,
  className,
}: {
  id: string;
  className: string;
}) {
  const openDialog = useContext(WaitlistOpenContext);
  if (!openDialog) throw new Error('PremiumWaitlistButton must be rendered within PremiumWaitlistProvider.');
  return (
    <button id={id} type="button" onClick={(event) => openDialog(event.currentTarget)} className={className}>
      Join the waitlist <ArrowRight className="h-4 w-4" />
    </button>
  );
}
