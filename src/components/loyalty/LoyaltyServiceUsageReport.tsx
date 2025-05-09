import React, { useState, useEffect } from 'react';
import { useLoyaltyServices } from '../../hooks/useLoyaltyServices';
import { useProfiles } from '../../lib/profiles';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, Download, User, CheckCircle, AlertCircle, Search, FileText } from 'lucide-react';

export function LoyaltyServiceUsageReport() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  
  const { usageReport, isLoading, error, generateUsageReport } = useLoyaltyServices();
  const { clients, searchClients } = useProfiles();
  const [filteredClients, setFilteredClients] = useState<any[]>([]);

  // Load clients when search changes
  useEffect(() => {
    const loadClients = async () => {
      if (searchQuery.length > 2) {
        const results = await searchClients(searchQuery);
        setFilteredClients(results);
      } else {
        setFilteredClients([]);
      }
    };
    
    loadClients();
  }, [searchQuery, searchClients]);

  // Generate report when client changes
  useEffect(() => {
    if (selectedClient) {
      generateUsageReport(selectedClient, startDate, endDate);
    }
  }, [selectedClient, startDate, endDate, generateUsageReport]);

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
    setSearchQuery('');
    setFilteredClients([]);
  };

  // Export report as CSV
  const exportToCsv = () => {
    if (!usageReport || usageReport.length === 0) return;
    
    // Find client name
    const client = clients.find(c => c.id === selectedClient);
    const clientName = client?.full_name || 'Cliente';
    
    // Create headers and rows
    const headers = [
      'Serviço',
      'Valor',
      'Usos Permitidos',
      'Usos Realizados',
      'Restantes',
      'Percentual Utilizado',
      'Último Uso'
    ];
    
    const rows = usageReport.map(item => [
      item.service_name,
      `R$ ${Number(item.service_price).toFixed(2)}`,
      item.allowed_uses,
      item.used,
      item.remaining,
      `${item.usage_percentage.toFixed(1)}%`,
      item.last_used ? format(new Date(item.last_used), 'dd/MM/yyyy HH:mm') : 'Nunca utilizado'
    ]);
    
    // Create CSV content
    const csvContent = [
      [`Relatório de Uso de Serviços - ${clientName}`],
      [`Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`],
      [],
      headers,
      ...rows
    ].map(row => row.join(',')).join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-uso-servicos-${clientName.replace(/\s+/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Relatório de Uso de Serviços</h2>
        {usageReport.length > 0 && (
          <button 
            onClick={exportToCsv}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client Search */}
        <div className="md:col-span-2">
          <label htmlFor="client-search" className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              id="client-search"
              placeholder="Buscar cliente por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {filteredClients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleClientSelect(client.id)}
                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <span className="font-normal block truncate">{client.full_name}</span>
                    </div>
                    {client.id === selectedClient && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <CheckCircle className="h-5 w-5 text-primary-600" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="h-10 pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Report Display */}
      <div className="mt-6">
        {!selectedClient ? (
          <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <User className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum cliente selecionado</h3>
            <p className="mt-1 text-sm text-gray-500">
              Para visualizar o relatório de uso de serviços, selecione um cliente com plano ativo.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        ) : usageReport.length === 0 ? (
          <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum plano ativo</h3>
            <p className="mt-1 text-sm text-gray-500">
              Este cliente não possui plano de fidelidade ativo ou não utilizou nenhum serviço no período.
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Serviços Utilizados
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serviço
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usos Permitidos
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilizados
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Restantes
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilização
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usageReport.map((item) => (
                    <tr key={item.service_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.service_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        R$ {Number(item.service_price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.allowed_uses}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.used}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.remaining}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                item.usage_percentage >= 85 ? 'bg-red-600' : 
                                item.usage_percentage >= 60 ? 'bg-yellow-600' : 'bg-green-600'
                              }`} 
                              style={{ width: `${Math.min(100, item.usage_percentage)}%` }}>
                            </div>
                          </div>
                          <span className="ml-2 text-xs font-medium text-gray-700">
                            {item.usage_percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}