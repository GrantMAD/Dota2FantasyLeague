import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' };

async function getHandler() {
  try {
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
        } catch {
          // ignore invalid codes
        }
        return {
          code: code.toUpperCase(),
          name
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const result = { countries };
    return NextResponse.json(result, {
      headers: PUBLIC_CACHE_HEADERS,
    });
  } catch (error: unknown) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/leaderboard/countries', getHandler);
