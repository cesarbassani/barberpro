import React, { useState, useEffect } from 'react';
import { useBlockedTimes, type BusinessHours } from '../../lib/blockedTimes';
import { BusinessHoursForm } from './BusinessHoursForm';
import { Clock, AlertCircle, Calendar, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export function BusinessHoursSettings() {
  const { businessHours, isLoading, error, fetchBusinessHours, updateBusinessHours } = useBlockedTimes();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchBusinessHours();
  }, [fetchBusinessHours]);

  const handleSubmit = async (data: BusinessHours) => {
    try {
      await updateBusinessHours(data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating business hours:', error);
      toast.error('Erro ao atualizar horário de funcionamento');
    }
  };

  if (isLoading && !businessHours) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <BusinessHoursForm
        initialData={businessHours || undefined}
        onSubmit={handleSubmit}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  // Format weekdays for display
  const formatWeekdays = (weekdays: string[] = []) => {
    const weekdayMap: Record<string, string> = {
      'sunday': 'Domingo',
      'monday': 'Segunda-feira',
      'tuesday': 'Terça-feira',
      'wednesday': 'Quarta-feira',
      'thursday': 'Quinta-feira',
      'friday': 'Sexta-feira',
      'saturday': 'Sábado',
    };
    
    return weekdays.map(day => weekdayMap[day]).join(', ');
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div className="flex items-center">
          <Clock className="h-5 w-5 text-primary-600 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">Horário de Funcionamento</h3>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Settings className="h-4 w-4 mr-1" />
          Editar
        </button>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-gray-400" />
              Horário de Funcionamento
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {businessHours?.openingTime || '08:00'} - {businessHours?.closingTime || '20:00'}
            </dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-gray-400" />
              Duração dos Intervalos
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {businessHours?.slotDuration || 30} minutos
            </dd>
          </div>
          
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500 flex items-center">
              <Calendar className="h-4 w-4 mr-1 text-gray-400" />
              Dias de Funcionamento
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatWeekdays(businessHours?.weekdays)}
            </dd>
          </div>
          
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500 flex items-center">
              <Calendar className="h-4 w-4 mr-1 text-gray-400" />
              Feriados e Datas Especiais
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {businessHours?.holidays && businessHours.holidays.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {businessHours.holidays.map((holiday, index) => (
                    <li key={index}>
                      {new Date(holiday.date).toLocaleDateString()} - {holiday.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500 italic">Nenhum feriado configurado</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}