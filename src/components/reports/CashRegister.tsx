import React, { useState } from 'react';
import { useCashRegister } from '../../lib/cashRegister';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, Clock } from 'lucide-react';

export function CashRegister() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { dailyTotal, pendingMonthlyTotal, isLoading, fetchDailyTotal, fetchPendingMonthlyTotal, closeCashRegister } = useCashRegister();

  React.useEffect(() => {
    fetchDailyTotal(selectedDate);
    fetchPendingMonthlyTotal();
  }, [selectedDate, fetchDailyTotal, fetchPendingMonthlyTotal]);

  const handleCloseCashRegister = async () => {
    if (window.confirm('Tem certeza que deseja fechar o caixa?')) {
      await closeCashRegister(selectedDate);
    }
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Fechamento de Caixa</h2>
        <div className="flex items-center space-x-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total do Dia
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    R$ {dailyTotal.toFixed(2)}
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
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Mensalidades Pendentes
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    R$ {pendingMonthlyTotal.toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCloseCashRegister}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          Fechar Caixa
        </button>
      </div>
    </div>
  );
}