import React, { useState, useEffect } from 'react';
import { useCashRegister } from '../../lib/cashRegisterStore';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isToday, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Calendar, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Printer,
  PieChart,
  TrendingUp,
  Clock,
  User,
  Eye,
  XCircle, 
  FileText,
  ChevronUp,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CanceledOrdersReport } from '../cash-register/CanceledOrdersReport';

export function CashRegisterReports() {
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfMonth(new Date()));
  const [expandedRegisterId, setExpandedRegisterId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [monthlyBalance, setMonthlyBalance] = useState<any>(null);
  const [dateRangeOption, setDateRangeOption] = useState<'this-month' | 'last-month' | 'custom'>('this-month');
  const [activeReport, setActiveReport] = useState<'cash_register' | 'canceled_orders'>('cash_register');
  
  const navigate = useNavigate();
  
  // Get cash register data from the store
  const {
    previousRegisters,
    transactions,
    isLoading,
    fetchCashRegisterHistory,
    fetchTransactionsByRegisterId,
    calculateDailyBalance
  } = useCashRegister();
  
  // Load initial data
  useEffect(() => {
    // Set the date range based on selection
    let start, end;
    
    switch (dateRangeOption) {
      case 'this-month':
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case 'last-month':
        const lastMonth = subMonths(new Date(), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'custom':
        // Use the manually selected dates
        start = startDate || startOfMonth(new Date());
        end = endDate || endOfMonth(new Date());
        break;
    }
    
    setStartDate(start);
    setEndDate(end);
    
    // Fetch the cash register history for the selected period
    fetchCashRegisterHistory(start, end);
    
    // Calculate monthly balance
    calculateMonthlyBalance(start, end);
  }, [dateRangeOption, fetchCashRegisterHistory]);
  
  // Handle manual date range changes
  useEffect(() => {
    if (dateRangeOption === 'custom' && startDate && endDate) {
      fetchCashRegisterHistory(startDate, endDate);
      calculateMonthlyBalance(startDate, endDate);
    }
  }, [startDate, endDate, dateRangeOption, fetchCashRegisterHistory]);
  
  // Function to calculate the monthly balance
  const calculateMonthlyBalance = async (start: Date, end: Date) => {
    setIsLoadingBalances(true);
    
    try {
      // This is a simplistic approach - in a real implementation, 
      // you would aggregate all transactions in the date range
      const balance = await calculateDailyBalance(new Date()); // Just use today's balance for demo
      
      // Demo data - in a real app this would come from the database
      setMonthlyBalance({
        totalIncome: balance.cash + balance.creditCard + balance.debitCard + balance.pix,
        totalExpenses: 0, // We don't track expenses in this simple demo
        netProfit: balance.cash + balance.creditCard + balance.debitCard + balance.pix,
        paymentMethods: {
          cash: balance.cash,
          creditCard: balance.creditCard,
          debitCard: balance.debitCard,
          pix: balance.pix
        },
        transactions: {
          count: 42, // Demo value
          average: ((balance.cash + balance.creditCard + balance.debitCard + balance.pix) / 42).toFixed(2)
        }
      });
    } catch (err) {
      console.error('Error calculating monthly balance:', err);
    } finally {
      setIsLoadingBalances(false);
    }
  };
  
  // Handle month navigation
  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setStartDate(startOfMonth(newMonth));
    setEndDate(endOfMonth(newMonth));
    setDateRangeOption('custom');
  };
  
  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setStartDate(startOfMonth(newMonth));
    setEndDate(endOfMonth(newMonth));
    setDateRangeOption('custom');
  };
  
  // Handle toggle details
  const handleToggleDetails = async (registerId: string) => {
    if (expandedRegisterId === registerId) {
      setExpandedRegisterId(null);
    } else {
      setExpandedRegisterId(registerId);
      await fetchTransactionsByRegisterId(registerId);
    }
  };
  
  const handleBackToCashRegister = () => {
    navigate('/cash-register');
  };
  
  // Handle search and filters
  const filteredRegisters = previousRegisters.filter(register => {
    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'open' && register.status !== 'open') return false;
      if (filterStatus === 'closed' && register.status === 'open') return false;
    }
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        register.opening_employee?.full_name.toLowerCase().includes(searchLower) ||
        (register.closing_employee?.full_name || '').toLowerCase().includes(searchLower) ||
        (register.notes || '').toLowerCase().includes(searchLower) ||
        register.id.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });
  
  // Format date range for display
  const getDateRangeText = () => {
    if (!startDate || !endDate) return 'Período não definido';
    
    const startStr = format(startDate, "dd 'de' MMMM", { locale: ptBR });
    const endStr = format(endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startStr} a ${format(endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    }
    
    return `${startStr} a ${endStr}`;
  };

  // Calculate summary data
  const summary = {
    total: filteredRegisters.reduce((sum, reg) => {
      // For open registers, use initial amount
      // For closed registers, use final amount
      if (reg.status === 'open') {
        return sum + Number(reg.initial_amount || 0);
      } else {
        return sum + Number(reg.final_amount || 0);
      }
    }, 0),
    totalInitial: filteredRegisters.reduce((sum, reg) => sum + Number(reg.initial_amount || 0), 0),
    totalFinal: filteredRegisters.reduce((sum, reg) => sum + Number(reg.final_amount || 0), 0),
    totalDifference: filteredRegisters.reduce((sum, reg) => sum + Number(reg.difference_amount || 0), 0),
    openCount: filteredRegisters.filter(reg => reg.status === 'open').length,
    closedCount: filteredRegisters.filter(reg => reg.status !== 'open').length,
    totalCount: filteredRegisters.length,
    totalRefunds: 0 // This would be calculated from transactions in a real implementation
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  // Export as CSV
  const exportAsCSV = () => {
    if (filteredRegisters.length === 0) return;
    
    // Define CSV headers
    const headers = [
      'ID',
      'Status',
      'Data Abertura',
      'Data Fechamento',
      'Operador Abertura',
      'Operador Fechamento',
      'Valor Inicial',
      'Valor Final',
      'Diferença',
      'Valor Próximo Dia',
      'Notas'
    ];
    
    // Map data to CSV rows
    const rows = filteredRegisters.map(reg => [
      reg.id,
      reg.status === 'open' ? 'Aberto' : reg.status === 'auto_closed' ? 'Fechado Automaticamente' : 'Fechado',
      format(new Date(reg.opened_at), "dd/MM/yyyy HH:mm"),
      reg.closed_at ? format(new Date(reg.closed_at), "dd/MM/yyyy HH:mm") : '-',
      reg.opening_employee?.full_name || 'Não registrado',
      reg.closing_employee?.full_name || '-',
      reg.initial_amount.toFixed(2).replace('.', ','),
      reg.final_amount ? reg.final_amount.toFixed(2).replace('.', ',') : '-',
      reg.difference_amount ? reg.difference_amount.toFixed(2).replace('.', ',') : '-',
      reg.next_day_amount ? reg.next_day_amount.toFixed(2).replace('.', ',') : '0,00',
      reg.notes || '-'
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
    link.setAttribute('download', `relatorio-caixa-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Print report
  const handlePrint = () => {
    window.print();
  };
  
  // Switch between reports
  const renderReport = () => {
    switch(activeReport) {
      case 'canceled_orders':
        return <CanceledOrdersReport />;
      default:
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
              <h2 className="text-2xl font-bold text-gray-900">Relatório de Caixa</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </button>
                <button
                  onClick={exportAsCSV}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  disabled={filteredRegisters.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </button>
              </div>
            </div>
            
            {/* Report Type Selector */}
            <div className="bg-white p-4 rounded-lg shadow-md no-print">
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setActiveReport('cash_register')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    activeReport === 'cash_register' 
                      ? 'bg-primary-100 text-primary-800' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <BarChart className="h-4 w-4 inline-block mr-2" />
                  Relatório de Caixa
                </button>
                <button
                  onClick={() => setActiveReport('canceled_orders')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    activeReport === 'canceled_orders' 
                      ? 'bg-primary-100 text-primary-800' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <XCircle className="h-4 w-4 inline-block mr-2" />
                  Comandas Canceladas
                </button>
                <div className="flex-grow"></div>
                <button
                  onClick={handleBackToCashRegister}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Voltar para Caixa
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Date Range Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                  <div className="flex space-x-2">
                    <button
                      className={`flex-1 px-3 py-1 text-sm rounded-md ${
                        dateRangeOption === 'this-month' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => setDateRangeOption('this-month')}
                    >
                      Mês Atual
                    </button>
                    <button
                      className={`flex-1 px-3 py-1 text-sm rounded-md ${
                        dateRangeOption === 'last-month' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => setDateRangeOption('last-month')}
                    >
                      Mês Anterior
                    </button>
                    <button
                      className={`flex-1 px-3 py-1 text-sm rounded-md ${
                        dateRangeOption === 'custom' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => setDateRangeOption('custom')}
                    >
                      Personalizado
                    </button>
                  </div>
                </div>
                
                {/* Custom Date Range */}
                {dateRangeOption === 'custom' && (
                  <>
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
                          value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                          onChange={(e) => setStartDate(e.target.value ? parseISO(e.target.value) : null)}
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
                          value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                          onChange={(e) => setEndDate(e.target.value ? parseISO(e.target.value) : null)}
                          className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filter by Status */}
                <div>
                  <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="status-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'open' | 'closed')}
                    className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="open">Apenas Abertos</option>
                    <option value="closed">Apenas Fechados</option>
                  </select>
                </div>
                
                {/* Search */}
                <div className="md:col-span-2">
                  <label htmlFor="search-registers" className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="search-registers"
                      placeholder="Buscar por operador, notas ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-10 pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Date Navigation */}
              <div className="flex items-center justify-between mt-4">
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
                <div className="text-sm text-gray-500">
                  Exibindo {filteredRegisters.length} registros
                </div>
              </div>
            </div>
            
            <div className="print-section">
              {/* Report Title - visible when printing */}
              <div className="hidden print:block mb-6">
                <h1 className="text-2xl font-bold text-center">Relatório de Caixa</h1>
                <p className="text-center text-gray-600">{getDateRangeText()}</p>
                <p className="text-center text-gray-600">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
            
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <BarChart className="h-10 w-10 text-primary-500" />
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Resumo Financeiro</h3>
                        <p className="text-sm text-gray-500">{getDateRangeText()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total de Caixas:</span>
                      <span className="font-medium">{summary.totalCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Caixas Abertos:</span>
                      <span className="font-medium">{summary.openCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Caixas Fechados:</span>
                      <span className="font-medium">{summary.closedCount}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <TrendingUp className="h-10 w-10 text-green-500" />
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Valores Financeiros</h3>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Inicial Total:</span>
                      <span className="font-medium">{formatCurrency(summary.totalInitial)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Final Total:</span>
                      <span className="font-medium">{formatCurrency(summary.totalFinal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${summary.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Diferença Total:
                      </span>
                      <span className={`font-medium ${summary.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(summary.totalDifference)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PieChart className="h-10 w-10 text-blue-500" />
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Distribuição de Pagamentos</h3>
                      </div>
                    </div>
                  </div>
                  {isLoadingBalances ? (
                    <div className="flex justify-center items-center h-24">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  ) : monthlyBalance ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dinheiro:</span>
                        <span className="font-medium">{formatCurrency(monthlyBalance.paymentMethods.cash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cartões:</span>
                        <span className="font-medium">
                          {formatCurrency(monthlyBalance.paymentMethods.creditCard + monthlyBalance.paymentMethods.debitCard)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">PIX:</span>
                        <span className="font-medium">{formatCurrency(monthlyBalance.paymentMethods.pix)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cancelamentos:</span>
                        <span className="font-medium text-red-600">{formatCurrency(summary.totalRefunds)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-center text-gray-500">
                      Dados não disponíveis
                    </div>
                  )}
                </div>
              </div>

              {/* Registers Table */}
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Registros de Caixa
                  </h3>
                </div>
                
                {isLoading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Carregando registros...</p>
                  </div>
                ) : filteredRegisters.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    Nenhum registro de caixa encontrado para o período ou filtros selecionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data/Hora
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Operador
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor Inicial
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor Final
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Diferença
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider no-print">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRegisters.map((register) => (
                          <React.Fragment key={register.id}>
                            <tr 
                              className={`hover:bg-gray-50 ${expandedRegisterId === register.id ? 'bg-gray-50' : ''}`}
                            >
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(register.opened_at), "dd/MM/yyyy HH:mm")}
                                {register.closed_at && (
                                  <div className="text-xs text-gray-500">
                                    até {format(new Date(register.closed_at), "dd/MM/yyyy HH:mm")}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                {register.opening_employee?.full_name || 'Não registrado'}
                                {register.closing_employee && (
                                  <div className="text-xs">
                                    Fechado por: {register.closing_employee?.full_name}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(Number(register.initial_amount))}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                {register.final_amount ? formatCurrency(Number(register.final_amount)) : '-'}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm">
                                {register.difference_amount !== null ? (
                                  <span className={`${
                                    Number(register.difference_amount) > 0 
                                      ? 'text-green-600' 
                                      : Number(register.difference_amount) < 0 
                                        ? 'text-red-600' 
                                        : 'text-gray-500'
                                  }`}>
                                    {Number(register.difference_amount) > 0 ? '+' : ''}
                                    {formatCurrency(Number(register.difference_amount))}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  register.status === 'open' 
                                    ? 'bg-green-100 text-green-800' 
                                    : register.status === 'auto_closed'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {register.status === 'open' 
                                    ? 'Aberto' 
                                    : register.status === 'auto_closed'
                                    ? 'Fechado Auto.'
                                    : 'Fechado'}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-right space-x-2 no-print">
                                <button
                                  onClick={() => handleToggleDetails(register.id)}
                                  className="text-primary-600 hover:text-primary-900"
                                >
                                  {expandedRegisterId === register.id ? (
                                    <ChevronUp className="h-5 w-5 inline" />
                                  ) : (
                                    <Eye className="h-5 w-5 inline" />
                                  )}
                                </button>
                              </td>
                            </tr>
                            {expandedRegisterId === register.id && (
                              <tr>
                                <td colSpan={7} className="bg-gray-50 px-6 py-4">
                                  <div className="border-t border-gray-200 pt-4 text-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div>
                                        <h4 className="font-medium text-gray-900 mb-2">Detalhes de Operadores</h4>
                                        <div className="space-y-1 text-gray-600">
                                          <div>
                                            <span className="font-medium">Abertura: </span>
                                            {register.opening_employee?.full_name || 'Não registrado'}
                                          </div>
                                          {register.closing_employee && (
                                            <div>
                                              <span className="font-medium">Fechamento: </span>
                                              {register.closing_employee?.full_name}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {register.status !== 'open' && (
                                        <div>
                                          <h4 className="font-medium text-gray-900 mb-2">Dados Financeiros</h4>
                                          <div className="space-y-1 text-gray-600">
                                            <div>
                                              <span className="font-medium">Valor Esperado: </span>
                                              {formatCurrency(Number(register.expected_amount || 0))}
                                            </div>
                                            <div>
                                              <span className="font-medium">Valor Contado: </span>
                                              {formatCurrency(Number(register.final_amount || 0))}
                                            </div>
                                            <div>
                                              <span className="font-medium">Diferença: </span>
                                              <span className={`${
                                                Number(register.difference_amount) > 0 
                                                  ? 'text-green-600' 
                                                  : Number(register.difference_amount) < 0 
                                                    ? 'text-red-600' 
                                                    : ''
                                              }`}>
                                                {formatCurrency(Number(register.difference_amount || 0))}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="font-medium">Para Próximo Dia: </span>
                                              {formatCurrency(Number(register.next_day_amount || 0))}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {register.notes && (
                                      <div className="mt-2 bg-gray-100 p-3 rounded-md">
                                        <h4 className="font-medium text-gray-900 mb-1">Observações</h4>
                                        <p className="text-gray-600">
                                          {register.notes}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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
  };
  
  return renderReport();
}