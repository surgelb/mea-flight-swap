import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Export standard Supabase client. If keys are missing, return a dummy object that fails gracefully.
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : new Proxy({} as any, {
      get: () => {
        console.warn('Supabase env variables are missing. Operating in mock fallback mode.');
        return () => Promise.resolve({ data: null, error: new Error('Supabase client not initialized') });
      }
    });

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
