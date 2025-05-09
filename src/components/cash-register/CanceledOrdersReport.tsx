import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrders } from '../../lib/orders';
import { useAuth } from '../../lib/auth';
import {
  Calendar,
  Download,
  Printer,
  FileText,
  Search,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  Check,
  XCircle
} from 'lucide-react';

export function CanceledOrdersReport() {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [operators, setOperators] = useState<any[]>([]);
  
  const { orders, isLoading: ordersLoading, error, fetchOrders } = useOrders();
  const { profile } = useAuth();
  
  // Load data when component mounts
  useEffect(() => {
    loadData();
  }, [startDate, endDate]);
  
  // Load orders data
  const loadData = async () => {
    setIsLoading(true);
    try {
      await fetchOrders();
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Process orders when they are loaded
  useEffect(() => {
    if (!ordersLoading && orders) {
      // Filter orders by date range and cancelled status
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return (
          order.status === 'cancelled' &&
          orderDate >= startDate &&
          orderDate <= endDate
        );
      });
      
      setCancelledOrders(filteredOrders);
      
      // Extract unique operators from the filtered orders
      const uniqueOperators = Array.from(new Set(
        filteredOrders
          .filter(order => order.barber)
          .map(order => JSON.stringify({ id: order.barber.id, name: order.barber.full_name }))
      )).map(str => JSON.parse(str));
      
      setOperators(uniqueOperators);
    }
  }, [orders, ordersLoading, startDate, endDate]);
  
  // Handle month navigation
  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setStartDate(startOfMonth(newMonth));
    setEndDate(endOfMonth(newMonth));
  };
  
  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setStartDate(startOfMonth(newMonth));
    setEndDate(endOfMonth(newMonth));
  };
  
  // Filter orders based on search and operator
  const getFilteredOrders = () => {
    if (!cancelledOrders) return [];
    
    return cancelledOrders.filter(order => {
      // Apply operator filter
      if (selectedOperator !== 'all' && order.barber?.id !== selectedOperator) {
        return false;
      }
      
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          order.client?.full_name?.toLowerCase().includes(searchLower) ||
          order.barber?.full_name?.toLowerCase().includes(searchLower) ||
          order.id.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  };
  
  const filteredOrders = getFilteredOrders();
  
  // Calculate summary data
  const summary = {
    totalOrders: filteredOrders.length,
    totalValue: filteredOrders.reduce((sum, order) => sum + Number(order.total_amount), 0)
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  // Export to CSV
  const exportCSV = () => {
    if (filteredOrders.length === 0) return;
    
    // Define CSV headers
    const headers = [
      'ID',
      'Data',
      'Cliente',
      'Atendente',
      'Valor Total',
      'Itens'
    ];
    
    // Map data to CSV rows
    const rows = filteredOrders.map(order => [
      order.id,
      format(new Date(order.created_at), "dd/MM/yyyy HH:mm"),
      order.client?.full_name || 'Não identificado',
      order.barber?.full_name || 'Não atribuído',
      Number(order.total_amount).toFixed(2).replace('.', ','),
      order.items?.map((item: any) => 
        `${item.quantity}x ${item.service?.name || item.product?.name || 'Item'}`
      ).join('; ') || ''
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `comandas-canceladas-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Prepare data for printing
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <div className="space-y-6 relative">
      {/* Print styles - only visible when printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Relatório de Comandas Canceladas</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            disabled={filteredOrders.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>
      
      {/* Filters Section */}
      <div className="bg-white p-4 rounded-lg shadow-md no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="report-start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                id="report-start-date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(e.target.value ? parseISO(e.target.value) : new Date())}
                className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="report-end-date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                id="report-end-date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(e.target.value ? parseISO(e.target.value) : new Date())}
                className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="operator-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Atendente
            </label>
            <select
              id="operator-filter"
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os atendentes</option>
              {operators.map(op => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-3">
            <label htmlFor="search-orders" className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search-orders"
                placeholder="Buscar por cliente, atendente ou número da comanda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
          
          {/* Month Navigation */}
          <div className="flex items-center justify-between md:col-span-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousMonth}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </button>
              <span className="font-medium text-gray-700">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="print-section">
        {/* Report Title - visible when printing */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-center">Relatório de Comandas Canceladas</h1>
          <p className="text-center text-gray-600">
            {format(startDate, "dd/MM/yyyy", { locale: ptBR })} a {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
          </p>
          <p className="text-center text-gray-600">
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <XCircle className="h-10 w-10 text-red-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Total de Comandas Canceladas</h3>
                <p className="text-3xl font-bold text-gray-800 mt-1">{summary.totalOrders}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <FileText className="h-10 w-10 text-primary-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Valor Total Cancelado</h3>
                <p className="text-3xl font-bold text-red-600 mt-1">{formatCurrency(summary.totalValue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Comandas Canceladas
            </h3>
          </div>
          
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Carregando comandas...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhuma comanda cancelada encontrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID da Comanda
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Atendente
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{order.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.client?.full_name || 'Não identificado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.barber?.full_name || 'Não atribuído'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                        {formatCurrency(Number(order.total_amount))}
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