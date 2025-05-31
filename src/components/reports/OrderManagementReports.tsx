import React, { useState, useEffect, useRef } from 'react';
import { useOrders } from '../../lib/orders';
import { useProfiles } from '../../lib/profiles';
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  List, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User, 
  DollarSign, 
  Download, 
  Printer, 
  FileText,
  Settings,
  XCircle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  Users,
  CheckSquare,
  Square,
  ThumbsUp,
  BarChart2,
  Sliders
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { OrderForm } from '../orders/OrderForm';
import * as XLSX from 'xlsx';

interface EditLogEntry {
  timestamp: string;
  user: string;
  changes: string[];
}

type ViewMode = 'list' | 'calendar';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled';
type DateRangeFilter = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom';
type SortOption = 'date-desc' | 'date-asc' | 'value-desc' | 'value-asc' | 'client' | 'barber';

export function OrderManagementReports() {
  const { orders, isLoading, error, fetchOrders, updateOrder, updateOrderStatus } = useOrders();
  const { barbers, clients, fetchBarbers, fetchClients } = useProfiles();
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isEditingOrder, setIsEditingOrder] = useState<boolean>(false);
  const [editingOrderData, setEditingOrderData] = useState<any>(null);
  const [isShowingDetails, setIsShowingDetails] = useState<boolean>(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [editLog, setEditLog] = useState<EditLogEntry[]>([]);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('thisMonth');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBarber, setSelectedBarber] = useState<string | 'all'>('all');
  const [selectedClient, setSelectedClient] = useState<string | 'all'>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [filterValues, setFilterValues] = useState({
    status: 'all',
    dateRange: 'thisMonth', 
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    barber: 'all',
    client: 'all',
    serviceType: 'all',
    search: ''
  });
  
  // Sorting state
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  useEffect(() => {
    fetchOrders();
    fetchBarbers();
    fetchClients();
    
    // Generate mock edit logs (in a real app, these would come from the database)
    const mockLogs: EditLogEntry[] = [
      {
        timestamp: format(subDays(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss"),
        user: 'Admin',
        changes: ['Alterado barbeiro de "João Silva" para "Carlos Santos"', 
                 'Adicionado produto "Pomada Modeladora"']
      },
      {
        timestamp: format(subDays(new Date(), 4), "yyyy-MM-dd'T'HH:mm:ss"),
        user: 'Marina Oliveira',
        changes: ['Alterado valor de R$ 130,00 para R$ 145,00', 
                 'Adicionado serviço "Barba Completa"']
      }
    ];
    
    setEditLog(mockLogs);
    
    // Set date range based on filter
    updateDateRange(dateRangeFilter);
    
  }, [fetchOrders, fetchBarbers, fetchClients]);
  
  // Apply filters when the Apply button is clicked
  const applyFilters = () => {
    // Update filter values to current state
    setFilterValues({
      status: statusFilter,
      dateRange: dateRangeFilter,
      startDate: startDate,
      endDate: endDate,
      barber: selectedBarber,
      client: selectedClient,
      serviceType: serviceTypeFilter,
      search: searchTerm
    });
    
    // Reset to first page when filters change
    setCurrentPage(1);
  };
  
  // Reset all filters to default
  const resetFilters = () => {
    setStatusFilter('all');
    setDateRangeFilter('thisMonth');
    updateDateRange('thisMonth');
    setSelectedBarber('all');
    setSelectedClient('all');
    setServiceTypeFilter('all');
    setSearchTerm('');
    
    // Apply the reset immediately
    setFilterValues({
      status: 'all',
      dateRange: 'thisMonth',
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      barber: 'all',
      client: 'all',
      serviceType: 'all',
      search: ''
    });
    
    // Reset to first page
    setCurrentPage(1);
  };
  
  // Update date range when filter changes
  useEffect(() => {
    updateDateRange(dateRangeFilter);
  }, [dateRangeFilter]);
  
  // Function to update date range based on filter
  const updateDateRange = (filter: DateRangeFilter) => {
    const now = new Date();
    
    switch (filter) {
      case 'today':
        setStartDate(format(now, 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'thisWeek':
        // First day of current week (Sunday)
        const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        setStartDate(format(firstDayOfWeek, 'yyyy-MM-dd'));
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        break;
      case 'thisMonth':
        // First day of current month
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(format(firstDayOfMonth, 'yyyy-MM-dd'));
        setEndDate(format(new Date(), 'yyyy-MM-dd'));
        break;
      case 'custom':
        // Don't change dates for custom range
        break;
    }
  };

  // Filter and sort orders
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Filter by status
      if (filterValues.status !== 'all' && order.status !== filterValues.status) {
        return false;
      }
      
      // Filter by date range
      const orderDate = new Date(order.created_at);
      const startDateObj = parseISO(filterValues.startDate);
      const endDateObj = new Date(filterValues.endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      if (orderDate < startDateObj || orderDate > endDateObj) {
        return false;
      }
      
      // Filter by barber
      if (filterValues.barber !== 'all' && order.barber_id !== filterValues.barber) {
        return false;
      }
      
      // Filter by client
      if (filterValues.client !== 'all' && order.client_id !== filterValues.client) {
        return false;
      }
      
      // Filter by service type
      if (filterValues.serviceType !== 'all') {
        const hasService = order.items?.some(item => 
          item.service_id === filterValues.serviceType
        );
        if (!hasService) return false;
      }
      
      // Filter by search term
      if (filterValues.search) {
        const searchLower = filterValues.search.toLowerCase();
        const orderIdMatch = order.id.toLowerCase().includes(searchLower);
        const clientNameMatch = order.client?.full_name?.toLowerCase().includes(searchLower);
        const barberNameMatch = order.barber?.full_name?.toLowerCase().includes(searchLower);
        
        // Search in items
        const itemsMatch = order.items?.some(item => 
          (item.service?.name && item.service.name.toLowerCase().includes(searchLower)) ||
          (item.product?.name && item.product.name.toLowerCase().includes(searchLower))
        );
        
        if (!(orderIdMatch || clientNameMatch || barberNameMatch || itemsMatch)) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'value-desc':
          return Number(b.total_amount) - Number(a.total_amount);
        case 'value-asc':
          return Number(a.total_amount) - Number(b.total_amount);
        case 'client':
          return (a.client?.full_name || '').localeCompare(b.client?.full_name || '');
        case 'barber':
          return (a.barber?.full_name || '').localeCompare(b.barber?.full_name || '');
        default:
          return 0;
      }
    });
  }, [orders, filterValues, sortOption]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentItems = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calendar events
  const calendarEvents = filteredOrders.map(order => {
    let color;
    switch (order.status) {
      case 'open': color = '#EAB308'; break; // Yellow
      case 'in_progress': color = '#3B82F6'; break; // Blue
      case 'completed': color = '#10B981'; break; // Green
      case 'cancelled': color = '#EF4444'; break; // Red
      default: color = '#6B7280'; // Gray
    }
    
    return {
      id: order.id,
      title: `${order.client?.full_name || 'Cliente'} - R$ ${Number(order.total_amount).toFixed(2)}`,
      start: order.created_at,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        order: order
      }
    };
  });
  
  // Handle calendar event click
  const handleEventClick = (info: any) => {
    const order = info.event.extendedProps.order;
    setSelectedOrderDetails(order);
    setIsShowingDetails(true);
  };

  // Handle edit order
  const handleEditOrder = (order: any) => {
    setEditingOrderData(order);
    setIsEditingOrder(true);
  };
  
  // Handle view order details
  const handleViewOrderDetails = (order: any) => {
    setSelectedOrderDetails(order);
    setIsShowingDetails(true);
  };

  // Handle order selection for bulk actions
  const handleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(orderId)) {
        newSelection.delete(orderId);
      } else {
        newSelection.add(orderId);
      }
      return newSelection;
    });
  };

  // Handle select/deselect all orders
  const handleSelectAll = () => {
    if (selectedOrders.size === currentItems.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(currentItems.map(order => order.id)));
    }
  };

  // Export orders to Excel
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Export all filtered orders
    const ordersToExport = filteredOrders;
    
    // Create worksheet with order data
    const worksheetData = [
      ['ID', 'Data', 'Cliente', 'Barbeiro', 'Status', 'Total', 'Itens']
    ];
    
    ordersToExport.forEach(order => {
      const items = order.items
        ?.map(item => `${item.quantity}x ${item.service?.name || item.product?.name || 'Item'}`)
        .join(', ');
      
      worksheetData.push([
        order.id.substring(0, 8),
        format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
        order.client?.full_name || 'Cliente não encontrado',
        order.barber?.full_name || 'Barbeiro não atribuído',
        getStatusLabel(order.status),
        Number(order.total_amount).toFixed(2),
        items || 'Sem itens'
      ]);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comandas');
    
    // Create detailed worksheet with items
    const detailedData = [
      ['ID Comanda', 'Data', 'Cliente', 'Barbeiro', 'Item', 'Tipo', 'Quantidade', 'Preço Unitário', 'Valor Total']
    ];
    
    ordersToExport.forEach(order => {
      order.items?.forEach(item => {
        detailedData.push([
          order.id.substring(0, 8),
          format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
          order.client?.full_name || 'Cliente não encontrado',
          order.barber?.full_name || 'Barbeiro não atribuído',
          item.service?.name || item.product?.name || 'Item desconhecido',
          item.service_id ? 'Serviço' : 'Produto',
          item.quantity.toString(),
          Number(item.unit_price).toFixed(2),
          Number(item.total_price).toFixed(2)
        ]);
      });
    });
    
    const detailedWorksheet = XLSX.utils.aoa_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(workbook, detailedWorksheet, 'Itens Detalhados');
    
    // Generate file name with date range
    const fileName = `comandas_${format(parseISO(filterValues.startDate), 'yyyyMMdd')}_a_${format(parseISO(filterValues.endDate), 'yyyyMMdd')}.xlsx`;
    
    // Export file
    XLSX.writeFile(workbook, fileName);
  };
  
  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Status utilities
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluída';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800'; // Yellow
      case 'in_progress': return 'bg-blue-100 text-blue-800'; // Blue
      case 'completed': return 'bg-green-100 text-green-800'; // Green
      case 'cancelled': return 'bg-red-100 text-red-800'; // Red
      default: return 'bg-gray-100 text-gray-800'; // Gray
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <ThumbsUp className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Filter Panel */}
      <div className="bg-white shadow rounded-md p-6 no-print">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Filter className="h-5 w-5 mr-2 text-gray-500" />
            Filtros
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={resetFilters}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="thisWeek">Esta Semana</option>
              <option value="thisMonth">Este Mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          
          {dateRangeFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os status</option>
              <option value="open">Aberta</option>
              <option value="in_progress">Em Andamento</option>
              <option value="completed">Concluída</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barbeiro</label>
            <select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os barbeiros</option>
              {barbers.map(barber => (
                <option key={barber.id} value={barber.id}>{barber.full_name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">Todos os clientes</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.full_name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="date-desc">Data (mais recente)</option>
              <option value="date-asc">Data (mais antiga)</option>
              <option value="value-desc">Valor (maior)</option>
              <option value="value-asc">Valor (menor)</option>
              <option value="client">Nome do cliente</option>
              <option value="barber">Nome do barbeiro</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, barbeiro ou serviço..."
                className="h-10 pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
          
          <div className="flex items-end">
            <button 
              onClick={applyFilters}
              className="h-10 w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center mt-4">
          <div className="flex flex-wrap gap-2 md:gap-4">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center ${
                viewMode === 'list' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center ${
                viewMode === 'calendar' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Calendário
            </button>
            
            <span className="ml-4 text-sm text-gray-600">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'comanda encontrada' : 'comandas encontradas'}
            </span>
          </div>
          
          <div className="flex gap-2 mt-4 md:mt-0">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      <div id="printable-content">
        {/* Print Header - only visible when printing */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-center">Relatório de Comandas</h1>
          <p className="text-center text-gray-600">
            {format(parseISO(filterValues.startDate), "dd/MM/yyyy", { locale: ptBR })} a {format(parseISO(filterValues.endDate), "dd/MM/yyyy", { locale: ptBR })}
          </p>
          <p className="text-center text-gray-600">
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          <p className="text-center text-gray-600">
            {filterValues.status !== 'all' && `Status: ${getStatusLabel(filterValues.status)} | `}
            {filterValues.barber !== 'all' && `Barbeiro: ${barbers.find(b => b.id === filterValues.barber)?.full_name} | `}
            {filterValues.client !== 'all' && `Cliente: ${clients.find(c => c.id === filterValues.client)?.full_name}`}
          </p>
        </div>
        
        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="h-[600px]">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={calendarEvents}
                eventClick={handleEventClick}
                locale="pt-br"
                height="100%"
              />
            </div>
          </div>
        )}
        
        {/* List View */}
        {viewMode === 'list' && (
          <>
            <div className="bg-white shadow rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider no-print">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedOrders.size > 0 && selectedOrders.size === currentItems.length}
                            onChange={handleSelectAll}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </div>
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID / Data
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Itens
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider no-print">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentItems.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap no-print">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => handleOrderSelection(order.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            #{order.id.substring(0, 8)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-1" />
                            <div className="text-sm font-medium text-gray-900">
                              {order.client?.full_name || 'Cliente não encontrado'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {order.items?.map((item, idx) => (
                              <span key={idx} className="inline-block mr-1">
                                {item.quantity}x {item.service?.name || item.product?.name || 'Item'}{idx < order.items.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span className="ml-1">{getStatusLabel(order.status)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          R$ {Number(order.total_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium no-print">
                          <button 
                            onClick={() => handleViewOrderDetails(order)}
                            className="text-primary-600 hover:text-primary-900 mr-3"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => handleEditOrder(order)}
                            className="text-primary-600 hover:text-primary-900 mr-3"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {currentItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 whitespace-nowrap">
                          Nenhuma comanda encontrada para os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 no-print">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando <span className="font-medium">{filteredOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a{" "}
                        <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> de{" "}
                        <span className="font-medium">{filteredOrders.length}</span> resultados
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span className="sr-only">Anterior</span>
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        
                        {/* Always show first page */}
                        {currentPage > 3 && (
                          <button
                            onClick={() => setCurrentPage(1)}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                          >
                            1
                          </button>
                        )}
                        
                        {/* Ellipsis for skipped pages */}
                        {currentPage > 4 && (
                          <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            ...
                          </span>
                        )}
                        
                        {/* Page number buttons */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => 
                            page === 1 || 
                            page === totalPages || 
                            (page >= currentPage - 1 && page <= currentPage + 1))
                          .map(page => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 border ${
                                page === currentPage
                                  ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              } text-sm font-medium`}
                            >
                              {page}
                            </button>
                          ))}
                        
                        {/* Ellipsis for skipped pages */}
                        {currentPage < totalPages - 3 && (
                          <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            ...
                          </span>
                        )}
                        
                        {/* Always show last page */}
                        {currentPage < totalPages - 2 && totalPages > 1 && (
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages || totalPages === 0}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span className="sr-only">Próxima</span>
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}

              {/* Items per page selector */}
              <div className="px-4 py-2 border-t border-gray-200 flex justify-end items-center no-print">
                <div className="flex items-center">
                  <label htmlFor="items-per-page" className="text-sm text-gray-700 mr-2">
                    Itens por página:
                  </label>
                  <select
                    id="items-per-page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page when changing items per page
                    }}
                    className="form-select rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Edit Order Modal */}
      {isEditingOrder && editingOrderData && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Editar Comanda #{editingOrderData.id.substring(0, 8)}
              </h2>
              <button 
                onClick={() => setIsEditingOrder(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <OrderForm 
              initialData={editingOrderData} 
              onClose={() => {
                setIsEditingOrder(false);
                setEditingOrderData(null);
                fetchOrders();
              }} 
            />
          </div>
        </div>
      )}
      
      {/* Order Details Modal */}
      {isShowingDetails && selectedOrderDetails && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Detalhes da Comanda #{selectedOrderDetails.id.substring(0, 8)}
              </h2>
              <button 
                onClick={() => {
                  setIsShowingDetails(false);
                  setSelectedOrderDetails(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* General Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Cliente</h3>
                  <div className="flex items-start">
                    <User className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedOrderDetails.client?.full_name || 'Cliente não encontrado'}
                      </p>
                      {selectedOrderDetails.client?.email && (
                        <p className="text-xs text-gray-500">{selectedOrderDetails.client.email}</p>
                      )}
                      {selectedOrderDetails.client?.phone && (
                        <p className="text-xs text-gray-500">{selectedOrderDetails.client.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Barbeiro</h3>
                  <div className="flex items-start">
                    <Users className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedOrderDetails.barber?.full_name || 'Não atribuído'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Informações</h3>
                  <div>
                    <p className="text-xs text-gray-500">Data:</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(selectedOrderDetails.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Status:</p>
                    <p className={`text-sm font-medium mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(selectedOrderDetails.status)}`}>
                      {getStatusIcon(selectedOrderDetails.status)}
                      <span className="ml-1">{getStatusLabel(selectedOrderDetails.status)}</span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Items */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Itens</h3>
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Profissional
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantidade
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Preço Unit.
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrderDetails.items?.map((item, index) => {
                        const professional = barbers.find(b => b.id === item.professional_id)?.full_name || 'Não atribuído';
                        
                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.service?.name || item.product?.name || 'Item desconhecido'}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm text-gray-500">
                                {item.service_id ? 'Serviço' : 'Produto'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-500">
                                {professional}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-500">
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <span className="text-sm text-gray-500">
                                R$ {Number(item.unit_price).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <span className="text-sm font-medium text-gray-900">
                                R$ {Number(item.total_price).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          Total
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          R$ {Number(selectedOrderDetails.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              {/* Edit Log */}
              {selectedOrderDetails.status === 'completed' && editLog.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-1 text-gray-500" />
                    Histórico de Edições
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    {editLog.map((log, idx) => (
                      <div key={idx} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-b-0 border-gray-200">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium text-gray-700">{log.user}</p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {log.changes.map((change, changeIdx) => (
                            <li key={changeIdx} className="flex items-start">
                              <Edit2 className="h-3 w-3 mr-1 mt-0.5 text-primary-500 flex-shrink-0" />
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 border-t pt-4 no-print">
                <button
                  onClick={() => {
                    setIsShowingDetails(false);
                    setSelectedOrderDetails(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setIsShowingDetails(false);
                    handleEditOrder(selectedOrderDetails);
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Edit2 className="h-4 w-4 inline-block mr-1" />
                  Editar Comanda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}