import React, { useState, useEffect } from 'react';
import { History, Filter, Calendar, Search, ChevronLeft, ChevronRight, Download, Info, Package, User, RefreshCw } from 'lucide-react';
import { useInventory, type InventoryTransaction, type InventoryTransactionType } from '../../lib/inventory';
import { useProducts } from '../../lib/products';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface InventoryTransactionHistoryProps {
  productId?: string | null;
}

export function InventoryTransactionHistory({ productId }: InventoryTransactionHistoryProps) {
  const { transactions, fetchTransactions, isLoading, error } = useInventory();
  const { products, fetchProducts } = useProducts();
  
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState<string>(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<InventoryTransactionType | 'all'>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>(productId || 'all');
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    const loadData = async () => {
      await fetchProducts();
      
      let start: Date;
      let end: Date = endOfDay(new Date());
      
      switch (dateRange) {
        case 'today':
          start = startOfDay(new Date());
          break;
        case 'yesterday':
          start = startOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
          end = endOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
          break;
        case 'week':
          start = startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          start = startOfMonth(new Date());
          end = endOfMonth(new Date());
          break;
        case 'custom':
          start = startOfDay(new Date(startDate));
          end = endOfDay(new Date(endDate));
          break;
        default:
          start = startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      }
      
      setStartDate(format(start, 'yyyy-MM-dd'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      
      try {
        // For now, we just fetch all transactions and filter on the client side
        // In a real application, you'd want to filter on the server
        await fetchTransactions(selectedProduct !== 'all' ? selectedProduct : undefined, 1000);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        toast.error('Erro ao carregar transações. Tentando novamente...');
      }
    };
    
    loadData();
  }, [fetchProducts, fetchTransactions, dateRange, selectedProduct, retryCount]);

  useEffect(() => {
    // When productId prop changes, update the selected product
    if (productId) {
      setSelectedProduct(productId);
    }
  }, [productId]);

  const filteredTransactions = transactions.filter(transaction => {
    // Filter by transaction type
    if (transactionTypeFilter !== 'all' && transaction.transaction_type !== transactionTypeFilter) {
      return false;
    }
    
    // Filter by product
    if (selectedProduct !== 'all' && transaction.product_id !== selectedProduct) {
      return false;
    }
    
    // Filter by date range
    const transactionDate = new Date(transaction.created_at);
    const startDateTime = startOfDay(new Date(startDate));
    const endDateTime = endOfDay(new Date(endDate));
    
    if (isBefore(transactionDate, startDateTime) || isAfter(transactionDate, endDateTime)) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        transaction.product?.name?.toLowerCase().includes(searchLower) ||
        transaction.notes?.toLowerCase().includes(searchLower) ||
        transaction.created_by_profile?.full_name?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const getTransactionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'purchase': 'Compra',
      'sale': 'Venda',
      'adjustment': 'Ajuste',
      'return': 'Devolução',
      'transfer': 'Transferência',
      'loss': 'Perda'
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (type: string): string => {
    switch (type) {
      case 'purchase':
      case 'return':
        return 'bg-green-100 text-green-800';
      case 'sale':
        return 'bg-blue-100 text-blue-800';
      case 'adjustment':
        return 'bg-yellow-100 text-yellow-800';
      case 'loss':
        return 'bg-red-100 text-red-800';
      case 'transfer':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Data', 'Produto', 'Tipo', 'Quantidade', 'Estoque Anterior', 
      'Novo Estoque', 'Operador', 'Notas'
    ];
    
    const data = [
      headers,
      ...filteredTransactions.map(t => [
        format(new Date(t.created_at), 'dd/MM/yyyy HH:mm:ss'),
        t.product?.name || '',
        getTransactionTypeLabel(t.transaction_type),
        t.quantity.toString(),
        t.previous_quantity.toString(),
        t.new_quantity.toString(),
        t.created_by_profile?.full_name || '',
        t.notes || ''
      ])
    ];
    
    const csvContent = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transacoes-inventario-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    toast.success('Tentando carregar os dados novamente...');
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
          <History className="h-5 w-5 text-primary-600 mr-2" />
          Histórico de Transações de Estoque
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </button>
          <button
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os produtos</option>
              {products
                .filter(p => p.active)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(product => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))
              }
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Transação</label>
            <select
              value={transactionTypeFilter}
              onChange={(e) => setTransactionTypeFilter(e.target.value as InventoryTransactionType | 'all')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os tipos</option>
              <option value="purchase">Compras</option>
              <option value="sale">Vendas</option>
              <option value="adjustment">Ajustes</option>
              <option value="return">Devoluções</option>
              <option value="loss">Perdas</option>
              <option value="transfer">Transferências</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'today' | 'yesterday' | 'week' | 'month' | 'custom')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Este mês</option>
              <option value="custom">Período personalizado</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por produto, notas, operador..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pr-10 sm:text-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="flex items-center space-x-4 mb-6 lg:col-span-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Transactions Table */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium text-gray-900">Transações</h4>
            <span className="text-sm text-gray-500">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transação' : 'transações'}
            </span>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <RefreshCw className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                  <div className="mt-2">
                    <button 
                      onClick={handleRetry} 
                      className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <History className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Sem transações</h3>
              <p className="mt-1 text-sm text-gray-500">
                Não há transações de estoque para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estoque Anterior
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Novo Estoque
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notas
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">{transaction.product?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getTransactionTypeColor(transaction.transaction_type)
                        }`}>
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.previous_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.new_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-sm text-gray-900">{transaction.created_by_profile?.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {transaction.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}