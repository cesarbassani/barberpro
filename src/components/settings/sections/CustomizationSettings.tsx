import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { 
  Sliders, 
  Bell, 
  LockKeyhole, 
  SlidersHorizontal, 
  Plus,
  Trash2,
  Save,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// Schema for customization settings
const customizationSettingsSchema = z.object({
  customFields: z.array(
    z.object({
      entityType: z.enum(['client', 'appointment', 'transaction', 'product', 'service']),
      fieldName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      fieldType: z.enum(['text', 'number', 'date', 'boolean', 'select']),
      fieldLabel: z.string().min(2, 'Rótulo deve ter pelo menos 2 caracteres'),
      isRequired: z.boolean(),
      defaultValue: z.string().optional(),
      options: z.array(z.string()).optional(), // For select type
      displayInList: z.boolean()
    })
  ),
  
  reportTemplates: z.array(
    z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      description: z.string().optional(),
      type: z.enum(['sales', 'inventory', 'commissions', 'appointments', 'clients', 'custom']),
      isEnabled: z.boolean()
    })
  ),
  
  notifications: z.object({
    lowStockAlert: z.boolean(),
    birthdayReminders: z.boolean(),
    appointmentConfirmation: z.boolean(),
    salesReports: z.boolean(),
    dailyClosingSummary: z.boolean()
  }),
  
  permissions: z.object({
    barberCanManageProducts: z.boolean(),
    barberCanViewReports: z.boolean(),
    barberCanViewAllAppointments: z.boolean(),
    barberCanManageOwnBlockedTimes: z.boolean(),
    clientCanCancelAppointment: z.boolean(),
    clientCanRescheduleAppointment: z.boolean()
  }),
  
  displaySettings: z.object({
    showClientPhoneInAppointments: z.boolean(),
    showBarberCommissionInReports: z.boolean(),
    roundPricesToNearest: z.enum(['0.01', '0.05', '0.1', '0.5', '1']),
    dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
    timeFormat: z.enum(['24h', '12h'])
  })
});

type CustomizationSettingsData = z.infer<typeof customizationSettingsSchema>;

export function CustomizationSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    register, 
    handleSubmit,
    control,
    watch, 
    setValue,
    reset,
    formState: { errors } 
  } = useForm<CustomizationSettingsData>({
    resolver: zodResolver(customizationSettingsSchema),
    defaultValues: {
      customFields: [],
      reportTemplates: [
        {
          name: 'Relatório de Vendas Diário',
          description: 'Resumo de vendas do dia',
          type: 'sales',
          isEnabled: true
        },
        {
          name: 'Comissões dos Barbeiros',
          description: 'Relatório de comissões por barbeiro',
          type: 'commissions',
          isEnabled: true
        }
      ],
      notifications: {
        lowStockAlert: true,
        birthdayReminders: true,
        appointmentConfirmation: true,
        salesReports: true,
        dailyClosingSummary: true
      },
      permissions: {
        barberCanManageProducts: false,
        barberCanViewReports: false,
        barberCanViewAllAppointments: false,
        barberCanManageOwnBlockedTimes: true,
        clientCanCancelAppointment: true,
        clientCanRescheduleAppointment: true
      },
      displaySettings: {
        showClientPhoneInAppointments: true,
        showBarberCommissionInReports: true,
        roundPricesToNearest: '0.01',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h'
      }
    }
  });

  // Use field array for custom fields
  const { 
    fields: customFields, 
    append: appendCustomField, 
    remove: removeCustomField 
  } = useFieldArray({
    control,
    name: 'customFields'
  });

  // Use field array for report templates
  const { 
    fields: reportTemplates, 
    append: appendReportTemplate, 
    remove: removeReportTemplate 
  } = useFieldArray({
    control,
    name: 'reportTemplates'
  });

  // Load customization settings on component mount
  useEffect(() => {
    const loadCustomizationSettings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'customization_settings')
          .single();
        
        if (error) {
          if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            throw error;
          }
          // If no data, keep defaults
          return;
        }
        
        if (data?.value) {
          reset(data.value as CustomizationSettingsData);
        }
      } catch (error) {
        console.error('Error loading customization settings:', error);
        toast.error('Erro ao carregar configurações de personalização');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCustomizationSettings();
  }, [reset]);

  const onSubmit = async (data: CustomizationSettingsData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'customization_settings',
          value: data
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      toast.success('Configurações de personalização salvas com sucesso!');
    } catch (error) {
      console.error('Error saving customization settings:', error);
      toast.error('Erro ao salvar configurações de personalização');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCustomField = () => {
    appendCustomField({
      entityType: 'client',
      fieldName: '',
      fieldType: 'text',
      fieldLabel: '',
      isRequired: false,
      defaultValue: '',
      options: [],
      displayInList: false
    });
  };

  const addReportTemplate = () => {
    appendReportTemplate({
      name: '',
      description: '',
      type: 'custom',
      isEnabled: true
    });
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
            <Sliders className="h-6 w-6 text-primary-600 mr-2" />
            <h3 className="text-lg font-medium leading-6 text-gray-900">Personalizações do Sistema</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section: Campos Personalizados */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900 pb-2 flex items-center">
                <SlidersHorizontal className="h-4 w-4 mr-2 text-primary-600" />
                Campos Personalizados
              </h4>
              <button
                type="button"
                onClick={addCustomField}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Campo
              </button>
            </div>

            {customFields.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <SlidersHorizontal className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Adicione campos personalizados para coletar informações adicionais dos seus clientes, agendamentos, etc.
                </p>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Campo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {customFields.map((field, index) => (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="text-sm font-medium text-gray-700">Campo Personalizado #{index + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeCustomField(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label htmlFor={`field-entity-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                          Entidade
                        </label>
                        <select
                          id={`field-entity-${index}`}
                          {...register(`customFields.${index}.entityType` as const)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-xs"
                        >
                          <option value="client">Cliente</option>
                          <option value="appointment">Agendamento</option>
                          <option value="transaction">Transação</option>
                          <option value="product">Produto</option>
                          <option value="service">Serviço</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor={`field-type-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                          Tipo de Campo
                        </label>
                        <select
                          id={`field-type-${index}`}
                          {...register(`customFields.${index}.fieldType` as const)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-xs"
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="date">Data</option>
                          <option value="boolean">Sim/Não</option>
                          <option value="select">Lista</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label htmlFor={`field-name-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                          Nome do Campo (identificador)
                        </label>
                        <input
                          type="text"
                          id={`field-name-${index}`}
                          {...register(`customFields.${index}.fieldName` as const)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-xs"
                          placeholder="campo_personalizado"
                        />
                        {errors.customFields?.[index]?.fieldName && (
                          <p className="mt-1 text-xs text-red-600">{errors.customFields[index]?.fieldName?.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <label htmlFor={`field-label-${index}`} className="block text-xs font-medium text-gray-700 mb-1">
                          Rótulo (exibido)
                        </label>
                        <input
                          type="text"
                          id={`field-label-${index}`}
                          {...register(`customFields.${index}.fieldLabel` as const)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-xs"
                          placeholder="Meu Campo Personalizado"
                        />
                        {errors.customFields?.[index]?.fieldLabel && (
                          <p className="mt-1 text-xs text-red-600">{errors.customFields[index]?.fieldLabel?.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`field-required-${index}`}
                          {...register(`customFields.${index}.isRequired` as const)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`field-required-${index}`} className="ml-2 block text-xs text-gray-700">
                          Campo obrigatório
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`field-display-${index}`}
                          {...register(`customFields.${index}.displayInList` as const)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`field-display-${index}`} className="ml-2 block text-xs text-gray-700">
                          Exibir na listagem
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Modelos de Relatórios */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900 pb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-primary-600" />
                Modelos de Relatórios
              </h4>
              <button
                type="button"
                onClick={addReportTemplate}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Modelo
              </button>
            </div>

            <div className="space-y-4">
              {reportTemplates.map((template, index) => (
                <div key={template.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex-grow">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`template-enabled-${index}`}
                        {...register(`reportTemplates.${index}.isEnabled` as const)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`template-enabled-${index}`} className="ml-2 font-medium text-sm text-gray-900">
                        {watch(`reportTemplates.${index}.name`) || `Relatório #${index+1}`}
                      </label>
                    </div>
                    <p className="ml-6 text-xs text-gray-500">
                      {watch(`reportTemplates.${index}.description`) || 'Sem descrição'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <select
                      {...register(`reportTemplates.${index}.type` as const)}
                      className="text-xs border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="sales">Vendas</option>
                      <option value="inventory">Estoque</option>
                      <option value="commissions">Comissões</option>
                      <option value="appointments">Agendamentos</option>
                      <option value="clients">Clientes</option>
                      <option value="custom">Personalizado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeReportTemplate(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Notificações */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Bell className="h-4 w-4 mr-2 text-primary-600" />
              Notificações
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lowStockAlert"
                  {...register('notifications.lowStockAlert')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="lowStockAlert" className="ml-2 block text-sm text-gray-700">
                  Alertas de estoque baixo
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="birthdayReminders"
                  {...register('notifications.birthdayReminders')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="birthdayReminders" className="ml-2 block text-sm text-gray-700">
                  Lembretes de aniversário dos clientes
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="appointmentConfirmation"
                  {...register('notifications.appointmentConfirmation')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="appointmentConfirmation" className="ml-2 block text-sm text-gray-700">
                  Confirmações de agendamento
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="salesReports"
                  {...register('notifications.salesReports')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="salesReports" className="ml-2 block text-sm text-gray-700">
                  Relatórios de vendas (diário/semanal)
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="dailyClosingSummary"
                  {...register('notifications.dailyClosingSummary')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="dailyClosingSummary" className="ml-2 block text-sm text-gray-700">
                  Resumo do fechamento diário de caixa
                </label>
              </div>
            </div>
          </div>

          {/* Section: Permissões */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <LockKeyhole className="h-4 w-4 mr-2 text-primary-600" />
              Permissões
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
              <div className="col-span-1">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Permissões de Barbeiros</h5>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="barberCanManageProducts"
                      {...register('permissions.barberCanManageProducts')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="barberCanManageProducts" className="ml-2 block text-sm text-gray-700">
                      Gerenciar produtos
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="barberCanViewReports"
                      {...register('permissions.barberCanViewReports')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="barberCanViewReports" className="ml-2 block text-sm text-gray-700">
                      Visualizar relatórios
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="barberCanViewAllAppointments"
                      {...register('permissions.barberCanViewAllAppointments')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="barberCanViewAllAppointments" className="ml-2 block text-sm text-gray-700">
                      Ver agendamentos de outros barbeiros
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="barberCanManageOwnBlockedTimes"
                      {...register('permissions.barberCanManageOwnBlockedTimes')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="barberCanManageOwnBlockedTimes" className="ml-2 block text-sm text-gray-700">
                      Gerenciar próprios horários bloqueados
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="col-span-1">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Permissões de Clientes</h5>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="clientCanCancelAppointment"
                      {...register('permissions.clientCanCancelAppointment')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="clientCanCancelAppointment" className="ml-2 block text-sm text-gray-700">
                      Cancelar próprios agendamentos
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="clientCanRescheduleAppointment"
                      {...register('permissions.clientCanRescheduleAppointment')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="clientCanRescheduleAppointment" className="ml-2 block text-sm text-gray-700">
                      Remarcar próprios agendamentos
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Configurações de Exibição */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Sliders className="h-4 w-4 mr-2 text-primary-600" />
              Configurações de Exibição
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showClientPhoneInAppointments"
                    {...register('displaySettings.showClientPhoneInAppointments')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showClientPhoneInAppointments" className="ml-2 block text-sm text-gray-700">
                    Mostrar telefone do cliente nos agendamentos
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showBarberCommissionInReports"
                    {...register('displaySettings.showBarberCommissionInReports')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showBarberCommissionInReports" className="ml-2 block text-sm text-gray-700">
                    Mostrar comissões dos barbeiros em relatórios
                  </label>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="roundPricesToNearest" className="block text-sm font-medium text-gray-700 mb-1">
                    Arredondar Preços Para
                  </label>
                  <select
                    id="roundPricesToNearest"
                    {...register('displaySettings.roundPricesToNearest')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="0.01">Centavo (0.01)</option>
                    <option value="0.05">5 Centavos (0.05)</option>
                    <option value="0.1">10 Centavos (0.10)</option>
                    <option value="0.5">50 Centavos (0.50)</option>
                    <option value="1">1 Real (1.00)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 mb-1">
                    Formato de Data
                  </label>
                  <select
                    id="dateFormat"
                    {...register('displaySettings.dateFormat')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="DD/MM/YYYY">DD/MM/AAAA (31/12/2025)</option>
                    <option value="MM/DD/YYYY">MM/DD/AAAA (12/31/2025)</option>
                    <option value="YYYY-MM-DD">AAAA-MM-DD (2025-12-31)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="timeFormat" className="block text-sm font-medium text-gray-700 mb-1">
                    Formato de Hora
                  </label>
                  <select
                    id="timeFormat"
                    {...register('displaySettings.timeFormat')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="24h">24 horas (14:30)</option>
                    <option value="12h">12 horas (2:30 PM)</option>
                  </select>
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