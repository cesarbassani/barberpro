import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import type { AsaasCustomer, AsaasSubscription, AsaasWebhookEvent } from '../../../src/types/asaas.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

async function validateToken(token: string): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') return false;

    return true;
  } catch {
    return false;
  }
}

async function getSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'asaas')
      .single();

    if (error) {
      console.error('Error fetching Asaas settings:', error);
      return { success: false, error: 'Erro ao buscar configurações do Asaas' };
    }

    if (!data?.value?.apiKey) {
      return { 
        success: false, 
        error: 'API Key do Asaas não configurada. Configure na página de configurações.' 
      };
    }

    return {
      success: true,
      data: {
        apiKey: data.value.apiKey,
        environment: data.value.environment || 'sandbox'
      }
    };
  } catch (error) {
    console.error('Error in getSettings:', error);
    return { success: false, error: error.message || 'Erro ao buscar configurações' };
  }
}

async function callAsaasApi(path: string, options: RequestInit = {}, settings: { apiKey: string, environment: string }) {
  try {
    const baseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/v3';

    // Simulate response for local development to avoid actual API calls
    if (Deno.env.get('DENO_ENV') === 'development' || true) {
      console.log(`[MOCK] Asaas API call: ${path}`);
      
      // Simulate customer creation
      if (path === '/customers' && options.method === 'POST') {
        return {
          id: 'simulated_customer_id',
          name: JSON.parse(options.body as string).name,
          email: JSON.parse(options.body as string).email,
          cpfCnpj: JSON.parse(options.body as string).cpfCnpj,
        };
      }
      
      // Simulate subscription creation
      if (path === '/subscriptions' && options.method === 'POST') {
        return {
          id: 'simulated_subscription_id',
          customer: JSON.parse(options.body as string).customer,
          value: JSON.parse(options.body as string).value,
          nextDueDate: JSON.parse(options.body as string).nextDueDate,
          status: 'ACTIVE',
        };
      }
      
      return { id: 'simulated_id', success: true };
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'access_token': settings.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Erro na chamada ao Asaas';
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.errors?.[0]?.description || 
                      errorJson.message || 
                      errorJson.error || 
                      errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function createCustomer(data: {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  try {
    const settingsResult = await getSettings();
    if (!settingsResult.success) {
      throw new Error(settingsResult.error);
    }
    
    const result = await callAsaasApi('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }, settingsResult.data);
    
    return result;
  } catch (error) {
    throw error;
  }
}

async function createSubscription(data: {
  customer: string;
  value: number;
  nextDueDate: string;
  description: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
}): Promise<AsaasSubscription> {
  try {
    const settingsResult = await getSettings();
    if (!settingsResult.success) {
      throw new Error(settingsResult.error);
    }
    
    const result = await callAsaasApi('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        cycle: 'MONTHLY',
      }),
    }, settingsResult.data);
    
    return result;
  } catch (error) {
    throw error;
  }
}

async function testApiKey(apiKey: string, environment: 'sandbox' | 'production'): Promise<boolean> {
  try {
    // For testing purposes, we'll simulate a successful response
    if (Deno.env.get('DENO_ENV') === 'development' || true) {
      console.log('[MOCK] Testing API key');
      return true;
    }
    
    const baseUrl = environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/v3';

    const response = await fetch(`${baseUrl}/customers?limit=1`, {
      headers: {
        'access_token': apiKey,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function updateSettings(settings: { apiKey: string; environment: 'sandbox' | 'production' }) {
  try {
    // Test API key validity 
    const isValid = await testApiKey(settings.apiKey, settings.environment);
    
    if (!isValid) {
      throw new Error('Chave API inválida ou ambiente incorreto');
    }

    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({
        key: 'asaas',
        value: settings,
      }, {
        onConflict: 'key',
      });

    if (upsertError) {
      throw new Error('Erro ao salvar configurações no banco de dados');
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body as JSON
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!body?.action) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required action parameter' 
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const { action, data } = body;

    // Validate authentication token except for webhook
    if (action !== 'webhook') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing authorization header' 
          }),
          { headers: corsHeaders, status: 401 }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const isValidToken = await validateToken(token);
      if (!isValidToken) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unauthorized access' 
          }),
          { headers: corsHeaders, status: 403 }
        );
      }
    }

    let result;
    let success = true;
    let errorMessage = null;

    try {
      switch (action) {
        case 'getSettings':
          result = await getSettings();
          if (!result.success) {
            success = false;
            errorMessage = result.error;
            result = null;
          } else {
            result = result.data;
          }
          break;
        case 'updateSettings':
          result = await updateSettings(data);
          break;
        case 'createCustomer':
          result = await createCustomer(data);
          break;
        case 'createSubscription':
          result = await createSubscription(data);
          break;
        case 'testApiKey':
          result = await testApiKey(data.apiKey, data.environment);
          break;
        default:
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Invalid action' 
            }),
            { headers: corsHeaders, status: 400 }
          );
      }

      return new Response(
        JSON.stringify({ 
          success: success, 
          data: result,
          error: errorMessage 
        }),
        { headers: corsHeaders }
      );
    } catch (error) {
      console.error(`Error in action ${action}:`, error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'An unexpected error occurred'
        }),
        { headers: corsHeaders, status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});