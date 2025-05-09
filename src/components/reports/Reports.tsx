import React, { useState } from 'react';
import { BarChart, Calendar, DollarSign, TrendingUp, ChevronLeft, ChevronRight, FilterX, Filter, Search } from 'lucide-react';
import { useTransactions } from '../../lib/transactions';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CashRegisterReports } from './CashRegisterReports';

type ReportType = 'financial' | 'cash_register';

export function Reports() {
  // Track which report is currently active
  const [activeReport, setActiveReport] = useState<ReportType>('cash_register');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const { transactions, isLoading, error, fetchTransactionsByDateRange } = useTransactions();

  React.useEffect(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    fetchTransactionsByDateRange(start, end);
  }, [selectedMonth, fetchTransactionsByDateRange]);

  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.total_amount), 0);
  const totalCommissions = transactions.reduce((sum, t) => sum + Number(t.commission_amount || 0), 0);
  const completedTransactions = transactions.filter(t => t.payment_status === 'completed').length;
  const averageTicket = completedTransactions > 0 ? totalRevenue / completedTransactions : 0;

  const handlePreviousMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const handleNextMonth = () => setSelectedMonth(addMonths(selectedMonth, 1));

  if (activeReport === 'cash_register') {
    return <CashRegisterReports />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Report Type Selector */}
      <div className="flex space-x-4 bg-white p-2 rounded-lg shadow">
        <button
          onClick={() => setActiveReport('cash_register')}
          className={`px-4 py-2 rounded-md ${
            activeReport === 'cash_register'
              ? 'bg-primary-100 text-primary-800'
              : 'hover:bg-gray-100'
          }`}
        >
          <DollarSign className="h-5 w-5 inline-block mr-2" />
          Relatório de Caixa
        </button>
        <button
          onClick={() => setActiveReport('financial')}
          className={`px-4 py-2 rounded-md ${
            activeReport === 'financial'
              ? 'bg-primary-100 text-primary-800'
              : 'hover:bg-gray-100'
          }`}
        >
          <BarChart className="h-5 w-5 inline-block mr-2" />
          Relatório Financeiro
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePreviousMonth}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-lg font-medium text-gray-900">
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Receita Total
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      R$ {totalRevenue.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total de Vendas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {completedTransactions}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Ticket Médio
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      R$ {averageTicket.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Comissões
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      R$ {totalCommissions.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Histórico de Transações
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Detalhes de todas as transações no período selecionado
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar transação..."
                  className="h-10 pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <FilterX className="h-5 w-5 text-gray-400 cursor-pointer" />
                </div>
              </div>
              <div className="relative">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <li key={transaction.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.client?.full_name || "Cliente não encontrado"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(transaction.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                      {transaction.barber && (
                        <p className="text-sm text-gray-500">
                          Atendente: {transaction.barber.full_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.payment_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : transaction.payment_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {transaction.payment_status === 'completed'
                          ? 'Pago'
                          : transaction.payment_status === 'pending'
                          ? 'Pendente'
                          : 'Reembolsado'}
                      </span>
                      {transaction.is_monthly_billing && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Mensal
                        </span>
                      )}
                      <span className="ml-4 text-sm font-medium text-gray-900">
                        R$ {Number(transaction.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
              {transactions.length === 0 && (
                <li className="px-4 py-6 text-center text-gray-500">
                  Nenhuma transação encontrada
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}