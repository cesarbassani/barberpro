import { supabase } from './supabase';

// Types
export interface AsaasSettings {
  apiKey: string;
  environment: 'sandbox' | 'production';
  webhookUrl: string;
}

export interface AsaasResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type CustomerData = {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
};

export type SubscriptionData = {
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  description: string;
};

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  error?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  status: string;
}

// Debug tracking
interface DebugTracking {
  startTime: number;
  environment: string;
  url: string;
  payload: any;
  response: any;
  elapsedTime: number;
  status: 'OK' | 'FAILED';
  statusCode?: number;
  errorMessage?: string;
}

// Environment detection
function detectEnvironment(): 'local' | 'preview' | 'edge' | 'production' {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('local-credentialless')) {
      return 'local';
    }
    if (hostname.includes('preview')) {
      return 'preview';
    }
    return 'production';
  }
  return 'edge';
}

async function logToSupabase(tracking: DebugTracking) {
  try {
    const { error } = await supabase.from('asaas_logs').insert({
      action: tracking.url.includes('asaas') ? 'asaas-api' : tracking.payload?.action,
      payload: tracking.payload,
      response: tracking.response,
      success: tracking.status === 'OK',
      error_message: tracking.errorMessage,
      elapsed_time_ms: tracking.elapsedTime
    });

    if (error) {
      console.error('Error logging to Supabase:', error);
    }
  } catch (error) {
    console.error('Error in logToSupabase:', error);
  }
}

async function callAsaasFunction<T>(action: string, data: any): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error('Usuário não autenticado');
  }

  const tracking: DebugTracking = {
    startTime: Date.now(),
    environment: detectEnvironment(),
    url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas`,
    payload: { action, data },
    response: null,
    elapsedTime: 0,
    status: 'FAILED'
  };

  try {
    // Check internet connection first
    try {
      await fetch('https://www.google.com', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
    } catch (e) {
      throw new Error('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
    }

    const response = await fetch(tracking.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ action, data })
    });

    tracking.statusCode = response.status;

    // Get response as text first
    const responseText = await response.text();
    
    // Try to parse as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      tracking.response = responseData;
    } catch (e) {
      // If not JSON, create a descriptive error
      const preview = responseText.substring(0, 100).replace(/\n/g, '');
      tracking.response = { error: `Invalid response format: ${preview}...` };
      throw new Error(`Resposta inválida do servidor: ${preview}...`);
    }

    // Check for error in response
    if (responseData.error || !responseData.success) {
      tracking.errorMessage = responseData.error || 'Erro desconhecido na resposta';
      throw new Error(tracking.errorMessage);
    }

    tracking.status = 'OK';
    tracking.elapsedTime = Date.now() - tracking.startTime;

    // Log debug info
    console.log(`[DEBUG] ${action}:`, {
      environment: tracking.environment,
      url: tracking.url,
      statusCode: tracking.statusCode,
      elapsedTime: `${tracking.elapsedTime}ms`
    });

    try {
      await logToSupabase(tracking);
    } catch (logError) {
      console.error('Failed to log to Supabase:', logError);
    }
    
    return responseData.data;

  } catch (error) {
    tracking.status = 'FAILED';
    tracking.errorMessage = error.message || 'Unknown error';
    tracking.elapsedTime = Date.now() - tracking.startTime;

    console.error(`[ERROR] ${action}:`, {
      environment: tracking.environment,
      url: tracking.url,
      statusCode: tracking.statusCode,
      error: tracking.errorMessage,
      elapsedTime: `${tracking.elapsedTime}ms`,
      payload: tracking.payload
    });

    try {
      await logToSupabase(tracking);
    } catch (logError) {
      console.error('Failed to log to Supabase:', logError);
    }
    
    throw error;
  }
}

export async function createCustomer(data: CustomerData): Promise<AsaasCustomer> {
  return callAsaasFunction('createCustomer', data);
}

export async function createSubscription(data: SubscriptionData): Promise<AsaasSubscription> {
  const subscriptionData = {
    ...data,
    cycle: 'MONTHLY' // Always set cycle to MONTHLY
  };
  return callAsaasFunction('createSubscription', subscriptionData);
}

export async function testApiKey(apiKey: string, environment: 'sandbox' | 'production'): Promise<boolean> {
  return callAsaasFunction('testApiKey', { apiKey, environment });
}

export async function getSettings(): Promise<AsaasSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'asaas')
    .single();

  if (error) {
    throw new Error('Erro ao buscar configurações do Asaas: ' + error.message);
  }

  if (!data?.value) {
    throw new Error('Configurações do Asaas não encontradas');
  }

  return data.value as AsaasSettings;
}

// Export aliases for backward compatibility
export const createAsaasCustomer = createCustomer;
export const createAsaasSubscription = createSubscription;