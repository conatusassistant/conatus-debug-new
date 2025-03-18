import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

// Add these debugging lines
console.log("Environment variables check:");
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Define hardcoded values
const HARDCODED_URL = "https://rtukhuijpcljqzqkqoxz.supabase.co";
const HARDCODED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0dWtodWlqcGNsanF6cWtxb3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMyMjAwOCwiZXhwIjoyMDU3ODk4MDA4fQ.cP1BcOP1lJ_3f0UDLIE5iu1puNXWwlf-gLEUGW5-Jx4";  // Replace with your actual key

// Use environment variables if available, otherwise use hardcoded values
const supabaseUrl = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL 
  : HARDCODED_URL;

const supabaseAnonKey = typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string'
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : HARDCODED_KEY;

console.log("Final values being used:");
console.log("URL:", supabaseUrl);
console.log("KEY:", supabaseAnonKey);

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