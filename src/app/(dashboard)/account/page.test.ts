import { redirect } from 'next/navigation';
import AccountPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('/account compatibility redirect', () => {
  it('redirects to the account section in Settings', () => {
    expect(() => AccountPage()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/settings?section=account');
  });
});
