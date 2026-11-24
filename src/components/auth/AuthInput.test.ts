import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('AuthInput', () => {
  it('associates hints and field errors with the input', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { AuthInput } = await import('./AuthInput');
    const markup = renderToStaticMarkup(
      React.createElement(AuthInput, {
        id: 'confirm-password',
        name: 'confirm-password',
        type: 'password',
        label: 'Confirm password',
        value: 'short',
        onChange: jest.fn(),
        hint: 'Use at least 8 characters.',
        error: 'The passwords do not match.',
      }),
    );

    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="confirm-password-hint confirm-password-error"');
    expect(markup).toContain('id="confirm-password-hint"');
    expect(markup).toContain('id="confirm-password-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('The passwords do not match.');
  });
});
