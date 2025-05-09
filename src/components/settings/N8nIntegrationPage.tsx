import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Webhook, 
  Key, 
  Copy, 
  ToggleLeft, 
  ToggleRight, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  HelpCircle,
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  DownloadIcon,
  User,
  Loader2
} from 'lucide-react';

const settingsSchema = z.object({
  enabled: z.boolean().default(false),
  apiToken: z.string().min(10, 'O token precisa ter pelo menos 10 caracteres'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface N8nLog {
  id: string;
  timestamp: string;
  acao: string;
  barbeiro_id?: string;
  barbeiro?: { full_name: string };
  cliente?: any;
  status: 'success' | 'error';
  mensagem: string;
}

export function N8nIntegrationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [logs, setLogs] = useState<N8nLog[]>([]);
  const [logsCount, setLogsCount] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(10);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'buscarAgenda' | 'criarAgendamento'>('all');
  const [barbers, setBarbers] = useState<Array<{ id: string; full_name: string }>>([]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      enabled: false,
      apiToken: '',
    }
  });

  const isEnabled = watch('enabled');
  const apiToken = watch('apiToken');
  
  // Copiar webhook URL
  const webhookUrl = `${supabase.functions.url}/n8n-integration`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  // Copiar token
  const handleCopyToken = () => {
    navigator.clipboard.writeText(apiToken);
    toast.success('Token copiado para a área de transferência');
  };

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'n8n_integration')
          .single();

        if (error) throw error;

        if (data?.value) {
          setValue('enabled', data.value.enabled || false);
          setValue('apiToken', data.value.apiToken || '');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Carregar barbeiros para os filtros de logs
    const loadBarbers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'barber');
          
        if (error) throw error;
        setBarbers(data || []);
      } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
      }
    };

    loadSettings();
    loadBarbers();
    loadLogs();
  }, [setValue]);

  // Carregar logs
  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      // Construir a query baseada nos filtros
      let query = supabase
        .from('n8n_logs')
        .select('*, barbeiro:profiles!barbeiro_id(full_name)', { count: 'exact' })
        .order('timestamp', { ascending: false });
      
      // Aplicar filtros
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      if (actionFilter !== 'all') {
        query = query.eq('acao', actionFilter);
      }
      
      if (searchTerm) {
        query = query.or(`mensagem.ilike.%${searchTerm}%,acao.ilike.%${searchTerm}%`);
      }
      
      // Aplicar paginação
      const from = (logsPage - 1) * logsPerPage;
      const to = from + logsPerPage - 1;
      
      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      
      setLogs(data || []);
      setLogsCount(count || 0);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Erro ao carregar logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Atualizar logs quando os filtros ou a paginação mudarem
  useEffect(() => {
    loadLogs();
  }, [logsPage, logsPerPage, statusFilter, actionFilter, searchTerm]);
  
  // Função para exportar logs como CSV
  const exportLogsCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['ID', 'Timestamp', 'Ação', 'Barbeiro', 'Cliente', 'Status', 'Mensagem'];
    
    // Criar conteúdo CSV
    const csvContent = [
      // Cabeçalho
      headers.join(','),
      // Linhas de dados
      ...logs.map(log => [
        log.id,
        new Date(log.timestamp).toLocaleString('pt-BR'),
        log.acao,
        log.barbeiro?.full_name || 'N/A',
        log.cliente ? JSON.stringify(log.cliente).replace(/,/g, ';').replace(/"/g, '""') : 'N/A',
        log.status,
        log.mensagem.replace(/,/g, ';').replace(/"/g, '""')
      ].join(','))
    ].join('\n');
    
    // Criar blob e link para download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `n8n_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gerar novo token
  const generateNewToken = () => {
    setIsGeneratingToken(true);
    
    // Gerar token aleatório de 32 caracteres hexadecimais
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    setValue('apiToken', token);
    setIsGeneratingToken(false);
    toast.success('Novo token gerado. Salve para aplicar as alterações.');
  };

  // Toggle para expandir detalhes do log
  const toggleLogDetails = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  // Salvar configurações
  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'n8n_integration',
          value: {
            enabled: data.enabled,
            apiToken: data.apiToken,
            webhookUrl,
            lastUpdated: new Date().toISOString()
          }
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Integração com n8n</h2>
      </div>

      {/* Configurações */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Webhook className="h-6 w-6 text-primary-600" />
          <h3 className="text-xl font-semibold text-gray-900">Configurações da Integração</h3>
        </div>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Esta integração permite que sistemas externos acessem a agenda e criem novos agendamentos.
                Certifique-se de manter o token seguro e ative apenas quando necessário.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Webhook URL */}
            <div className="tooltip">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL do Webhook
              </label>
              <span className="tooltiptext">
                Este é o endereço que o n8n deve usar para enviar requisições
              </span>
              
              <div className="mt-1 flex rounded-md shadow-sm">
                <div className="relative flex items-stretch flex-grow focus-within:z-10">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Webhook className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300 bg-gray-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="tooltip -ml-px relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100"
                >
                  <span className="tooltiptext">
                    Copiar URL do webhook
                  </span>
                  <Copy className="h-5 w-5" />
                  <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
            
            {/* Token */}
            <div className="tooltip">
              <label htmlFor="api-token" className="block text-sm font-medium text-gray-700 mb-1">
                Token de Acesso (API Key)
              </label>
              <span className="tooltiptext">
                Token que deve ser enviado no cabeçalho Authorization das requisições
              </span>
              
              <div className="mt-1 flex rounded-md shadow-sm">
                <div className="relative flex items-stretch flex-grow focus-within:z-10">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="api-token"
                    {...register('apiToken')}
                    className="h-10 focus:ring-primary-500 focus:border-primary-500 block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300"
                  />
                </div>
                <div className="flex -ml-px">
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="tooltip relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
                  >
                    <span className="tooltiptext">
                      Copiar token
                    </span>
                    <Copy className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={generateNewToken}
                    disabled={isGeneratingToken}
                    className="tooltip relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100"
                  >
                    <span className="tooltiptext">
                      Gerar novo token aleatório
                    </span>
                    <RefreshCw className={`h-5 w-5 ${isGeneratingToken ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              {errors.apiToken && (
                <p className="mt-1 text-sm text-red-600">{errors.apiToken.message}</p>
              )}
            </div>
          </div>
          
          {/* Status */}
          <div className="flex items-center mt-4 tooltip">
            <span className="tooltiptext">
              Ativar ou desativar a integração com n8n
            </span>
            <label htmlFor="integration-status" className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  id="integration-status"
                  type="checkbox"
                  className="sr-only"
                  {...register('enabled')}
                />
                <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${
                  isEnabled ? 'transform translate-x-6 bg-primary-600' : ''
                }`}></div>
              </div>
              <div className="ml-3 text-gray-700 font-medium">
                {isEnabled ? (
                  <span className="flex items-center text-green-600">
                    <ToggleRight className="h-5 w-5 mr-1" />
                    Integração Ativa
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400">
                    <ToggleLeft className="h-5 w-5 mr-1" />
                    Integração Desativada
                  </span>
                )}
              </div>
            </label>
          </div>
          
          {/* Botão Salvar */}
          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="tooltip flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <span className="tooltiptext">
                Salvar configurações da integração
              </span>
              {isLoading ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>

      {/* Logs */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-6">
          <FileText className="h-6 w-6 text-primary-600" />
          <h3 className="text-xl font-semibold text-gray-900">Registros de Integração (Logs)</h3>
          <div className="flex-grow"></div>
          <div className="tooltip">
            <button
              onClick={() => loadLogs()}
              className="tooltip inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <span className="tooltiptext">
                Atualizar lista de logs
              </span>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </button>
          </div>
          <div className="tooltip">
            <button
              onClick={exportLogsCSV}
              disabled={logs.length === 0}
              className="tooltip inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="tooltiptext">
                Exportar logs para arquivo CSV
              </span>
              <DownloadIcon className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="tooltip">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Search className="h-4 w-4 mr-1" />
              Buscar
            </label>
            <span className="tooltiptext">
              Buscar por texto nos logs
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nos logs..."
              className="h-10 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          
          <div className="tooltip">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Filter className="h-4 w-4 mr-1" />
              Status
            </label>
            <span className="tooltiptext">
              Filtrar logs por status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os status</option>
              <option value="success">Sucesso</option>
              <option value="error">Erro</option>
            </select>
          </div>
          
          <div className="tooltip">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Webhook className="h-4 w-4 mr-1" />
              Ação
            </label>
            <span className="tooltiptext">
              Filtrar logs por tipo de ação
            </span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as any)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todas as ações</option>
              <option value="buscarAgenda">Buscar Agenda</option>
              <option value="criarAgendamento">Criar Agendamento</option>
            </select>
          </div>
          
          <div className="tooltip">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <User className="h-4 w-4 mr-1" />
              Barbeiro
            </label>
            <span className="tooltiptext">
              Filtrar logs por barbeiro
            </span>
            <select
              onChange={(e) => {
                // Implementar filtro por barbeiro depois
              }}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Todos os barbeiros</option>
              {barbers.map(barber => (
                <option key={barber.id} value={barber.id}>
                  {barber.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Tabela de logs */}
        <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {isLoadingLogs ? (
              <li className="px-4 py-4 text-center flex items-center justify-center">
                <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary-600" />
                <span>Carregando logs...</span>
              </li>
            ) : logs.length === 0 ? (
              <li className="px-4 py-4 text-center text-gray-500">
                Nenhum log encontrado
              </li>
            ) : (
              logs.map((log) => (
                <li 
                  key={log.id} 
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="px-4 py-4">
                    <div 
                      onClick={() => toggleLogDetails(log.id)}
                      className="flex justify-between items-center cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.status === 'success' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.status === 'success' ? (
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                          )}
                          {log.status}
                        </span>
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {log.acao}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                        {expandedLogs.has(log.id) ? (
                          <ChevronUp className="h-5 w-5 ml-2" />
                        ) : (
                          <ChevronDown className="h-5 w-5 ml-2" />
                        )}
                      </div>
                    </div>
                    
                    {/* Detalhes expandidos */}
                    {expandedLogs.has(log.id) && (
                      <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Detalhes:</p>
                            <p className="text-gray-600">{log.mensagem}</p>
                          </div>
                          
                          <div>
                            {log.barbeiro && (
                              <div className="mb-2">
                                <p className="font-medium text-gray-700 mb-1">Barbeiro:</p>
                                <p className="text-gray-600">{log.barbeiro.full_name}</p>
                              </div>
                            )}
                            
                            {log.cliente && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Cliente:</p>
                                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-20">
                                  {JSON.stringify(log.cliente, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        
        {/* Paginação */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-700">
              Mostrando <span className="font-medium">{logs.length}</span> de{' '}
              <span className="font-medium">{logsCount}</span> resultados
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Linhas por página:</span>
            <select
              value={logsPerPage}
              onChange={(e) => {
                setLogsPerPage(Number(e.target.value));
                setLogsPage(1);
              }}
              className="h-8 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            
            <button
              onClick={() => setLogsPage(p => Math.max(p - 1, 1))}
              disabled={logsPage === 1}
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            
            <span className="text-sm text-gray-700">
              Página {logsPage} de {Math.max(1, Math.ceil(logsCount / logsPerPage))}
            </span>
            
            <button
              onClick={() => setLogsPage(p => p + 1)}
              disabled={logsPage >= Math.ceil(logsCount / logsPerPage)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
      
      {/* Documentação */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-6">
          <FileText className="h-6 w-6 text-primary-600" />
          <h3 className="text-xl font-semibold text-gray-900">Documentação da API</h3>
        </div>
        
        <div className="prose max-w-none">
          <h4 className="text-lg font-medium text-gray-900">Configuração no n8n</h4>
          <p>Para integrar o n8n com o sistema, siga estes passos:</p>
          <ol className="list-decimal pl-5 mb-4">
            <li>Ative a integração acima.</li>
            <li>Copie o token de acesso e a URL do webhook.</li>
            <li>No n8n, crie um novo nó HTTP Request.</li>
            <li>Configure-o para fazer uma requisição POST para a URL do webhook.</li>
            <li>Adicione o cabeçalho <code>Authorization: Bearer seu_token_aqui</code>.</li>
            <li>Configure o corpo da requisição conforme a documentação abaixo.</li>
          </ol>
          
          <h4 className="text-lg font-medium text-gray-900">Ações Disponíveis</h4>
          
          <div className="border p-4 rounded-md mb-4">
            <h5 className="font-medium">buscarAgenda</h5>
            <p className="my-2">Retorna os horários disponíveis para um ou todos os barbeiros em uma data específica.</p>
            
            <h6 className="font-medium">Parâmetros:</h6>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
{`{
  "acao": "buscarAgenda",
  "data": "2025-05-12",     // Formato YYYY-MM-DD
  "barbeiroId": "uuid"      // Opcional, se não informado retorna todos
}`}
            </pre>
            
            <h6 className="font-medium mt-3">Resposta de Sucesso:</h6>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
{`{
  "success": true,
  "data": [
    {
      "barbeiro": {
        "id": "uuid",
        "nome": "Nome do Barbeiro",
        "email": "email@exemplo.com",
        "telefone": "11999999999"
      },
      "horarios": [
        {
          "hora": "08:00",
          "disponivel": true,
          "timestamp": "2025-05-12T11:00:00.000Z"
        },
        // ...mais horários
      ]
    }
  ]
}`}
            </pre>
          </div>
          
          <div className="border p-4 rounded-md">
            <h5 className="font-medium">criarAgendamento</h5>
            <p className="my-2">Cria um novo agendamento no sistema.</p>
            
            <h6 className="font-medium">Parâmetros:</h6>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
{`{
  "acao": "criarAgendamento",
  "data": "2025-05-12",     // Formato YYYY-MM-DD
  "hora": "14:30",          // Formato HH:MM
  "barbeiroId": "uuid",     // ID do barbeiro
  "servicoId": "uuid",      // ID do serviço
  "cliente": {
    "nome": "Nome do Cliente",
    "telefone": "11999999999",  // Opcional, mas recomendado
    "email": "cliente@email.com" // Opcional
  }
}`}
            </pre>
            
            <h6 className="font-medium mt-3">Resposta de Sucesso:</h6>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
{`{
  "success": true,
  "data": {
    "id": "uuid",
    "dataHora": {
      "inicio": "2025-05-12T17:30:00.000Z",
      "fim": "2025-05-12T18:00:00.000Z"
    },
    "status": "scheduled"
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}