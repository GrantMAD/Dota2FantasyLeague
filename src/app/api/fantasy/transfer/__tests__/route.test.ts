import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(),
}));

describe('Transfer API Route', () => {
  it('returns 401 if unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/fantasy/transfer', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
