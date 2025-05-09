import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfiles } from '../../lib/profiles';
import { useTransactions } from '../../lib/transactions';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  User, 
  ArrowLeft, 
  Download, 
  Printer, 
  DollarSign, 
  FileText,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';

export function BarberCommissionReport() {
  const { barberId } = useParams<{ barberId: string }>();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(format(parseISO(localStorage.getItem('commissionStartDate') || new Date().toISOString()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(parseISO(localStorage.getItem('commissionEndDate') || new Date().toISOString()), 'yyyy-MM-dd'));
  
  const { barbers, fetchBarbers } = useProfiles();
  const { fetchTransactionsByBarberId } = useTransactions();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchBarbers();
      
      if (barberId) {
        const barberTransactions = await fetchTransactionsByBarberId(
          barberId,
          parseISO(startDate),
          parseISO(endDate)
        );
        setTransactions(barberTransactions);
      }
      
      setIsLoading(false);
    };
    
    loadData();
  }, [fetchBarbers, fetchTransactionsByBarberId, barberId, startDate, endDate]);
  
  // Find barber details
  const barber = barbers.find(b => b.id === barberId);
  
  // Calculate totals and commissions
  const serviceItems = transactions.flatMap(t => 
    (t.items || []).filter((item: any) => item.service_id)
  );
  
  const productItems = transactions.flatMap(t => 
    (t.items || []).filter((item: any) => item.product_id)
  );
  
  const serviceTotal = serviceItems.reduce((sum, item) => sum + Number(item.total_price), 0);
  const productTotal = productItems.reduce((sum, item) => sum + Number(item.total_price), 0);
  const total = serviceTotal + productTotal;
  
  const serviceCommission = serviceTotal * (barber?.service_commission_rate || 50) / 100;
  const productCommission = productTotal * (barber?.product_commission_rate || 10) / 100;
  const totalCommission = serviceCommission + productCommission;
  
  // Group transactions by client
  const clientTransactions = transactions.reduce((acc, transaction) => {
    const clientId = transaction.client_id;
    
    if (!acc[clientId]) {
      acc[clientId] = {
        id: clientId,
        name: transaction.client?.full_name || 'Cliente não identificado',
        transactions: [],
        total: 0
      };
    }
    
    acc[clientId].transactions.push(transaction);
    acc[clientId].total += Number(transaction.total_amount);
    
    return acc;
  }, {} as Record<string, { id: string; name: string; transactions: any[]; total: number }>);
  
  const handleExportExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create overview worksheet
    const overviewData = [
      ['Relatório de Comissão - ' + (barber?.full_name || 'Barbeiro')],
      [`Período: ${format(parseISO(startDate), 'dd/MM/yyyy', { locale: ptBR })} a ${format(parseISO(endDate), 'dd/MM/yyyy', { locale: ptBR })}`],
      ['', ''],
      ['Resumo'],
      ['Total Vendas Serviços', `R$ ${serviceTotal.toFixed(2)}`],
      ['Total Vendas Produtos', `R$ ${productTotal.toFixed(2)}`],
      ['Total Vendas', `R$ ${total.toFixed(2)}`],
      ['', ''],
      ['Taxa Comissão Serviços', `${barber?.service_commission_rate || 50}%`],
      ['Taxa Comissão Produtos', `${barber?.product_commission_rate || 10}%`],
      ['', ''],
      ['Comissão Serviços', `R$ ${serviceCommission.toFixed(2)}`],
      ['Comissão Produtos', `R$ ${productCommission.toFixed(2)}`],
      ['Comissão Total', `R$ ${totalCommission.toFixed(2)}`],
      ['', ''],
      ['Detalhamento por Cliente'],
      ['Cliente', 'Qtd Transações', 'Total Vendas']
    ];
    
    Object.values(clientTransactions).forEach(client => {
      overviewData.push([
        client.name,
        client.transactions.length.toString(),
        `R$ ${client.total.toFixed(2)}`
      ]);
    });
    
    const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, 'Resumo');
    
    // Create detailed worksheet
    const detailedData = [
      ['Relatório Detalhado de Vendas e Comissões'],
      [`Barbeiro: ${barber?.full_name || 'Barbeiro'}`],
      [`Período: ${format(parseISO(startDate), 'dd/MM/yyyy', { locale: ptBR })} a ${format(parseISO(endDate), 'dd/MM/yyyy', { locale: ptBR })}`],
      ['', '', '', '', '', ''],
      ['Data', 'Cliente', 'Item', 'Tipo', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Comissão']
    ];
    
    transactions.forEach(transaction => {
      const clientName = transaction.client?.full_name || 'Cliente não identificado';
      
      (transaction.items || []).forEach((item: any) => {
        const isService = !!item.service_id;
        const itemName = isService ? item.service?.name : item.product?.name;
        const commissionRate = isService ? barber?.service_commission_rate : barber?.product_commission_rate;
        const itemCommission = (Number(item.total_price) * (commissionRate || 0)) / 100;
        
        detailedData.push([
          format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm'),
          clientName,
          itemName || 'Item desconhecido',
          isService ? 'Serviço' : 'Produto',
          item.quantity.toString(),
          Number(item.unit_price).toFixed(2),
          Number(item.total_price).toFixed(2),
          itemCommission.toFixed(2)
        ]);
      });
    });
    
    const detailedWs = XLSX.utils.aoa_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, detailedWs, 'Detalhes');
    
    // Generate file name
    const fileName = `comissao_${barber?.full_name.replace(/\s+/g, '_') || 'barbeiro'}_${format(parseISO(startDate), 'yyyyMMdd')}_${format(parseISO(endDate), 'yyyyMMdd')}.xlsx`;
    
    // Save workbook
    XLSX.writeFile(wb, fileName);
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleBack = () => {
    navigate('/reports');
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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
  
      <div className="flex justify-between items-center no-print">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="mr-4 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            Relatório de Comissões - {barber?.full_name || 'Barbeiro'}
          </h2>
        </div>
        
        <div className="flex space-x-3">
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
      
      <div className="bg-white shadow rounded-md p-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  localStorage.setItem('commissionStartDate', new Date(e.target.value).toISOString());
                }}
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
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  localStorage.setItem('commissionEndDate', new Date(e.target.value).toISOString());
                }}
                className="pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div id="printable-content" className="space-y-6">
        {/* Print Header - only visible when printing */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-center">Relatório de Comissões</h1>
          <h2 className="text-xl font-bold text-center mt-2">{barber?.full_name || 'Barbeiro'}</h2>
          <p className="text-center text-gray-600">
            {format(parseISO(startDate), "dd/MM/yyyy", { locale: ptBR })} a {format(parseISO(endDate), "dd/MM/yyyy", { locale: ptBR })}
          </p>
          <p className="text-center text-gray-600">
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      
        {/* Barber info */}
        <div className="bg-white shadow rounded-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <User className="h-12 w-12 text-primary-600 mr-4" />
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{barber?.full_name || 'Barbeiro'}</h3>
              <p className="text-gray-500 mt-1">
                Comissão: {barber?.service_commission_rate || 50}% em serviços, {barber?.product_commission_rate || 10}% em produtos
              </p>
              <p className="text-gray-500">
                {format(parseISO(startDate), "dd/MM/yyyy", { locale: ptBR })} a {format(parseISO(endDate), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-primary-50 p-4 rounded-lg border border-primary-100">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-primary-600" />
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-primary-900">Total de Serviços</h4>
                  <p className="text-2xl font-bold text-primary-700">
                    R$ {serviceTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-primary-50 p-4 rounded-lg border border-primary-100">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-primary-600" />
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-primary-900">Total de Produtos</h4>
                  <p className="text-2xl font-bold text-primary-700">
                    R$ {productTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-green-900">Total de Vendas</h4>
                  <p className="text-2xl font-bold text-green-700">
                    R$ {total.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-green-900">Comissão Total</h4>
                  <p className="text-2xl font-bold text-green-700">
                    R$ {totalCommission.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Client breakdown */}
        <div className="bg-white shadow rounded-md overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Detalhamento por Cliente
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Vendas e comissões agrupadas por cliente
            </p>
          </div>
          
          {Object.values(clientTransactions).length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">Nenhuma transação encontrada no período selecionado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {Object.values(clientTransactions).map((client) => (
                <div key={client.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">{client.name}</h4>
                    <span className="text-lg font-semibold text-primary-600">
                      R$ {client.total.toFixed(2)}
                    </span>
                  </div>
                  
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qtd
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Preço Unit.
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Comissão
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {client.transactions.flatMap(transaction => 
                        (transaction.items || []).map((item, idx) => {
                          const isService = !!item.service_id;
                          const commissionRate = isService ? barber?.service_commission_rate : barber?.product_commission_rate;
                          const commission = (Number(item.total_price) * (commissionRate || 0)) / 100;
                          
                          return (
                            <tr key={`${transaction.id}-${idx}`}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm")}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {item.service?.name || item.product?.name || 'Item desconhecido'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {isService ? 'Serviço' : 'Produto'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                                R$ {Number(item.unit_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                R$ {Number(item.total_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-600 font-medium text-right">
                                R$ {commission.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}