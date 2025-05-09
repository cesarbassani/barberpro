import React from 'react';
import { Bug, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { testApiKey } from '../../lib/asaas';

interface AsaasLog {
  id: string;
  action: string;
  payload: any;
  response: any;
  success: boolean;
  error_message: string | null;
  created_at: string;
  elapsed_time_ms: number;
}

interface AsaasDebugPanelProps {
  onClose: () => void;
}

export function AsaasDebugPanel({ onClose }: AsaasDebugPanelProps) {
  const [settings, setSettings] = React.useState<any>(null);
  const [logs, setLogs] = React.useState<AsaasLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isTestingApi, setIsTestingApi] = React.useState(false);
  const [apiTestResult, setApiTestResult] = React.useState<{success: boolean; error?: string} | null>(null);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'asaas')
        .single();

      if (settingsError) throw settingsError;
      setSettings(settingsData?.value);

      // Fetch logs
      const { data: logsData, error: logsError } = await supabase
        .from('asaas_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;
      setLogs(logsData || []);
    } catch (error) {
      console.error('Error fetching debug data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 5 seconds
    const interval = window.setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchData]);

  const testConnection = async () => {
    if (!settings?.apiKey || !settings?.environment) {
      setApiTestResult({
        success: false,
        error: 'Configurações incompletas. Configure a API Key e o ambiente.'
      });
      return;
    }

    setIsTestingApi(true);
    try {
      const result = await testApiKey(settings.apiKey, settings.environment);
      setApiTestResult({
        success: result,
        error: result ? undefined : 'Falha ao conectar com o Asaas'
      });
    } catch (error) {
      setApiTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Debug Asaas</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-4rem)]">
          {/* Settings Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Configurações</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">API Key</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {settings?.apiKey ? '••••' + settings.apiKey.slice(-4) : 'Não configurada'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Ambiente</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {settings?.environment || 'Não configurado'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={testConnection}
                  disabled={isTestingApi}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700"
                >
                  {isTestingApi ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Testar Conexão</span>
                </button>

                {apiTestResult && (
                  <div className={`mt-2 p-2 rounded ${
                    apiTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <div className="flex items-center">
                      {apiTestResult.success ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 mr-2" />
                      )}
                      <span className="text-sm">
                        {apiTestResult.success ? 'Conexão bem sucedida' : apiTestResult.error}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Logs Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Últimas Operações</h3>
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data/Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Detalhes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tempo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.action}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.success ? 'Sucesso' : 'Erro'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <details className="cursor-pointer">
                            <summary className="text-primary-600 hover:text-primary-700">
                              Ver detalhes
                            </summary>
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="font-medium">Payload:</p>
                                <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium">Resposta:</p>
                                <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                              {log.error_message && (
                                <div>
                                  <p className="font-medium text-red-600">Erro:</p>
                                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60 text-red-600">
                                    {log.error_message}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.elapsed_time_ms}ms
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          <div className="flex items-center justify-center space-x-2">
                            <AlertTriangle className="h-5 w-5" />
                            <span>Nenhum log encontrado</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}