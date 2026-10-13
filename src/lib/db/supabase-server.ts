/**
 * Supabase Server-side Client
 * 
 * Used for background jobs and server-side operations
 * Initializes Supabase client with environment variables
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: any = null;

/**
 * Get or create Supabase server client
 * Reuses singleton instance for efficiency
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseServerClient(): any {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // This helper is for privileged server operations and must never silently use the public key.
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'Missing Supabase environment variable: NEXT_PUBLIC_SUPABASE_URL'
    );
  }

  if (!serverKey) {
    throw new Error(
      'Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY. The privileged server client requires this key.'
    );
  }

  supabaseClient = createClient<Database>(url, serverKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  return supabaseClient;
}

/**
 * Execute a database query with error handling
 */
export async function executeQuery<T>(
  query: Promise<{ data: T | null; error: Error | null }>
): Promise<T> {
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
  
  return data as T;
}
