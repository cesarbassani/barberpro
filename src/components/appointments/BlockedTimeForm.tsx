import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProfiles } from '../../lib/profiles';
import { useAuth } from '../../lib/auth';
import { Calendar, Clock, User, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';

// Zod schema for form validation
const blockedTimeSchema = z.object({
  barber_id: z.string().uuid('Barbeiro é obrigatório'),
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  is_all_day: z.boolean().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início é obrigatória'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término é obrigatória'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de início é obrigatória').optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de término é obrigatória').optional(),
}).refine(
  (data) => {
    // If it's an all day event, we don't need times
    if (data.is_all_day) return true;
    // Otherwise both times are required
    return !!data.start_time && !!data.end_time;
  },
  {
    message: "Hora de início e término são obrigatórias para bloqueios parciais",
    path: ['start_time'],
  }
).refine(
  (data) => {
    // Check that the end date is not before the start date
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    return startDate <= endDate;
  },
  {
    message: "A data de término deve ser igual ou posterior à data de início",
    path: ['end_date'],
  }
).refine(
  (data) => {
    // If it's all day or the dates are different, we're good
    if (data.is_all_day || data.start_date !== data.end_date) return true;
    
    // Check that the end time is after the start time on same day
    if (!data.start_time || !data.end_time) return true; // Already checked by previous refine
    
    const [startHour, startMinute] = data.start_time.split(':').map(Number);
    const [endHour, endMinute] = data.end_time.split(':').map(Number);
    
    return (endHour > startHour) || (endHour === startHour && endMinute > startMinute);
  },
  {
    message: "A hora de término deve ser posterior à hora de início",
    path: ['end_time'],
  }
);

type BlockedTimeFormData = z.infer<typeof blockedTimeSchema>;

interface BlockedTimeFormProps {
  initialData?: {
    id: string;
    barber_id: string;
    title: string;
    description?: string;
    is_all_day: boolean;
    start_time: string;
    end_time: string;
  };
  onSubmit: (data: {
    barber_id: string;
    title: string;
    description?: string;
    is_all_day: boolean;
    start_time: string;
    end_time: string;
  }) => Promise<void>;
  onCancel: () => void;
  selectedDate?: Date;
}

export function BlockedTimeForm({ initialData, onSubmit, onCancel, selectedDate }: BlockedTimeFormProps) {
  const { barbers, fetchBarbers } = useProfiles();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup with default values
  const defaultValues = React.useMemo(() => {
    if (initialData) {
      const startDate = new Date(initialData.start_time);
      const endDate = new Date(initialData.end_time);
      
      return {
        barber_id: initialData.barber_id,
        title: initialData.title,
        description: initialData.description || '',
        is_all_day: initialData.is_all_day,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        start_time: initialData.is_all_day ? undefined : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
        end_time: initialData.is_all_day ? undefined : `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
      };
    }
    
    // Set defaults based on user role and selected date
    const defaults: Partial<BlockedTimeFormData> = {};
    
    if (profile) {
      if (profile.role === 'barber') {
        defaults.barber_id = profile.id;
      }
    }
    
    if (selectedDate) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
      
      defaults.start_date = selectedDate.toISOString().split('T')[0];
      defaults.end_date = selectedDate.toISOString().split('T')[0];
      defaults.start_time = `${hours}:${minutes}`;
      defaults.end_time = `${String(Math.min(now.getHours() + 1, 23)).padStart(2, '0')}:${minutes}`;
      defaults.title = "Horário Bloqueado";
      defaults.is_all_day = false;
    }
    
    return defaults;
  }, [initialData, profile, selectedDate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BlockedTimeFormData>({
    resolver: zodResolver(blockedTimeSchema),
    defaultValues,
  });

  const isAllDay = watch('is_all_day');

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  const handleFormSubmit = async (data: BlockedTimeFormData) => {
    try {
      setIsSubmitting(true);
      
      // Construct datetime strings
      let startTime: string;
      let endTime: string;
      
      if (data.is_all_day) {
        // For all-day events, set time to start/end of day
        startTime = `${data.start_date}T00:00:00`;
        endTime = `${data.end_date}T23:59:59`;
      } else {
        startTime = `${data.start_date}T${data.start_time}:00`;
        endTime = `${data.end_date}T${data.end_time}:00`;
      }
      
      await onSubmit({
        barber_id: data.barber_id,
        title: data.title,
        description: data.description,
        is_all_day: !!data.is_all_day,
        start_time: startTime,
        end_time: endTime,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Barber selection - Only shown to admins */}
      {profile?.role === 'admin' && (
        <div>
          <label htmlFor="blocked-barber" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <User className="h-4 w-4 mr-1 text-primary-600" />
            Barbeiro
          </label>
          <select
            id="blocked-barber"
            {...register('barber_id')}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            disabled={profile?.role === 'barber'}
          >
            <option value="">Selecione um barbeiro</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.full_name}
              </option>
            ))}
          </select>
          {errors.barber_id && (
            <p className="mt-1 text-sm text-red-600">{errors.barber_id.message}</p>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="blocked-title" className="block text-sm font-medium text-gray-700 mb-1">
          Título
        </label>
        <input
          type="text"
          id="blocked-title"
          {...register('title')}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          placeholder="Ex: Folga, Compromisso externo, etc."
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="blocked-description" className="block text-sm font-medium text-gray-700 mb-1">
          Descrição (opcional)
        </label>
        <textarea
          id="blocked-description"
          {...register('description')}
          rows={2}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          placeholder="Detalhes adicionais sobre o bloqueio..."
        />
      </div>

      {/* All-day checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="blocked-is-all-day"
          {...register('is_all_day')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="blocked-is-all-day" className="ml-2 block text-sm text-gray-700">
          Bloquear o dia inteiro
        </label>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="blocked-start-date" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-primary-600" />
            Data Inicial
          </label>
          <input
            type="date"
            id="blocked-start-date"
            {...register('start_date')}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="blocked-end-date" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-primary-600" />
            Data Final
          </label>
          <input
            type="date"
            id="blocked-end-date"
            {...register('end_date')}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          {errors.end_date && (
            <p className="mt-1 text-sm text-red-600">{errors.end_date.message}</p>
          )}
        </div>
      </div>

      {/* Times - Only shown if not all day */}
      {!isAllDay && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="blocked-start-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-primary-600" />
              Hora Inicial
            </label>
            <input
              type="time"
              id="blocked-start-time"
              {...register('start_time')}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {errors.start_time && (
              <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="blocked-end-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-primary-600" />
              Hora Final
            </label>
            <input
              type="time"
              id="blocked-end-time"
              {...register('end_time')}
              className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            {errors.end_time && (
              <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Warning about existing appointments */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              O bloqueio de horários não cancelará agendamentos existentes automaticamente. Você precisará verificar e ajustar manualmente quaisquer conflitos.
            </p>
          </div>
        </div>
      </div>

      {/* Form actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Bloquear Horário'}
        </button>
      </div>
    </form>
  );
}