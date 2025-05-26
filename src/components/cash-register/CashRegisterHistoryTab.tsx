import React, { useState } from 'react';
import { useCashRegisterStore } from '../../lib/cashRegisterStore';
import { useAuth } from '../../lib/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  Clock, 
  User,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Edit2,
  PlusCircle,
  XCircle as XIcon
} from 'lucide-react';

interface CashRegisterHistoryTabProps {
  onEditRegister: (register: any) => void;
  onCreateRetroactiveTransaction: (register: any) => void;
}

export function CashRegisterHistoryTab({ onEditRegister, onCreateRetroactiveTransaction }: CashRegisterHistoryTabProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [expandedRegisterId, setExpandedRegisterId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile } = useAuth();
  
  const { 
    previousRegisters, 
    fetchCashRegisterHistory,
    fetchTransactionsByRegisterId,
    transactions,
    isLoading,
    getOperatorName
  } = useCashRegisterStore();
  
  React.useEffect(() => {
    // Load last 30 days by default
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setStartDate(start);
    setEndDate(end);
    
    fetchCashRegisterHistory(start, end);
  }, [fetchCashRegisterHistory]);
  
  const handleSearch = () => {
    fetchCashRegisterHistory(startDate || undefined, endDate || undefined);
  };
  
  const handleToggleDetails = async (registerId: string) => {
    if (expandedRegisterId === registerId) {
      // Collapse
      setExpandedRegisterId(null);
    } else {
      // Expand and fetch transactions
      setExpandedRegisterId(registerId);
      await fetchTransactionsByRegisterId(registerId);
    }
  };

  // Sort transactions by date when expanded
  const sortedTransactions = Array.isArray(transactions)
    ? transactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Histórico de Caixa</h2>
      </div>
      
      {/* Search Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                id="startDate"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="h-10 pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                id="endDate"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                className="h-10 pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="h-10 flex items-center justify-center w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </button>
          </div>
        </div>
      </div>
      
      {/* History List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Registros de Caixa
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Histórico de aberturas e fechamentos de caixa.
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Carregando registros...</p>
          </div>
        ) : previousRegisters.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Nenhum registro de caixa encontrado para o período selecionado.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {previousRegisters.map((register) => (
              <li key={register.id} className="hover:bg-gray-50 transition-colors duration-150">
                <div 
                  className="px-4 py-4 cursor-pointer"
                  onClick={() => handleToggleDetails(register.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {register.status === 'open' 
                        ? <DollarSign className="h-5 w-5 text-green-500 mr-2" />
                        : register.status === 'auto_closed'
                        ? <DollarSign className="h-5 w-5 text-amber-500 mr-2" />
                        : <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                      }
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          Caixa {register.status === 'open' 
                            ? 'Aberto' 
                            : register.status === 'auto_closed' 
                              ? 'Fechado Automaticamente' 
                              : 'Fechado'}
                        </h4>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>
                            {format(new Date(register.opened_at), "dd/MM/yyyy' às 'HH:mm", { locale: ptBR })}
                            {register.closed_at && ' - ' + format(new Date(register.closed_at), "dd/MM/yyyy' às 'HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {register.status === 'open' ? 'Valor Inicial:' : 'Valor Final:'}
                          </span>
                          <span className="ml-2 text-sm font-semibold text-gray-900">
                            R$ {register.status === 'open' 
                                ? Number(register.initial_amount).toFixed(2)
                                : Number(register.final_amount).toFixed(2)}
                          </span>
                        </div>
                        
                        {register.status !== 'open' && register.difference_amount !== null && (
                          <div className={`text-xs ${
                            Number(register.difference_amount) > 0 
                              ? 'text-green-600' 
                              : Number(register.difference_amount) < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}>
                            {Number(register.difference_amount) > 0 
                              ? `Sobra: R$ ${Number(register.difference_amount).toFixed(2)}` 
                              : Number(register.difference_amount) < 0
                                ? `Falta: R$ ${Math.abs(Number(register.difference_amount)).toFixed(2)}`
                                : 'Sem diferença'}
                          </div>
                        )}
                      </div>
                      
                      {expandedRegisterId === register.id 
                        ? <ChevronUp className="h-5 w-5 text-gray-500" />
                        : <ChevronDown className="h-5 w-5 text-gray-500" />
                      }
                    </div>
                  </div>
                </div>
                
                {/* Expanded details */}
                {expandedRegisterId === register.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    {/* Admin actions for closed registers */}
                    {register.status !== 'open' && profile?.role === 'admin' && (
                      <div className="mb-4 flex justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRegister(register);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Editar Fechamento
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); 
                            onCreateRetroactiveTransaction(register);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <PlusCircle className="h-3 w-3 mr-1" />
                          Lançamento Retroativo
                        </button>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="text-sm">
                        <div className="flex items-center mb-2">
                          <User className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="font-medium text-gray-700">Operadores:</span>
                        </div>
                        <p className="ml-6 text-gray-600">
                          Abertura: {register.opening_employee?.full_name || getOperatorName(register.opening_employee_id) || 'Não registrado'}
                          {register.closing_employee && (
                            <><br />Fechamento: {register.closing_employee?.full_name || 'Não registrado'}</>
                          )}
                        </p>
                      </div>
                      
                      {register.status !== 'open' && (
                        <div className="text-sm">
                          <div className="flex items-center mb-2">
                            <FileText className="h-4 w-4 text-gray-500 mr-2" />
                            <span className="font-medium text-gray-700">Relatório de Fechamento:</span>
                          </div>
                          <div className="ml-6 text-gray-600 space-y-1">
                            <p>Valor Esperado: R$ {Number(register.expected_amount || 0).toFixed(2)}</p>
                            <p>Valor Contado: R$ {Number(register.final_amount || 0).toFixed(2)}</p>
                            <p>Diferença: R$ {Number(register.difference_amount || 0).toFixed(2)}</p>
                            <p>Para Próximo Dia: R$ {Number(register.next_day_amount || 0).toFixed(2)}</p>
                            {register.notes && (
                              <p className="mt-2 italic">"{register.notes}"</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Movimentações:</h5>
                      {sortedTransactions.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Data/Hora
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Descrição
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Operador
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Cliente
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Forma
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Valor
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {sortedTransactions.map((transaction) => (
                                <tr key={transaction.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm")}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                                    {transaction.description || getOperationTypeName(transaction.operation_type)}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {transaction.employee?.full_name}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {transaction.client_name || '-'}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {getPaymentMethodName(transaction.payment_method)}
                                  </td>
                                  <td className={`px-4 py-2 whitespace-nowrap text-xs font-medium text-right ${
                                    ['sale', 'deposit', 'open'].includes(transaction.operation_type)
                                      ? 'text-green-600' 
                                      : 'text-red-600'
                                  }`}>
                                    {['sale', 'deposit', 'open'].includes(transaction.operation_type) ? '+' : '-'}
                                    R$ {Number(transaction.amount).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Nenhuma movimentação registrada para este caixa.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getOperationTypeName(type: string): string {
  const types: Record<string, string> = {
    'open': 'Abertura de Caixa',
    'close': 'Fechamento de Caixa',
    'sale': 'Venda',
    'payment': 'Pagamento',
    'withdrawal': 'Sangria',
    'deposit': 'Suprimento'
  };
  
  return types[type] || type;
}

function getPaymentMethodName(method: string): string {
  const methods: Record<string, string> = {
    'cash': 'Dinheiro',
    'credit_card': 'Cartão de Crédito',
    'debit_card': 'Cartão de Débito',
    'pix': 'PIX'
  };
  
  return methods[method] || method;
}