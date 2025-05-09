import React, { useState, useRef } from 'react';
import { useCashRegister, type CashBalance } from '../../lib/cashRegisterStore';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  BarChart,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Printer,
  DollarSign,
  CreditCard,
  Wallet,
  Filter
} from 'lucide-react';

type PeriodType = 'daily' | 'weekly' | 'monthly';

export function CashRegisterReportTab() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [dailyBalance, setDailyBalance] = useState<CashBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { calculateDailyBalance, fetchCashRegisterHistory, previousRegisters } = useCashRegister();
  
  React.useEffect(() => {
    loadData();
  }, [selectedDate, periodType]);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load cash register history for the period
      let startDate: Date;
      let endDate: Date;
      
      if (periodType === 'daily') {
        startDate = selectedDate;
        endDate = selectedDate;
      } else if (periodType === 'weekly') {
        startDate = startOfWeek(selectedDate, { locale: ptBR });
        endDate = endOfWeek(selectedDate, { locale: ptBR });
      } else { // monthly
        startDate = startOfMonth(selectedDate);
        endDate = endOfMonth(selectedDate);
      }
      
      await fetchCashRegisterHistory(startDate, endDate);
      
      // Load daily balance for quick view
      const balance = await calculateDailyBalance(selectedDate);
      setDailyBalance(balance);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriodType(newPeriod);
  };
  
  const navigatePrevious = () => {
    if (periodType === 'daily') {
      setSelectedDate(prev => subDays(prev, 1));
    } else if (periodType === 'weekly') {
      setSelectedDate(prev => subDays(prev, 7));
    } else { // monthly
      setSelectedDate(prev => subMonths(prev, 1));
    }
  };
  
  const navigateNext = () => {
    if (periodType === 'daily') {
      setSelectedDate(prev => addDays(prev, 1));
    } else if (periodType === 'weekly') {
      setSelectedDate(prev => addDays(prev, 7));
    } else { // monthly
      setSelectedDate(prev => addMonths(prev, 1));
    }
  };
  
  const getPeriodLabel = () => {
    if (periodType === 'daily') {
      return format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } else if (periodType === 'weekly') {
      const start = startOfWeek(selectedDate, { locale: ptBR });
      const end = endOfWeek(selectedDate, { locale: ptBR });
      return `${format(start, "dd/MM", { locale: ptBR })} a ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
    } else { // monthly
      return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };
  
  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      
      document.body.innerHTML = `
        <div class="p-8">
          <h1 class="text-2xl font-bold mb-4">Relatório de Caixa - ${getPeriodLabel()}</h1>
          ${printContent}
          <div class="text-sm text-gray-500 mt-6 text-center">
            BarberPro - Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      `;
      
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };
  
  const handleExportCSV = () => {
    if (!previousRegisters.length) return;
    
    // Build CSV data
    const headers = [
      'Data Abertura', 
      'Data Fechamento', 
      'Operador Abertura', 
      'Operador Fechamento', 
      'Valor Inicial', 
      'Valor Final',
      'Valor Esperado',
      'Diferença',
      'Valor Próximo Dia',
      'Status',
      'Observações'
    ];
    
    const rows = previousRegisters.map(register => [
      format(new Date(register.opened_at), "dd/MM/yyyy HH:mm"),
      register.closed_at ? format(new Date(register.closed_at), "dd/MM/yyyy HH:mm") : '-',
      register.opening_employee?.full_name || '-',
      register.closing_employee?.full_name || '-',
      Number(register.initial_amount).toFixed(2),
      register.final_amount ? Number(register.final_amount).toFixed(2) : '-',
      register.expected_amount ? Number(register.expected_amount).toFixed(2) : '-',
      register.difference_amount ? Number(register.difference_amount).toFixed(2) : '-',
      register.next_day_amount ? Number(register.next_day_amount).toFixed(2) : '0.00',
      register.status === 'open' ? 'Aberto' : 'Fechado',
      register.notes || '-'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create file and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-caixa-${format(selectedDate, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Calculate summary data
  const calculateSummary = () => {
    let initialTotal = 0;
    let finalTotal = 0;
    let differenceTotal = 0;
    
    previousRegisters.forEach(register => {
      initialTotal += Number(register.initial_amount || 0);
      finalTotal += Number(register.final_amount || 0);
      differenceTotal += Number(register.difference_amount || 0);
    });
    
    return {
      registers: previousRegisters.length,
      initialTotal,
      finalTotal,
      differenceTotal,
      closedRegisters: previousRegisters.filter(r => r.status === 'closed').length,
      openRegisters: previousRegisters.filter(r => r.status === 'open').length,
    };
  };
  
  const summary = calculateSummary();
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Relatórios de Caixa</h2>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!previousRegisters.length}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </button>
        </div>
      </div>
      
      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => handlePeriodChange('daily')}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                periodType === 'daily' 
                  ? 'bg-primary-100 text-primary-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Diário
            </button>
            <button
              onClick={() => handlePeriodChange('weekly')}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                periodType === 'weekly' 
                  ? 'bg-primary-100 text-primary-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => handlePeriodChange('monthly')}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                periodType === 'monthly' 
                  ? 'bg-primary-100 text-primary-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Mensal
            </button>
          </div>
          
          <div className="flex items-center mt-2 md:mt-0">
            <button
              onClick={navigatePrevious}
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <span className="px-2 text-gray-700 font-medium">
              {getPeriodLabel()}
            </span>
            <button
              onClick={navigateNext}
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2 mt-2 md:mt-0">
            <span className="text-sm text-gray-500">
              <Calendar className="h-4 w-4 inline mr-1" />
              Hoje
            </span>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1 text-sm font-medium rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              Ir para Hoje
            </button>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="space-y-6" ref={printRef}>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <FileText className="h-10 w-10 text-indigo-500" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Resumo do Período</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>Caixas abertos: {summary.registers}</p>
                    <p>Caixas fechados: {summary.closedRegisters}</p>
                    <p>Caixas em aberto: {summary.openRegisters}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <BarChart className="h-10 w-10 text-green-500" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Movimento do Período</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>Total inicial: R$ {summary.initialTotal.toFixed(2)}</p>
                    <p>Total fechamento: R$ {summary.finalTotal.toFixed(2)}</p>
                    <p className={`font-semibold ${summary.differenceTotal !== 0 
                      ? (summary.differenceTotal > 0 ? 'text-green-600' : 'text-red-600') 
                      : ''}`}>
                      Diferença: R$ {summary.differenceTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {dailyBalance && periodType === 'daily' && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center">
                  <DollarSign className="h-10 w-10 text-amber-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Balanço do Dia</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span className="flex items-center">
                          <Wallet className="h-4 w-4 mr-1 text-green-500" />
                          Dinheiro:
                        </span>
                        <span className="font-medium">R$ {dailyBalance.cash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="flex items-center">
                          <CreditCard className="h-4 w-4 mr-1 text-blue-500" />
                          Cartões:
                        </span>
                        <span className="font-medium">R$ {(dailyBalance.creditCard + dailyBalance.debitCard).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-semibold">R$ {dailyBalance.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Cash Registers Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Registros de Caixa
              </h3>
              
              <div className="text-sm text-gray-500">
                Exibindo {previousRegisters.length} registro{previousRegisters.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operador
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Início
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diferença
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previousRegisters.map((register) => (
                    <tr key={register.id} className="hover:bg-gray-50 cursor-pointer" 
                      onClick={() => window.location.href = `#register-${register.id}`}>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(register.opened_at), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {register.opening_employee?.full_name || 'Não registrado'}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        R$ {Number(register.initial_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {register.final_amount 
                          ? `R$ ${Number(register.final_amount).toFixed(2)}` 
                          : '-'}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                        {register.difference_amount ? (
                          <span className={`${
                            Number(register.difference_amount) > 0 
                              ? 'text-green-600' 
                              : Number(register.difference_amount) < 0 
                                ? 'text-red-600' 
                                : 'text-gray-500'
                          }`}>
                            {Number(register.difference_amount) > 0 ? '+' : ''}
                            R$ {Number(register.difference_amount).toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          register.status === 'open' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {register.status === 'open' ? 'Aberto' : 'Fechado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  
                  {previousRegisters.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-sm text-center text-gray-500">
                        Nenhum registro encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}