import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

// Define fallback values for development only
// These should be replaced with proper environment variables in production
const FALLBACK_URL = "https://rtukhuijpcljqzqkqoxz.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0dWtodWlqcGNsanF6cWtxb3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMyMjAwOCwiZXhwIjoyMDU3ODk4MDA4fQ.cP1BcOP1lJ_3f0UDLIE5iu1puNXWwlf-gLEUGW5-Jx4";

// Check if environment variables are present
const isEnvMissing = typeof process.env.NEXT_PUBLIC_SUPABASE_URL !== 'string' || 
                    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'string';

// Use environment variables if available, otherwise use fallback values
const supabaseUrl = isEnvMissing ? FALLBACK_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = isEnvMissing ? FALLBACK_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Log only in development environment
if (process.env.NODE_ENV === 'development' && isEnvMissing) {
  console.warn(
    "Supabase environment variables are missing. Using fallback values for development. " +
    "Make sure to create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for production."
  );
}

/**
 * Create a Supabase client for use in the browser.
 * This client has anonymous privileges and should be used for all client-side operations.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Helper function to get the user from Supabase auth
 * @returns The current user or null if not logged in
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Helper function to check if the user is logged in
 * @returns Boolean indicating if the user is logged in
 */
export async function isLoggedIn() {
  const user = await getCurrentUser();
  return !!user;
}

export default supabase;