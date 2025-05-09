import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditCard, Key, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const settingsSchema = z.object({
  apiKey: z.string().min(1, 'Chave da API é obrigatória'),
  environment: z.enum(['sandbox', 'production']),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function AsaasSettings() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentSettings, setCurrentSettings] = React.useState<SettingsFormData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      environment: 'sandbox',
      ...currentSettings,
    },
  });

  React.useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: functionError } = await supabase
          .functions.invoke('asaas', {
            body: { action: 'getSettings' },
          });

        if (functionError) {
          throw new Error(functionError.message);
        }

        if (!data) {
          throw new Error('Nenhuma configuração encontrada');
        }
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        if (data.settings) {
          setCurrentSettings(data.settings);
          reset(data.settings);
        }
      } catch (err: any) {
        const errorMessage = err.message || err.error_description || 'Erro ao carregar configurações';
        console.error('Error loading settings:', err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [reset]);

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await supabase.functions.invoke('asaas', {
        body: { 
          action: 'updateSettings',
          data,
        },
      });

      // Check for error in response data
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Check for success flag
      if (!response.data?.success) {
        throw new Error('Falha ao salvar configurações. Por favor, tente novamente.');
      }
      
      setCurrentSettings(data);
      toast.success('Configurações salvas com sucesso!');
    } catch (err: any) {
      let errorMessage = 'Erro ao salvar configurações';
      
      // Try to extract the most meaningful error message
      if (typeof err === 'object') {
        errorMessage = err.message || err.error_description || errorMessage;
        
        // Check for nested error messages
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.error?.description) {
          errorMessage = err.error.description;
        }
      }

      console.error('Error saving settings:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !currentSettings) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-6">
        <CreditCard className="h-6 w-6 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">Configurações do Asaas</h2>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Estas configurações são sensíveis e afetam o processamento de pagamentos.
              Certifique-se de inserir os dados corretamente.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">
            Chave da API
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Key className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              id="api-key"
              {...register('apiKey')}
              className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="Insira sua chave da API do Asaas"
            />
          </div>
          {errors.apiKey && (
            <p className="mt-1 text-sm text-red-600">{errors.apiKey.message}</p>
          )}
        </div>

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700">
              Ambiente
            </legend>
            <div className="mt-2 space-y-4">
              <div className="flex items-center">
                <input
                  id="sandbox"
                  type="radio"
                  {...register('environment')}
                  value="sandbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="sandbox" className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Sandbox (Testes)</span>
                  <span className="block text-sm text-gray-500">
                    Use este ambiente para testar a integração sem processar pagamentos reais
                  </span>
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="production"
                  type="radio"
                  {...register('environment')}
                  value="production"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="production" className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Produção</span>
                  <span className="block text-sm text-gray-500">
                    Ambiente de produção para processar pagamentos reais
                  </span>
                </label>
              </div>
            </div>
          </fieldset>
          {errors.environment && (
            <p className="mt-1 text-sm text-red-600">{errors.environment.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}