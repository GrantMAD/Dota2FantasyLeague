import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

export async function GET() {
  try {
    const cacheKey = 'leaderboard:countries';
    const cached = getCached<{ countries: { code: string; name: string }[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = supabaseServer();
    
    // Fetch distinct non-null countries from profiles
    // Supabase doesn't have a native SELECT DISTINCT, so we fetch all and filter in memory.
    // For large tables, an RPC function or a dedicated 'countries' materialized view is better,
    // but for user profiles this is lightweight enough.
    const { data, error } = await supabase
      .from('users')
      .select('country_code')
      .not('country_code', 'is', null);

    if (error) {
      throw error;
    }

    const uniqueCountries = Array.from(new Set(data.map((row) => row.country_code)));
    
    // Optionally map country codes to names if needed, or just return the codes
    // The current UI uses codes and names. For now we will return both.
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    
    const countries = uniqueCountries
      .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
      .map(code => {
        let name = code;
        try {
          name = displayNames.of(code.toUpperCase()) || code;
        } catch (e) {
          // ignore invalid codes
        }
        return {
          code: code.toUpperCase(),
          name
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const result = { countries };
    // Cache for 1 hour since countries rarely change
    setCached(cacheKey, result, 3600_000);
    
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
