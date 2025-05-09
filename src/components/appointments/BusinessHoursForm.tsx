import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Check, 
  X,
  Info
} from 'lucide-react';
import type { BusinessHours } from '../../lib/blockedTimes';
import { format, parse } from 'date-fns';

// Zod schema for form validation
const businessHoursSchema = z.object({
  openingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
  slotDuration: z.number().int().positive('Duração deve ser positiva'),
  weekdays: z.array(z.string()).min(1, 'Selecione pelo menos um dia'),
  holidays: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres')
  }))
}).refine(
  (data) => {
    // Check that closing time is after opening time
    const [openingHour, openingMinute] = data.openingTime.split(':').map(Number);
    const [closingHour, closingMinute] = data.closingTime.split(':').map(Number);
    
    const openingMinutes = openingHour * 60 + openingMinute;
    const closingMinutes = closingHour * 60 + closingMinute;
    
    return closingMinutes > openingMinutes;
  },
  {
    message: "O horário de fechamento deve ser posterior ao horário de abertura",
    path: ['closingTime'],
  }
);

type BusinessHoursFormData = z.infer<typeof businessHoursSchema>;

const WEEKDAYS = [
  { value: 'sunday', label: 'Domingo' },
  { value: 'monday', label: 'Segunda-feira' },
  { value: 'tuesday', label: 'Terça-feira' },
  { value: 'wednesday', label: 'Quarta-feira' },
  { value: 'thursday', label: 'Quinta-feira' },
  { value: 'friday', label: 'Sexta-feira' },
  { value: 'saturday', label: 'Sábado' },
];

interface BusinessHoursFormProps {
  initialData?: BusinessHours;
  onSubmit: (data: BusinessHours) => Promise<void>;
  onCancel: () => void;
}

export function BusinessHoursForm({ initialData, onSubmit, onCancel }: BusinessHoursFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup with default values
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors }
  } = useForm<BusinessHoursFormData>({
    resolver: zodResolver(businessHoursSchema),
    defaultValues: initialData || {
      weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      openingTime: '08:00',
      closingTime: '20:00',
      slotDuration: 30,
      holidays: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'holidays'
  });

  // Current weekdays value
  const weekdays = watch('weekdays');

  // Toggle weekday selection
  const toggleWeekday = (day: string) => {
    const currentWeekdays = weekdays || [];
    
    if (currentWeekdays.includes(day)) {
      setValue('weekdays', currentWeekdays.filter(d => d !== day));
    } else {
      setValue('weekdays', [...currentWeekdays, day]);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (data: BusinessHoursFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add new holiday
  const addHoliday = () => {
    append({ 
      date: format(new Date(), 'yyyy-MM-dd'),
      name: 'Feriado'
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Business Hours */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Horário de Funcionamento</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="opening-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-primary-600" />
              Horário de Abertura
            </label>
            <input
              type="time"
              id="opening-time"
              {...register('openingTime')}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {errors.openingTime && (
              <p className="mt-1 text-sm text-red-600">{errors.openingTime.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="closing-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-primary-600" />
              Horário de Fechamento
            </label>
            <input
              type="time"
              id="closing-time"
              {...register('closingTime')}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {errors.closingTime && (
              <p className="mt-1 text-sm text-red-600">{errors.closingTime.message}</p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="slot-duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duração dos Intervalos (minutos)
          </label>
          <select
            id="slot-duration"
            {...register('slotDuration', { valueAsNumber: true })}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="60">60 minutos</option>
          </select>
          {errors.slotDuration && (
            <p className="mt-1 text-sm text-red-600">{errors.slotDuration.message}</p>
          )}
        </div>
      </div>

      {/* Days of Week */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Dias de Funcionamento</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
          {WEEKDAYS.map((day) => {
            const isSelected = weekdays?.includes(day.value);
            
            return (
              <div key={day.value} 
                className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-primary-100 border border-primary-300 text-primary-800' 
                    : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => toggleWeekday(day.value)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{day.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary-600" />}
                </div>
              </div>
            );
          })}
        </div>
        
        {errors.weekdays && (
          <p className="mt-1 text-sm text-red-600">{errors.weekdays.message}</p>
        )}
        
        <input
          type="hidden"
          {...register('weekdays')}
        />
      </div>

      {/* Holidays */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-900">Feriados e Datas Especiais</h3>
          <button
            type="button"
            onClick={addHoliday}
            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Feriado
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <Info className="mx-auto h-6 w-6 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Adicione feriados e datas especiais em que a barbearia não funcionará.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex-grow grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor={`holiday-date-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      id={`holiday-date-${index}`}
                      {...register(`holidays.${index}.date`)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  
                  <div className="md:col-span-3">
                    <label htmlFor={`holiday-name-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      id={`holiday-name-${index}`}
                      {...register(`holidays.${index}.name`)}
                      placeholder="Ex: Natal, Carnaval"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 text-red-500"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {errors.holidays && (
          <p className="mt-1 text-sm text-red-600">{errors.holidays.message}</p>
        )}
      </div>

      {/* Form actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </form>
  );
}