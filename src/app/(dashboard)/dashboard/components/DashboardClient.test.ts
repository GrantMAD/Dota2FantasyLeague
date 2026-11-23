import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('DashboardGreeting', () => {
  it('shows a reserved manager-name skeleton while dashboard data loads', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardGreeting } = await import('./DashboardGreeting');
    const markup = renderToStaticMarkup(
      React.createElement(DashboardGreeting, { loading: true, displayName: null }),
    );

    expect(markup).toContain('Welcome back');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Loading manager name');
    expect(markup).toContain('animate-pulse');
  });

  it('shows the manager name or a safe fallback after loading', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardGreeting } = await import('./DashboardGreeting');
    const namedMarkup = renderToStaticMarkup(
      React.createElement(DashboardGreeting, { loading: false, displayName: 'Teal Manager' }),
    );
    const fallbackMarkup = renderToStaticMarkup(
      React.createElement(DashboardGreeting, { loading: false, displayName: null }),
    );

    expect(namedMarkup).toContain('Welcome back, Teal Manager');
    expect(namedMarkup).toContain('aria-busy="false"');
    expect(fallbackMarkup).toContain('Welcome back, Manager');
  });
});

describe('DashboardErrorAlert', () => {
  it('announces dashboard load failures and exposes an accessible retry action', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardErrorAlert } = await import('./DashboardErrorAlert');
    const markup = renderToStaticMarkup(
      React.createElement(DashboardErrorAlert, {
        error: 'Request failed',
        loading: false,
        onRetry: () => undefined,
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Dashboard data could not be loaded');
    expect(markup).toContain('Request failed');
    expect(markup).toContain('aria-label="Retry dashboard data"');
    expect(markup).toContain('>Retry</button>');
  });

  it('keeps the alert visible and disables retry while a retry is running', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardErrorAlert } = await import('./DashboardErrorAlert');
    const markup = renderToStaticMarkup(
      React.createElement(DashboardErrorAlert, {
        error: 'Request failed',
        loading: true,
        onRetry: () => undefined,
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('>Retrying…</button>');
  });
});

describe('DashboardLineupProgress', () => {
  it('communicates the filled slots and renders five progress segments', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardLineupProgress } = await import('./DashboardLineupProgress');
    const markup = renderToStaticMarkup(
      React.createElement(DashboardLineupProgress, { starterCount: 3 }),
    );

    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-valuenow="3"');
    expect(markup).toContain('aria-valuetext="3 of 5 starting slots filled"');
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(5);
  });
});

describe('DashboardCaptainGuide', () => {
  it('provides keyboard-accessible captain multiplier guidance in a collapsed disclosure', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardCaptainGuide } = await import('./DashboardCaptainGuide');
    const markup = renderToStaticMarkup(React.createElement(DashboardCaptainGuide));

    expect(markup).toContain('<details');
    expect(markup).toContain('<summary');
    expect(markup).toContain('How captain scoring works');
    expect(markup).toContain('Your Captain earns 2× their fantasy points.');
    expect(markup).toContain('your Vice-Captain inherits the multiplier');
    expect(markup).not.toContain('<details open');
  });
});

describe('DashboardStarterStrip', () => {
  it('keeps starter cards in a scrollable strip on narrow screens and a five-column grid on wide screens', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardStarterStrip } = await import('./DashboardStarterStrip');
    const starters = ['carry', 'mid', 'offlane', 'support', 'hard_support'].map((slot, index) => ({
      id: index + 1,
      slot,
      name: `Player ${index + 1}`,
      primary_role: slot,
    }));
    const markup = renderToStaticMarkup(
      React.createElement(DashboardStarterStrip, {
        starters,
        onOpenPlayer: () => undefined,
      }),
    );

    expect(markup).toContain('aria-label="Starting Five player cards"');
    expect(markup).toContain('overflow-x-auto');
    expect(markup).toContain('xl:grid-cols-5');
    expect(markup).toContain('w-[220px]');
    expect(markup.match(/aria-label="View Player \d player details"/g)).toHaveLength(5);
  });
});
