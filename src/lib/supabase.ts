import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Log connection info without exposing full key
console.log(`Connecting to Supabase URL: ${supabaseUrl}`);
console.log(`Using Supabase key: ${supabaseAnonKey.substring(0, 10)}...`);

// Client for regular user operations
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: {
        // Use local storage for session persistence
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch (error) {
            console.error('Error accessing localStorage:', error);
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            console.error('Error setting localStorage:', error);
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.error('Error removing from localStorage:', error);
          }
        }
      }
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js/2.x'
      }
    },
    // Add better fetch options with timeout
    fetch: (url, options) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      return fetch(url, { 
        ...options,
        signal: controller.signal,
        credentials: 'include' // Include credentials in requests
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    }
  }
);

// Add a helper function to check if Supabase is reachable
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    // Check browser online status first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.error('Browser is offline');
      return false;
    }

    // Use a simple test query that doesn't require authentication
    const response = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        // Try to fetch a small amount of data to verify the connection
        const { data, error } = await supabase
          .from('settings')
          .select('key')
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        
        clearTimeout(timeoutId);
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }, 3, 1000); // 3 retries with 1s initial delay
    
    return response;
  } catch (err) {
    console.error('Supabase connection check failed:', err);
    return false;
  }
};

// Helper to retry failed requests
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000
): Promise<T> => {
  let retries = 0;
  let lastError: any = null;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      retries++;
      
      if (retries >= maxRetries) {
        console.error(`All ${maxRetries} retries failed. Last error:`, error);
        throw new Error('Não foi possível conectar ao servidor após várias tentativas. Verifique sua conexão com a internet e tente novamente.');
      }
      
      // Exponential backoff with max delay
      const delay = Math.min(initialDelay * Math.pow(2, retries - 1), maxDelay);
      console.log(`Retry ${retries}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Add function to check and refresh session
export const checkAndRefreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error checking session:', error);
      return null;
    }

    if (!session) {
      return null;
    }

    // If session exists but is close to expiring, refresh it
    const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : 0;

    if (timeUntilExpiry < 600000) { // Refresh if less than 10 minutes until expiry
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        return null;
      }

      return newSession;
    }

    return session;
  } catch (error) {
    console.error('Error in checkAndRefreshSession:', error);
    return null;
  }
};