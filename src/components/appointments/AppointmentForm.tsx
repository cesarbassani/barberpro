import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parse, addDays } from 'date-fns';
import { useProfiles } from '../../lib/profiles';
import { useServices } from '../../lib/services';
import { useAuth } from '../../lib/auth';
import type { Appointment } from '../../types/database';
import { ClientSearchField } from '../common/ClientSearchField';
import { ClientForm } from '../clients/ClientForm';
import { Calendar, Clock, Scissors, User, Check } from 'lucide-react';

const appointmentSchema = z.object({
  client_id: z.string().uuid('Cliente é obrigatório'),
  barber_id: z.string().uuid('Barbeiro é obrigatório'),
  service_id: z.string().uuid('Serviço é obrigatório'),
  start_time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Data e hora são obrigatórios'),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  initialData?: Partial<Appointment>;
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  onCancel: () => void;
  selectedDate?: Date;
}

export function AppointmentForm({ initialData, onSubmit, onCancel, selectedDate }: AppointmentFormProps) {
  const { barbers, clients, fetchBarbers, fetchClients } = useProfiles();
  const { services, fetchServices } = useServices();
  const { profile } = useAuth();
  const [isClientFormOpen, setIsClientFormOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<string | null>(null);

  useEffect(() => {
    fetchBarbers();
    fetchClients();
    fetchServices();
  }, [fetchBarbers, fetchClients, fetchServices]);

  const defaultValues = React.useMemo(() => {
    if (initialData) {
      return {
        ...initialData,
        start_time: initialData.start_time 
          ? format(new Date(initialData.start_time), "yyyy-MM-dd'T'HH:mm") 
          : undefined,
      };
    }

    // Set defaults based on user role
    const defaults: Partial<AppointmentFormData> = {};
    
    if (profile) {
      if (profile.role === 'client') {
        defaults.client_id = profile.id;
      } else if (profile.role === 'barber') {
        defaults.barber_id = profile.id;
      }
    }

    if (selectedDate) {
      defaults.start_time = format(selectedDate, "yyyy-MM-dd'T'HH:mm");
    }

    return defaults;
  }, [initialData, profile, selectedDate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues,
  });

  const clientId = watch('client_id');
  const barberId = watch('barber_id');
  const serviceId = watch('service_id');

  useEffect(() => {
    // Reset form with defaultValues when they change
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (serviceId) {
      setSelectedService(serviceId);
    }
  }, [serviceId]);

  const handleClientChange = (clientId: string) => {
    setValue('client_id', clientId, { shouldValidate: true });
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setValue('service_id', e.target.value, { shouldValidate: true });
    setSelectedService(e.target.value);
  };

  const handleCreateClient = () => {
    setIsClientFormOpen(true);
  };

  const handleClientCreated = () => {
    setIsClientFormOpen(false);
    fetchClients(); // Refresh client list
  };

  const handleFormSubmit = async (data: AppointmentFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error('Error in appointment form submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get service duration for display
  const serviceDetails = services.find(s => s.id === selectedService);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Client selection - Only shown to barbers and admins */}
      {profile?.role !== 'client' && (
        <div>
          <label htmlFor="appointment-client" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <User className="h-4 w-4 mr-1 text-primary-600" />
            Cliente
          </label>
          <ClientSearchField
            value={clientId || ''}
            onChange={handleClientChange}
            onClientCreate={handleCreateClient}
            error={errors.client_id?.message}
            required={true}
          />
        </div>
      )}

      {/* New client form modal */}
      {isClientFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Novo Cliente
            </h3>
            <ClientForm
              onCancel={() => setIsClientFormOpen(false)}
              onSuccess={handleClientCreated}
            />
          </div>
        </div>
      )}

      {/* Barber selection - Only shown to clients and admins */}
      {profile?.role !== 'barber' && (
        <div>
          <label htmlFor="appointment-barber" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Scissors className="h-4 w-4 mr-1 text-primary-600" />
            Barbeiro
          </label>
          <select
            id="appointment-barber"
            {...register('barber_id')}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
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

      <div>
        <label htmlFor="appointment-service" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          <Check className="h-4 w-4 mr-1 text-primary-600" />
          Serviço
        </label>
        <select
          id="appointment-service"
          {...register('service_id')}
          onChange={handleServiceChange}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="">Selecione um serviço</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - {service.duration.split(':')[0]}h{service.duration.split(':')[1]}min - R$ {service.price.toFixed(2)}
            </option>
          ))}
        </select>
        {errors.service_id && (
          <p className="mt-1 text-sm text-red-600">{errors.service_id.message}</p>
        )}
        
        {serviceDetails && (
          <p className="mt-1 text-xs text-gray-500">
            Duração: {serviceDetails.duration.split(':')[0]}h{serviceDetails.duration.split(':')[1]}min
          </p>
        )}
      </div>

      <div>
        <label htmlFor="appointment-time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          <Clock className="h-4 w-4 mr-1 text-primary-600" />
          Data e Hora
        </label>
        <input
          type="datetime-local"
          id="appointment-time"
          {...register('start_time')}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.start_time && (
          <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="appointment-notes" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          <svg className="h-4 w-4 mr-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Observações
        </label>
        <textarea
          id="appointment-notes"
          {...register('notes')}
          rows={3}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          placeholder="Informações adicionais sobre o agendamento..."
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
        )}
      </div>

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
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Agendar'}
        </button>
      </div>
    </form>
  );
}