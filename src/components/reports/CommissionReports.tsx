import React, { useState, useEffect, useRef } from 'react';
import { useProfiles } from '../../lib/profiles';
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  User, 
  Download, 
  Printer, 
  Search, 
  DollarSign, 
  PieChart, 
  BarChart, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Users,
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useTransactions } from '../../lib/transactions';
import { useOrders } from '../../lib/orders';
import * as XLSX from 'xlsx';

type PeriodType = 'daily' | 'weekly' | 'monthly';

export function CommissionReports() {
  // Input state (before applying filters)
  const [inputStartDate, setInputStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [inputEndDate, setInputEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [inputBarber, setInputBarber] = useState<string | 'all'>('all');
  const [inputSearchTerm, setInputSearchTerm] = useState('');
  
  // Applied filter state (after clicking "Apply" button)
  const [filterValues, setFilterValues] = useState({
    startDate: parseISO(format(subDays(new Date(), 30), 'yyyy-MM-dd')),
    endDate: parseISO(format(new Date(), 'yyyy-MM-dd')),
    barberId: 'all',
    searchTerm: ''
  });
  
  const [expandedBarber, setExpandedBarber] = useState<string | null>(null);
  const [expandedProfessionalItems, setExpandedProfessionalItems] = useState<{[key: string]: boolean}>({});
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [showCommissions, setShowCommissions] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  // Get profile and transaction data
  const { barbers, clients, fetchBarbers, fetchClients } = useProfiles();
  const { transactions, fetchTransactionsByDateRange } = useTransactions();
  const { orders, fetchOrders } = useOrders();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchBarbers(),
          fetchClients(),
          loadTransactions()
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const loadTransactions = async () => {
      try {
        // Load transactions for the specified date range
        await fetchTransactionsByDateRange(filterValues.startDate, filterValues.endDate);
        // Load orders data
        await fetchOrders();
      } catch (error) {
        console.error('Error loading transactions:', error);
      }
    };

    loadData();
  }, [filterValues, fetchBarbers, fetchClients, fetchTransactionsByDateRange, fetchOrders]);

  // Apply filters when the button is clicked
  const handleApplyFilters = () => {
    setIsApplyingFilters(true);
    
    // Parse dates from input fields
    const startDate = parseISO(inputStartDate);
    const endDate = parseISO(inputEndDate);
    
    // Set the filter values to trigger data reload
    setFilterValues({
      startDate,
      endDate,
      barberId: inputBarber,
      searchTerm: inputSearchTerm
    });
    
    setIsApplyingFilters(false);
  };
  
  // Reset filters
  const handleResetFilters = () => {
    const defaultStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const defaultEnd = format(new Date(), 'yyyy-MM-dd');
    
    // Reset input values
    setInputStartDate(defaultStart);
    setInputEndDate(defaultEnd);
    setInputBarber('all');
    setInputSearchTerm('');
    
    // Apply reset immediately
    setFilterValues({
      startDate: parseISO(defaultStart),
      endDate: parseISO(defaultEnd),
      barberId: 'all',
      searchTerm: ''
    });
  };

  // Toggle expanded state for a professional's items
  const toggleProfessionalItems = (professionalId: string) => {
    setExpandedProfessionalItems(prev => ({
      ...prev,
      [professionalId]: !prev[professionalId]
    }));
  };

  // Filter transactions based on selected barber and organize by professional
  const professionalCommissionData = React.useMemo(() => {
    // Filter transactions by date range and barber
    const filteredTransactions = transactions.filter(t => {
      const txDate = parseISO(t.created_at);
      const start  = startOfDay(filterValues.startDate);
      const end    = endOfDay  (filterValues.endDate);
  
      // único filtro de data, inclusivo
      if (!isWithinInterval(txDate, { start, end })) {
        return false;
      }
  
      // filtrar por barbeiro
      if (filterValues.barberId !== 'all' && t.barber_id !== filterValues.barberId) {
        return false;
      }
  
      // filtrar pelo termo de busca
      if (filterValues.searchTerm) {
        const term = filterValues.searchTerm.toLowerCase();
        const clientName = t.client?.full_name?.toLowerCase() || '';
        const barberName = t.barber?.full_name?.toLowerCase() || '';
        return clientName.includes(term) || barberName.includes(term);
      }
  
      return true;
    });

    // Map of professionals to their transactions and commissions
    const professionalMap: Record<string, {
      professional: any;
      transactions: any[];
      items: any[];
      totalCommission: number;
      serviceCommission: number;
      productCommission: number;
      totalSales: number;
      serviceCount: number;
      productCount: number;
    }> = {};

    // Process each transaction
    filteredTransactions.forEach(transaction => {
      if (!transaction.items) return;

      // Group items by professional
      transaction.items.forEach(item => {
        const professionalId = item.professional_id || transaction.barber_id;
        if (!professionalId) return;

        // Initialize professional entry if not exists
        if (!professionalMap[professionalId]) {
          const professional = barbers.find(b => b.id === professionalId);
          professionalMap[professionalId] = {
            professional,
            transactions: [],
            items: [],
            totalCommission: 0,
            serviceCommission: 0,
            productCommission: 0,
            totalSales: 0,
            serviceCount: 0,
            productCount: 0
          };
        }

        // Add transaction to professional's list if not already added
        if (!professionalMap[professionalId].transactions.find(t => t.id === transaction.id)) {
          professionalMap[professionalId].transactions.push(transaction);
        }

        // Add item to professional's list
        professionalMap[professionalId].items.push({
          ...item,
          transaction,
          date: transaction.created_at,
          client_name: transaction.client?.full_name
        });

        // Update counts and sales
        const isService = !!item.service_id;
        professionalMap[professionalId].totalSales += Number(item.total_price);
        
        if (isService) {
          professionalMap[professionalId].serviceCount++;
          const rate = professionalMap[professionalId].professional?.service_commission_rate || 50;
          const commission = (Number(item.total_price) * rate) / 100;
          professionalMap[professionalId].serviceCommission += commission;
          professionalMap[professionalId].totalCommission += commission;
        } else {
          professionalMap[professionalId].productCount++;
          const rate = professionalMap[professionalId].professional?.product_commission_rate || 10;
          const commission = (Number(item.total_price) * rate) / 100;
          professionalMap[professionalId].productCommission += commission;
          professionalMap[professionalId].totalCommission += commission;
        }
      });
    });

    // Convert to array and sort by commission
    return Object.values(professionalMap).sort((a, b) => b.totalCommission - a.totalCommission);
  }, [transactions, filterValues, barbers]);

  // Calculate total commissions
  const totalCommissions = professionalCommissionData.reduce((sum, data) => sum + data.totalCommission, 0);
  const totalSales = professionalCommissionData.reduce((sum, data) => sum + data.totalSales, 0);

  const handleExportExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create summary worksheet
    const summaryData = [
      ['Relatório de Comissões por Profissional', '', '', ''],
      [`Período: ${format(filterValues.startDate, 'dd/MM/yyyy')} a ${format(filterValues.endDate, 'dd/MM/yyyy')}`],
      ['', '', '', ''],
      ['Profissional', 'Total Vendas', 'Comissão Serviços', 'Comissão Produtos', 'Comissão Total', '% do Total'],
      ...professionalCommissionData.map(stats => [
        stats.professional?.full_name || 'Profissional não identificado',
        stats.totalSales.toFixed(2),
        stats.serviceCommission.toFixed(2),
        stats.productCommission.toFixed(2),
        stats.totalCommission.toFixed(2),
        ((stats.totalCommission / (totalCommissions || 1)) * 100).toFixed(2) + '%'
      ]),
      ['', '', '', ''],
      ['TOTAL', totalSales.toFixed(2), '', '', totalCommissions.toFixed(2), '100%'],
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo');
    
    // Create detailed worksheet for each professional
    professionalCommissionData.forEach(stats => {
      const professionalData = [
        [`Relatório Detalhado - ${stats.professional?.full_name || 'Profissional'}`],
        [`Período: ${format(filterValues.startDate, 'dd/MM/yyyy')} a ${format(filterValues.endDate, 'dd/MM/yyyy')}`],
        ['', ''],
        ['Resumo'],
        ['Total Vendas', stats.totalSales.toFixed(2)],
        ['Serviços', stats.serviceCount.toString()],
        ['Produtos', stats.productCount.toString()],
        ['Comissão Serviços', stats.serviceCommission.toFixed(2)],
        ['Comissão Produtos', stats.productCommission.toFixed(2)],
        ['Comissão Total', stats.totalCommission.toFixed(2)],
        ['Taxa de Comissão Serviços', `${stats.professional?.service_commission_rate || 50}%`],
        ['Taxa de Comissão Produtos', `${stats.professional?.product_commission_rate || 10}%`],
        ['', '']
      ];
      
      // Group items by client
      const clientsMap = stats.items.reduce((acc, item) => {
        const clientId = item.transaction.client_id;
        const clientName = item.transaction.client?.full_name || 'Cliente não identificado';
        
        if (!acc[clientId]) {
          acc[clientId] = {
            id: clientId,
            name: clientName,
            items: []
          };
        }
        
        acc[clientId].items.push(item);
        return acc;
      }, {} as Record<string, {id: string; name: string; items: any[]}>);
      
      // Add client data
      Object.values(clientsMap).forEach(client => {
        professionalData.push([`Cliente: ${client.name}`]);
        professionalData.push(['Data', 'Tipo', 'Item', 'Valor', 'Comissão']);
        
        client.items.forEach(item => {
          const isService = !!item.service_id;
          const itemName = isService ? item.service?.name : item.product?.name;
          const rate = isService 
            ? stats.professional?.service_commission_rate || 50
            : stats.professional?.product_commission_rate || 10;
          const commission = (Number(item.total_price) * rate) / 100;
          
          professionalData.push([
            format(new Date(item.date), 'dd/MM/yyyy'),
            isService ? 'Serviço' : 'Produto',
            itemName || 'Item desconhecido',
            Number(item.total_price).toFixed(2),
            commission.toFixed(2)
          ]);
        });
        
        professionalData.push(['', '', '', '', '']);
      });
      
      const professionalWs = XLSX.utils.aoa_to_sheet(professionalData);
      const safeSheetName = stats.professional?.full_name?.substring(0, 30) || 'Profissional';
      XLSX.utils.book_append_sheet(wb, professionalWs, safeSheetName);
    });
    
    // Generate file name
    const fileName = `relatorio-comissoes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    // Save workbook
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper function to group items by client for a professional
  const getProfessionalClientItems = (professionalId: string) => {
    const professional = professionalCommissionData.find(data => data.professional?.id === professionalId);
    if (!professional) return {};
    
    const clientMap: Record<string, {
      id: string;
      name: string;
      total: number;
      items: any[];
    }> = {};
    
    professional.items.forEach(item => {
      const clientId = item.transaction.client_id;
      const clientName = item.transaction.client?.full_name || 'Cliente não identificado';
      
      if (!clientMap[clientId]) {
        clientMap[clientId] = {
          id: clientId,
          name: clientName,
          total: 0,
          items: []
        };
      }
      
      clientMap[clientId].items.push(item);
      clientMap[clientId].total += Number(item.total_price);
    });
    
    return clientMap;
  };

  // Loading state
  if (isLoading && professionalCommissionData.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Print styles - only visible when printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-content, #printable-content * {
            visibility: visible;
          }
          #printable-content {
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
        <h2 className="text-2xl font-bold text-gray-900">Relatório de Comissões</h2>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </button>
          <button
            onClick={handleExportExcel}
            disabled={professionalCommissionData.length === 0}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar Excel
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-md p-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={inputStartDate}
                onChange={(e) => setInputStartDate(e.target.value)}
                className="pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={inputEndDate}
                onChange={(e) => setInputEndDate(e.target.value)}
                className="pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
            <div className="relative">
              <select
                value={inputBarber}
                onChange={(e) => setInputBarber(e.target.value)}
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              >
                <option value="all">Todos os profissionais</option>
                {barbers.map(barber => (
                  <option key={barber.id} value={barber.id}>{barber.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={inputSearchTerm}
                onChange={(e) => setInputSearchTerm(e.target.value)}
                placeholder="Buscar por nome..."
                className="pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
          
          <div className="flex items-end space-x-3">
            <button
              onClick={handleApplyFilters}
              disabled={isApplyingFilters}
              className="flex-grow h-10 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isApplyingFilters ? (
                <RefreshCw className="inline h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Filter className="inline h-4 w-4 mr-2" />
              )}
              Aplicar Filtros
            </button>
            
            <button
              onClick={handleResetFilters}
              className="h-10 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <XCircle className="inline h-4 w-4 mr-2" />
              Limpar
            </button>
          </div>
          
          <div className="flex space-x-3 md:col-span-3">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center ${
                viewMode === 'table' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileText className="h-4 w-4 mr-1" />
              Tabela
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center ${
                viewMode === 'chart' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BarChart className="h-4 w-4 mr-1" />
              Gráficos
            </button>
            
            <div className="flex-grow"></div>
            
            <div className="text-sm text-gray-600 flex items-center">
              {isLoading && (
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              )}
              Período: {format(filterValues.startDate, "dd/MM/yyyy")} a {format(filterValues.endDate, "dd/MM/yyyy")}
            </div>
          </div>
        </div>
      </div>
      
      {/* Report Content */}
      <div id="printable-content" className="space-y-6">
        {/* Print Header - only visible when printing */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-center">Relatório de Comissões</h1>
          <p className="text-center text-gray-600">
            {format(filterValues.startDate, "dd/MM/yyyy", { locale: ptBR })} a {format(filterValues.endDate, "dd/MM/yyyy", { locale: ptBR })}
          </p>
          <p className="text-center text-gray-600">
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white shadow rounded-md p-4">
            <div className="flex items-center">
              <DollarSign className="h-10 w-10 text-green-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Total Comissões</h3>
                <p className="text-2xl font-semibold text-green-600">R$ {totalCommissions.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-md p-4">
            <div className="flex items-center">
              <User className="h-10 w-10 text-primary-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Profissionais</h3>
                <p className="text-2xl font-semibold text-primary-600">{professionalCommissionData.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-md p-4">
            <div className="flex items-center">
              <FileText className="h-10 w-10 text-indigo-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Vendas Totais</h3>
                <p className="text-2xl font-semibold text-indigo-600">
                  R$ {totalSales.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-md p-4">
            <div className="flex items-center">
              <Users className="h-10 w-10 text-amber-500" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Comissão Média</h3>
                <p className="text-2xl font-semibold text-amber-600">
                  {professionalCommissionData.length > 0 
                    ? `R$ ${(totalCommissions / professionalCommissionData.length).toFixed(2)}` 
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'table' ? (
          <>
            {/* Professional Commissions */}
            <div className="bg-white shadow rounded-md overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Comissões por Profissional
                  </h3>
                  <div className="flex items-center">
                    <button
                      onClick={() => setShowCommissions(!showCommissions)}
                      className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                    >
                      {showCommissions ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Ocultar valores
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Mostrar valores
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-5 sm:p-0">
                <dl className="sm:divide-y sm:divide-gray-200">
                  {professionalCommissionData.length === 0 ? (
                    <div className="px-4 py-5 sm:px-6 text-center">
                      <p className="text-gray-500">Nenhum dado encontrado para o período selecionado.</p>
                      {isLoading && (
                        <div className="flex justify-center items-center mt-4">
                          <RefreshCw className="animate-spin h-6 w-6 text-primary-600" />
                        </div>
                      )}
                    </div>
                  ) : (
                    professionalCommissionData.map((stats) => (
                      <div key={stats.professional?.id || 'unknown'} className="px-4 py-5 sm:px-6">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBarber(expandedBarber === stats.professional?.id ? null : stats.professional?.id)}>
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">
                              {stats.professional?.full_name || 'Profissional não identificado'}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500">
                              {stats.transactions.length} atendimentos • {stats.serviceCount} serviços • {stats.productCount} produtos
                            </p>
                          </div>
                          <div className="flex items-center">
                            <div className="text-right mr-4">
                              <p className="text-sm font-medium text-gray-500">Comissão Total</p>
                              <p className="text-lg font-semibold text-primary-600">
                                {showCommissions ? `R$ ${stats.totalCommission.toFixed(2)}` : '•••••'}
                              </p>
                            </div>
                            {expandedBarber === stats.professional?.id ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                        
                        {expandedBarber === stats.professional?.id && (
                          <div className="mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs font-medium text-gray-500">Serviços</p>
                                <p className="text-lg font-semibold text-gray-900">R$ {stats.serviceCommission.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">Taxa: {stats.professional?.service_commission_rate || 50}%</p>
                              </div>
                              
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs font-medium text-gray-500">Produtos</p>
                                <p className="text-lg font-semibold text-gray-900">R$ {stats.productCommission.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">Taxa: {stats.professional?.product_commission_rate || 10}%</p>
                              </div>
                              
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs font-medium text-gray-500">Total Vendas</p>
                                <p className="text-lg font-semibold text-gray-900">R$ {stats.totalSales.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">{stats.transactions.length} transações</p>
                              </div>
                              
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs font-medium text-gray-500">Total Comissão</p>
                                <p className="text-lg font-semibold text-primary-600">R$ {stats.totalCommission.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">{((stats.totalCommission / totalCommissions) * 100).toFixed(1)}% do total</p>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-6">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-gray-700">Percentual das Comissões</h4>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className="bg-primary-600 h-2.5 rounded-full" 
                                  style={{ 
                                    width: `${Math.max(5, (stats.totalCommission / Math.max(...professionalCommissionData.map(s => s.totalCommission))) * 100)}%` 
                                  }}>
                                </div>
                              </div>
                              <p className="mt-1 text-xs text-right text-gray-600">
                                {((stats.totalCommission / totalCommissions) * 100).toFixed(1)}% do total
                              </p>
                            </div>

                            {/* Client List */}
                            <div className="mt-4">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Detalhamento por Cliente</h5>
                              
                              {/* Get clients and their items for this professional */}
                              {Object.values(getProfessionalClientItems(stats.professional?.id || '')).map(client => (
                                <div key={client.id} className="border rounded-md mb-3 overflow-hidden">
                                  <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
                                    <h6 className="text-sm font-medium text-gray-800">{client.name}</h6>
                                    <span className="text-sm font-medium text-primary-600">
                                      R$ {client.total.toFixed(2)}
                                    </span>
                                  </div>
                                  
                                  <div className="px-4 py-2">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleProfessionalItems(client.id);
                                      }}
                                      className="flex items-center justify-between w-full py-2 text-sm text-left text-gray-700"
                                    >
                                      <span className="font-medium">Detalhes dos Itens</span>
                                      {expandedProfessionalItems[client.id] ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </button>
                                    
                                    {expandedProfessionalItems[client.id] && (
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead>
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comissão</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {client.items.map((item, index) => {
                                            const isService = !!item.service_id;
                                            const commissionRate = isService 
                                              ? stats.professional?.service_commission_rate || 50
                                              : stats.professional?.product_commission_rate || 10;
                                            const commission = (Number(item.total_price) * commissionRate) / 100;
                                            
                                            return (
                                              <tr key={index}>
                                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                                  {format(new Date(item.date), "dd/MM/yyyy")}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                                  {isService ? 'Serviço' : 'Produto'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-800">
                                                  {item.service?.name || item.product?.name || 'Item desconhecido'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-800 text-right">
                                                  R$ {Number(item.total_price).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-primary-600 text-right">
                                                  R$ {showCommissions ? commission.toFixed(2) : '•••••'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {Object.keys(getProfessionalClientItems(stats.professional?.id || '')).length === 0 && (
                                <div className="bg-gray-50 p-4 rounded text-center text-gray-500">
                                  Nenhum cliente encontrado para este profissional no período selecionado.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </dl>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white shadow rounded-md p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Visualização Gráfica</h3>
            
            {/* Professionals Graph */}
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Comissões por Profissional</h4>
              <div className="h-60">
                {professionalCommissionData.map((stats, index) => (
                  <div key={stats.professional?.id || 'unknown'} className="flex items-center mb-4">
                    <div className="w-36 truncate pr-3 text-sm font-medium text-gray-900">
                      {stats.professional?.full_name || 'Profissional não identificado'}
                    </div>
                    <div className="flex-grow flex items-center">
                      <div 
                        className="h-8 rounded bg-primary-500" 
                        style={{ 
                          width: `${Math.max(5, (stats.totalCommission / Math.max(...professionalCommissionData.map(s => s.totalCommission))) * 100)}%`,
                          backgroundColor: index % 3 === 0 ? '#0284c7' : index % 3 === 1 ? '#0369a1' : '#075985'
                        }}
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        R$ {showCommissions ? stats.totalCommission.toFixed(2) : '•••••'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Pie Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Serviços vs Produtos (Comissões)</h4>
                <div className="flex">
                  <div className="w-40 h-40 relative">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="h-40 w-40 rounded-full overflow-hidden bg-primary-300">
                        <div 
                          className="h-40 w-40 bg-primary-500 absolute top-0 left-0 origin-center"
                          style={{
                            transform: `rotate(${360 * (professionalCommissionData.reduce((sum, s) => sum + s.serviceCommission, 0) / 
                              (totalCommissions || 1))}deg)`,
                          }}
                        >
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center">
                      <p className="text-xs font-semibold">Comissões</p>
                    </div>
                  </div>
                  <div className="flex-grow flex flex-col justify-center space-y-4">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-primary-500 rounded-sm mr-2"></div>
                      <span className="text-sm font-medium text-gray-700">Serviços</span>
                      <span className="ml-auto text-sm font-medium text-gray-900">
                        {professionalCommissionData.length > 0 ? 
                          ((professionalCommissionData.reduce((sum, s) => sum + s.serviceCommission, 0) / 
                            (totalCommissions || 1)) * 100).toFixed(1) + '%'
                          : '0%'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-primary-700 rounded-sm mr-2"></div>
                      <span className="text-sm font-medium text-gray-700">Produtos</span>
                      <span className="ml-auto text-sm font-medium text-gray-900">
                        {professionalCommissionData.length > 0 ? 
                          ((professionalCommissionData.reduce((sum, s) => sum + s.productCommission, 0) / 
                            (totalCommissions || 1)) * 100).toFixed(1) + '%'
                          : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Comissões por Profissional</h4>
                <div className="flex">
                  <div className="w-40 h-40 relative">
                    <div className="w-full h-full flex items-center justify-center">
                      <PieChart className="h-32 w-32 text-primary-200 opacity-10" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                      <p className="text-xs font-semibold text-primary-800">
                        Total:<br/>{showCommissions ? `R$ ${totalCommissions.toFixed(2)}` : '•••••'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-grow flex flex-col justify-center space-y-2">
                    {professionalCommissionData.slice(0, 4).map((stats, index) => (
                      <div key={stats.professional?.id || 'unknown'} className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-sm mr-2" 
                          style={{ 
                            backgroundColor: ['#0284c7', '#0369a1', '#075985', '#0c4a6e'][index % 4]
                          }}
                        ></div>
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
                          {stats.professional?.full_name || 'Profissional não identificado'}
                        </span>
                        <span className="ml-auto text-xs font-medium text-gray-900">
                          {showCommissions ? 
                            ((stats.totalCommission / totalCommissions) * 100).toFixed(1) + '%' 
                            : '•••••'}
                        </span>
                      </div>
                    ))}
                    {professionalCommissionData.length > 4 && (
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded-sm mr-2"></div>
                        <span className="text-xs font-medium text-gray-700">Outros</span>
                        <span className="ml-auto text-xs font-medium text-gray-900">
                          {showCommissions ? 
                            ((professionalCommissionData.slice(4).reduce((sum, s) => sum + s.totalCommission, 0) / totalCommissions) * 100).toFixed(1) + '%'
                            : '•••••'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}