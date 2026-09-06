/**
 * Supabase Server-side Client
 * 
 * Used for background jobs and server-side operations
 * Initializes Supabase client with environment variables
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let supabaseClient: any = null;

/**
 * Get or create Supabase server client
 * Reuses singleton instance for efficiency
 */
export function getSupabaseServerClient(): any {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key on the server to bypass RLS for background workers and system jobs
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serverKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  supabaseClient = createClient<Database>(url, serverKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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
