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
