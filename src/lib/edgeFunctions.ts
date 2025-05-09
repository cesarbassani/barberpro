import { supabase } from './supabase';

// Types
export type EdgeFunctionAction = 'createSubscription' | 'createCustomer' | 'updateSubscription' | 'cancelSubscription';

interface DebugConfig {
  supabaseUrl?: string;
  enableLogs?: boolean;
  maxLogLength?: number;
}

interface EdgeFunctionPayload<T> {
  action: EdgeFunctionAction;
  data: T;
}

interface DebugLog {
  startTime: number;
  endTime: number;
  action: EdgeFunctionAction;
  environment: string;
  payload: string;
  response: string;
  status: number;
  success: boolean;
  error?: string;
}

// Environment detection
function detectEnvironment(): 'development' | 'preview' | 'production' {
  if (typeof window === 'undefined') return 'development';
  const hostname = window.location.hostname;
  if (hostname.includes('localhost')) return 'development';
  if (hostname.includes('preview')) return 'preview';
  return 'production';
}

// Log to Supabase
async function logToSupabase(log: DebugLog) {
  try {
    const { error } = await supabase.from('asaas_logs').insert({
      action: log.action,
      payload: JSON.parse(log.payload),
      response: log.response ? JSON.parse(log.response) : null,
      success: log.success,
      error_message: log.error,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error logging to Supabase:', error);
    }
  } catch (error) {
    console.error('Failed to log to Supabase:', error);
  }
}

// Main execution function
export async function executeWithDebug<T, R>(
  action: EdgeFunctionAction,
  data: T,
  config: DebugConfig = {}
): Promise<R> {
  // Get auth session
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error('Unauthorized: No access token available');
  }

  // Initialize debug log
  const debugLog: DebugLog = {
    startTime: performance.now(),
    endTime: 0,
    action,
    environment: detectEnvironment(),
    payload: JSON.stringify({ action, data }, null, 2),
    response: '',
    status: 0,
    success: false
  };

  try {
    // Build function URL
    const supabaseUrl = config.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/asaas`;

    // Make request
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ action, data })
    });

    debugLog.status = response.status;

    // Handle response
    let responseData: any;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
      debugLog.response = JSON.stringify(responseData, null, 2);
    } else {
      responseData = await response.text();
      debugLog.response = responseData;
    }

    // Handle errors
    if (!response.ok) {
      let errorMessage = 'Unknown error occurred';
      
      if (typeof responseData === 'object' && responseData !== null) {
        errorMessage = responseData.error || responseData.message || JSON.stringify(responseData);
      } else if (typeof responseData === 'string') {
        errorMessage = responseData;
      }

      debugLog.error = errorMessage;
      throw new Error(errorMessage);
    }

    // Success
    debugLog.success = true;
    debugLog.endTime = performance.now();

    // Log if enabled
    if (config.enableLogs) {
      console.group(`🔄 Edge Function: ${action}`);
      console.log('Environment:', debugLog.environment);
      console.log('Duration:', Math.round(debugLog.endTime - debugLog.startTime), 'ms');
      console.log('Status:', debugLog.status);
      console.log('Payload:', JSON.parse(debugLog.payload));
      console.log('Response:', JSON.parse(debugLog.response));
      console.groupEnd();
    }

    // Log to Supabase in production
    if (debugLog.environment === 'production') {
      await logToSupabase(debugLog);
    }

    return responseData as R;

  } catch (error) {
    // Handle errors
    debugLog.success = false;
    debugLog.endTime = performance.now();
    debugLog.error = error instanceof Error ? error.message : 'Unknown error';

    // Log error if enabled
    if (config.enableLogs) {
      console.group('❌ Edge Function Error');
      console.error('Action:', action);
      console.error('Duration:', Math.round(debugLog.endTime - debugLog.startTime), 'ms');
      console.error('Error:', debugLog.error);
      console.groupEnd();
    }

    // Log to Supabase in production
    if (debugLog.environment === 'production') {
      await logToSupabase(debugLog);
    }

    throw error;
  }
}