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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  supabaseClient = createClient<Database>(url, anonKey) as any;
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
