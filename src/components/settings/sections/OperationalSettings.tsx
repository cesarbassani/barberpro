import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { 
  Clock, 
  Users, 
  AlertCircle, 
  Settings,
  Save,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// Schema for operational settings
const operationalSettingsSchema = z.object({
  scheduling: z.object({
    defaultAppointmentDuration: z.number().int().min(5, 'Duração mínima é de 5 minutos'),
    minAdvanceTimeMinutes: z.number().int().min(0, 'Não pode ser negativo'),
    maxAdvanceDays: z.number().int().min(1, 'Mínimo de 1 dia'),
    allowReschedule: z.boolean(),
    rescheduleMinTimeHours: z.number().int().min(0, 'Não pode ser negativo'),
    allowCancellation: z.boolean(),
    cancellationMinTimeHours: z.number().int().min(0, 'Não pode ser negativo'),
    bufferBetweenAppointmentsMinutes: z.number().int().min(0, 'Não pode ser negativo')
  }),
  
  capacity: z.object({
    maxConcurrentClients: z.number().int().min(1, 'Mínimo de 1 cliente'),
    maxConcurrentAppointmentsPerBarber: z.number().int().min(1, 'Mínimo de 1 agendamento'),
    maxDailyAppointmentsPerBarber: z.number().int().min(1, 'Mínimo de 1 agendamento').optional(),
    enableWaitlist: z.boolean(),
    overbookingAllowed: z.boolean(),
    overbookingLimit: z.number().int().min(0, 'Não pode ser negativo')
  }),
  
  notifications: z.object({
    appointmentReminders: z.boolean(),
    reminderTimeHours: z.number().int().min(1, 'Mínimo de 1 hora'),
    sendConfirmationEmails: z.boolean(),
    sendCancellationNotices: z.boolean(),
    notifyBarberOnNewAppointment: z.boolean()
  })
});

type OperationalSettingsData = z.infer<typeof operationalSettingsSchema>;

export function OperationalSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue,
    reset,
    formState: { errors } 
  } = useForm<OperationalSettingsData>({
    resolver: zodResolver(operationalSettingsSchema),
    defaultValues: {
      scheduling: {
        defaultAppointmentDuration: 30,
        minAdvanceTimeMinutes: 30,
        maxAdvanceDays: 30,
        allowReschedule: true,
        rescheduleMinTimeHours: 24,
        allowCancellation: true,
        cancellationMinTimeHours: 24,
        bufferBetweenAppointmentsMinutes: 5
      },
      capacity: {
        maxConcurrentClients: 5,
        maxConcurrentAppointmentsPerBarber: 1,
        maxDailyAppointmentsPerBarber: 10,
        enableWaitlist: false,
        overbookingAllowed: false,
        overbookingLimit: 0
      },
      notifications: {
        appointmentReminders: true,
        reminderTimeHours: 24,
        sendConfirmationEmails: true,
        sendCancellationNotices: true,
        notifyBarberOnNewAppointment: true
      }
    }
  });

  // Load operational settings on component mount
  useEffect(() => {
    const loadOperationalSettings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'operational_settings')
          .single();
        
        if (error) {
          if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            throw error;
          }
          // If no data, keep defaults
          return;
        }
        
        if (data?.value) {
          reset(data.value as OperationalSettingsData);
        }
      } catch (error) {
        console.error('Error loading operational settings:', error);
        toast.error('Erro ao carregar configurações operacionais');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOperationalSettings();
  }, [reset]);

  const onSubmit = async (data: OperationalSettingsData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'operational_settings',
          value: data
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      toast.success('Configurações operacionais salvas com sucesso!');
    } catch (error) {
      console.error('Error saving operational settings:', error);
      toast.error('Erro ao salvar configurações operacionais');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Settings className="h-6 w-6 text-primary-600 mr-2" />
            <h3 className="text-lg font-medium leading-6 text-gray-900">Configurações Operacionais</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section: Agendamentos */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Clock className="h-4 w-4 mr-2 text-primary-600" />
              Configurações de Agendamento
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="tooltip">
                <label htmlFor="defaultAppointmentDuration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duração Padrão (minutos)
                </label>
                <span className="tooltiptext">Duração padrão para novos agendamentos</span>
                <input
                  type="number"
                  id="defaultAppointmentDuration"
                  {...register('scheduling.defaultAppointmentDuration', { valueAsNumber: true })}
                  min="5"
                  step="5"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.scheduling?.defaultAppointmentDuration && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduling.defaultAppointmentDuration.message}</p>
                )}
              </div>
              
              <div className="tooltip">
                <label htmlFor="bufferTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Intervalo Entre Agendamentos (minutos)
                </label>
                <span className="tooltiptext">Tempo de intervalo entre um atendimento e outro</span>
                <input
                  type="number"
                  id="bufferTime"
                  {...register('scheduling.bufferBetweenAppointmentsMinutes', { valueAsNumber: true })}
                  min="0"
                  step="1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.scheduling?.bufferBetweenAppointmentsMinutes && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduling.bufferBetweenAppointmentsMinutes.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="tooltip">
                <label htmlFor="minAdvanceTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Antecedência Mínima (minutos)
                </label>
                <span className="tooltiptext">Tempo mínimo necessário para fazer um agendamento</span>
                <input
                  type="number"
                  id="minAdvanceTime"
                  {...register('scheduling.minAdvanceTimeMinutes', { valueAsNumber: true })}
                  min="0"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.scheduling?.minAdvanceTimeMinutes && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduling.minAdvanceTimeMinutes.message}</p>
                )}
              </div>
              
              <div className="tooltip">
                <label htmlFor="maxAdvanceDays" className="block text-sm font-medium text-gray-700 mb-1">
                  Janela de Agendamento (dias)
                </label>
                <span className="tooltiptext">Quantos dias no futuro os clientes podem agendar</span>
                <input
                  type="number"
                  id="maxAdvanceDays"
                  {...register('scheduling.maxAdvanceDays', { valueAsNumber: true })}
                  min="1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.scheduling?.maxAdvanceDays && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduling.maxAdvanceDays.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="allowReschedule" className="text-sm font-medium text-gray-700 flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1 text-gray-400" />
                    Permitir Remarcação
                  </label>
                  <div className="tooltip">
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input
                        type="checkbox"
                        id="allowReschedule"
                        {...register('scheduling.allowReschedule')}
                        className="sr-only"
                      />
                      <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                      <div 
                        className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                          watch('scheduling.allowReschedule') ? 'transform translate-x-6 bg-primary-600' : ''
                        }`}
                      ></div>
                    </div>
                    <span className="tooltiptext">Permite que clientes remarquem seus agendamentos</span>
                  </div>
                </div>

                <div className={`ml-6 mt-2 ${!watch('scheduling.allowReschedule') ? 'opacity-50' : ''}`}>
                  <label htmlFor="rescheduleMinTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo Mínimo para Remarcação (horas)
                  </label>
                  <input
                    type="number"
                    id="rescheduleMinTime"
                    {...register('scheduling.rescheduleMinTimeHours', { valueAsNumber: true })}
                    min="0"
                    disabled={!watch('scheduling.allowReschedule')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  {errors.scheduling?.rescheduleMinTimeHours && (
                    <p className="mt-1 text-sm text-red-600">{errors.scheduling.rescheduleMinTimeHours.message}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="allowCancellation" className="text-sm font-medium text-gray-700 flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1 text-gray-400" />
                    Permitir Cancelamento
                  </label>
                  <div className="tooltip">
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input
                        type="checkbox"
                        id="allowCancellation"
                        {...register('scheduling.allowCancellation')}
                        className="sr-only"
                      />
                      <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                      <div 
                        className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                          watch('scheduling.allowCancellation') ? 'transform translate-x-6 bg-primary-600' : ''
                        }`}
                      ></div>
                    </div>
                    <span className="tooltiptext">Permite que clientes cancelem seus agendamentos</span>
                  </div>
                </div>

                <div className={`ml-6 mt-2 ${!watch('scheduling.allowCancellation') ? 'opacity-50' : ''}`}>
                  <label htmlFor="cancellationMinTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo Mínimo para Cancelamento (horas)
                  </label>
                  <input
                    type="number"
                    id="cancellationMinTime"
                    {...register('scheduling.cancellationMinTimeHours', { valueAsNumber: true })}
                    min="0"
                    disabled={!watch('scheduling.allowCancellation')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  {errors.scheduling?.cancellationMinTimeHours && (
                    <p className="mt-1 text-sm text-red-600">{errors.scheduling.cancellationMinTimeHours.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Capacidade */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Users className="h-4 w-4 mr-2 text-primary-600" />
              Capacidade e Limites
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="tooltip">
                <label htmlFor="maxConcurrentClients" className="block text-sm font-medium text-gray-700 mb-1">
                  Clientes Simultâneos (total)
                </label>
                <span className="tooltiptext">Número total de clientes que podem ser atendidos ao mesmo tempo</span>
                <input
                  type="number"
                  id="maxConcurrentClients"
                  {...register('capacity.maxConcurrentClients', { valueAsNumber: true })}
                  min="1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.capacity?.maxConcurrentClients && (
                  <p className="mt-1 text-sm text-red-600">{errors.capacity.maxConcurrentClients.message}</p>
                )}
              </div>
              
              <div className="tooltip">
                <label htmlFor="maxConcurrentPerBarber" className="block text-sm font-medium text-gray-700 mb-1">
                  Agendamentos Simultâneos por Barbeiro
                </label>
                <span className="tooltiptext">Quantos clientes um barbeiro pode atender ao mesmo tempo</span>
                <input
                  type="number"
                  id="maxConcurrentPerBarber"
                  {...register('capacity.maxConcurrentAppointmentsPerBarber', { valueAsNumber: true })}
                  min="1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.capacity?.maxConcurrentAppointmentsPerBarber && (
                  <p className="mt-1 text-sm text-red-600">{errors.capacity.maxConcurrentAppointmentsPerBarber.message}</p>
                )}
              </div>
              
              <div className="tooltip">
                <label htmlFor="maxDailyPerBarber" className="block text-sm font-medium text-gray-700 mb-1">
                  Agendamentos Diários por Barbeiro
                </label>
                <span className="tooltiptext">Limite de atendimentos que um barbeiro pode fazer por dia</span>
                <input
                  type="number"
                  id="maxDailyPerBarber"
                  {...register('capacity.maxDailyAppointmentsPerBarber', { valueAsNumber: true })}
                  min="1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.capacity?.maxDailyAppointmentsPerBarber && (
                  <p className="mt-1 text-sm text-red-600">{errors.capacity.maxDailyAppointmentsPerBarber.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="enableWaitlist" className="text-sm font-medium text-gray-700 flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1 text-gray-400" />
                    Ativar Lista de Espera
                  </label>
                  <div className="tooltip">
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input
                        type="checkbox"
                        id="enableWaitlist"
                        {...register('capacity.enableWaitlist')}
                        className="sr-only"
                      />
                      <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                      <div 
                        className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                          watch('capacity.enableWaitlist') ? 'transform translate-x-6 bg-primary-600' : ''
                        }`}
                      ></div>
                    </div>
                    <span className="tooltiptext">Permite que clientes entrem em lista de espera quando não houver horários disponíveis</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="overbookingAllowed" className="text-sm font-medium text-gray-700 flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1 text-gray-400" />
                    Permitir Sobrecarga de Agenda
                  </label>
                  <div className="tooltip">
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input
                        type="checkbox"
                        id="overbookingAllowed"
                        {...register('capacity.overbookingAllowed')}
                        className="sr-only"
                      />
                      <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                      <div 
                        className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                          watch('capacity.overbookingAllowed') ? 'transform translate-x-6 bg-primary-600' : ''
                        }`}
                      ></div>
                    </div>
                    <span className="tooltiptext">Permite exceder os limites de agendamento em situações especiais</span>
                  </div>
                </div>

                <div className={`ml-6 mt-2 ${!watch('capacity.overbookingAllowed') ? 'opacity-50' : ''}`}>
                  <label htmlFor="overbookingLimit" className="block text-sm font-medium text-gray-700 mb-1">
                    Limite de Sobrecarga (%)
                  </label>
                  <input
                    type="number"
                    id="overbookingLimit"
                    {...register('capacity.overbookingLimit', { valueAsNumber: true })}
                    min="0"
                    max="100"
                    disabled={!watch('capacity.overbookingAllowed')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  {errors.capacity?.overbookingLimit && (
                    <p className="mt-1 text-sm text-red-600">{errors.capacity.overbookingLimit.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Notificações */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-primary-600" />
              Notificações e Lembretes
            </h4>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="appointmentReminders"
                    {...register('notifications.appointmentReminders')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="appointmentReminders" className="ml-2 block text-sm text-gray-700">
                    Enviar lembretes de agendamento
                  </label>
                </div>
                
                <div className={`${!watch('notifications.appointmentReminders') ? 'opacity-50' : ''}`}>
                  <input
                    type="number"
                    id="reminderTimeHours"
                    {...register('notifications.reminderTimeHours', { valueAsNumber: true })}
                    min="1"
                    disabled={!watch('notifications.appointmentReminders')}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />{' '}
                  <span className="text-sm text-gray-500">horas antes</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sendConfirmationEmails"
                    {...register('notifications.sendConfirmationEmails')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="sendConfirmationEmails" className="ml-2 block text-sm text-gray-700">
                    Enviar emails de confirmação para novos agendamentos
                  </label>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sendCancellationNotices"
                    {...register('notifications.sendCancellationNotices')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="sendCancellationNotices" className="ml-2 block text-sm text-gray-700">
                    Enviar notificações de cancelamento
                  </label>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="notifyBarberOnNewAppointment"
                    {...register('notifications.notifyBarberOnNewAppointment')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="notifyBarberOnNewAppointment" className="ml-2 block text-sm text-gray-700">
                    Notificar barbeiro sobre novos agendamentos
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Submit buttons */}
          <div className="pt-5 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Restaurar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="ml-3 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar configurações
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}