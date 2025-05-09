import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLoyalty } from '../../lib/loyalty';
import { createCustomer, createSubscription, testApiKey, getSettings } from '../../lib/asaas';
import { useProfiles } from '../../lib/profiles';
import type { LoyaltySubscription, Client } from '../../types/database';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { AlertCircle, X, Edit2, CheckCircle } from 'lucide-react';
import { useOrders } from '../../lib/orders';
import { ClientSearchField } from '../common/ClientSearchField';

const subscriptionSchema = z.object({
  client_id: z.string().uuid('Cliente é obrigatório'),
  plan_id: z.string().uuid('Plano é obrigatório'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início é obrigatória'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término inválida').optional().nullable(),
  active: z.boolean().default(true),
  is_recurring: z.boolean().default(false),
  payment_method: z.enum(['BOLETO', 'CREDIT_CARD', 'PIX', 'CASH'], {
    required_error: 'Forma de pagamento é obrigatória',
  }),
  send_to_asaas: z.boolean().default(true),
});

// Schema for client data updates
const clientUpdateSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().min(10, 'Telefone deve ter no mínimo 10 caracteres').optional().nullable(),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido').optional().nullable(),
});

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;
type ClientUpdateData = z.infer<typeof clientUpdateSchema>;

interface LoyaltySubscriptionFormProps {
  initialData?: LoyaltySubscription;
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  onCancel: () => void;
}

export function LoyaltySubscriptionForm({ initialData, onSubmit, onCancel }: LoyaltySubscriptionFormProps) {
  const { plans } = useLoyalty();
  const { clients, fetchClients, updateClient } = useProfiles();
  const { createOrder } = useOrders();
  const [isRecurring, setIsRecurring] = React.useState(initialData?.end_date === null || initialData?.is_recurring === true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [asaasError, setAsaasError] = React.useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);
  const [showClientEdit, setShowClientEdit] = React.useState(false);
  const [selectedClientData, setSelectedClientData] = React.useState<Client | null>(null);
  const [sendToAsaas, setSendToAsaas] = React.useState(initialData ? !!initialData.asaas_subscription_id : true);
  const [isNewClient, setIsNewClient] = React.useState(false);
  const [clientSelectionError, setClientSelectionError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Get the client details for display in edit mode
  const clientDetails = React.useMemo(() => {
    if (!initialData?.client_id) return null;
    return clients.find(c => c.id === initialData.client_id);
  }, [initialData?.client_id, clients]);

  // Prepare defaultValues, handling the client_id properly
  const defaultValues = React.useMemo(() => {
    if (initialData) {
      return {
        client_id: initialData.client_id,
        plan_id: initialData.plan_id,
        start_date: new Date(initialData.start_date).toISOString().split('T')[0],
        end_date: initialData.end_date
          ? new Date(initialData.end_date).toISOString().split('T')[0]
          : null,
        is_recurring: initialData.end_date === null || initialData.is_recurring === true,
        active: initialData.active ?? true,
        payment_method: initialData.payment_method || 'BOLETO',
        send_to_asaas: !!initialData.asaas_subscription_id,
      };
    }

    return {
      active: true,
      start_date: new Date().toISOString().split('T')[0],
      is_recurring: false,
      payment_method: 'BOLETO',
      send_to_asaas: true,
    };
  }, [initialData]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
    trigger,
    clearErrors
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues,
    mode: 'onChange'
  });

  const {
    register: registerClient,
    handleSubmit: handleSubmitClient,
    formState: { errors: clientErrors, isSubmitting: isClientSubmitting },
    reset: resetClientForm
  } = useForm<ClientUpdateData>({
    resolver: zodResolver(clientUpdateSchema),
    defaultValues: {
      full_name: selectedClientData?.full_name || '',
      email: selectedClientData?.email || '',
      phone: selectedClientData?.phone || '',
      cpf: selectedClientData?.cpf || '',
    }
  });

  // Update client form when selected client changes
  React.useEffect(() => {
    if (selectedClientData) {
      resetClientForm({
        full_name: selectedClientData.full_name || '',
        email: selectedClientData?.email || '',
        phone: selectedClientData?.phone || '',
        cpf: selectedClientData?.cpf || '',
      });
    }
  }, [selectedClientData, resetClientForm]);

  // Watch is_recurring to update end_date field
  React.useEffect(() => {
    const subscription = watch('is_recurring');
    if (subscription) {
      setValue('end_date', null);
    }
  }, [watch('is_recurring'), setValue]);

  const watchSendToAsaas = watch('send_to_asaas');

  React.useEffect(() => {
    setSendToAsaas(watchSendToAsaas);
  }, [watchSendToAsaas]);

  // Watch client_id to check if client has all required fields
  const clientId = watch('client_id');
  const paymentMethod = watch('payment_method');
  const planId = watch('plan_id');
  
  // Update selectedClient when clientId changes
  React.useEffect(() => {
    if (clientId) {
      console.log("Client ID changed to:", clientId);
      const selectedClient = clients.find(c => c.id === clientId);
      if (selectedClient) {
        console.log("Found client:", selectedClient.full_name);
        setSelectedClientData(selectedClient);
        setClientSelectionError(null);
      } else {
        console.log("Client not found in clients list");
        setSelectedClientData(null);
      }
    } else {
      console.log("Client ID is empty or null");
      setSelectedClientData(null);
    }
  }, [clientId, clients]);

  // Check if client has all required fields
  const validateClientData = (client?: Client | null): { valid: boolean; missing: string[] } => {
    if (!client) return { valid: false, missing: ['Cliente não selecionado'] };
    
    const missing: string[] = [];
    if (!client.cpf) missing.push('CPF');
    if (!client.email) missing.push('Email');
    if (!client.phone) missing.push('Telefone');
    
    return { valid: missing.length === 0, missing };
  };

  // Only require complete client data for Asaas integration
  const clientValidation = React.useMemo(() => 
    sendToAsaas ? validateClientData(selectedClientData) : { valid: true, missing: [] }
  , [selectedClientData, sendToAsaas]);

  const testAsaasConnection = async () => {
    try {
      setIsTestingConnection(true);
      setAsaasError(null);

      const settings = await getSettings();
      const isValid = await testApiKey(settings.apiKey, settings.environment);

      if (isValid) {
        toast.success('Conexão com o Asaas estabelecida com sucesso!');
        setAsaasError(null);
      }
    } catch (error) {
      console.error('Error testing Asaas connection:', error);
      if (error instanceof Error) {
        if (error.message.includes('API Key')) {
          setAsaasError('Chave de API inválida. Verifique as configurações do Asaas.');
        } else if (error.message.includes('internet')) {
          setAsaasError('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
        } else {
          setAsaasError(`Erro ao testar conexão: ${error.message}`);
        }
      } else {
        setAsaasError('Erro desconhecido ao testar conexão com o Asaas');
      }
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleClientChange = (clientId: string) => {
    console.log("Client changed to:", clientId);
    setValue('client_id', clientId, { shouldValidate: true });
    setClientSelectionError(null);
    clearErrors('client_id');
    
    // Find and set the selected client data
    const selectedClient = clients.find(c => c.id === clientId);
    if (selectedClient) {
      console.log("Found selected client:", selectedClient.full_name);
      setSelectedClientData(selectedClient);
    } else {
      console.log("Selected client not found in clients list");
      // Rather than setting to null, let's try to fetch the client
      fetchClientById(clientId);
    }
  };

  // Function to fetch a specific client by ID
  const fetchClientById = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        console.log("Fetched client by ID:", data);
        setSelectedClientData(data);
        // Also add to the clients array to avoid future fetch
        const updatedClients = [...clients];
        if (!updatedClients.some(c => c.id === data.id)) {
          updatedClients.push(data);
        }
      } else {
        console.log("Client not found by ID");
        setSelectedClientData(null);
      }
    } catch (err) {
      console.error("Error fetching client by ID:", err);
      setSelectedClientData(null);
    }
  };

  const handleUpdateClientData = async (data: ClientUpdateData) => {
    if (!selectedClientData) return;

    try {
      // Format CPF if provided
      let formattedCpf = data.cpf;
      if (formattedCpf) {
        // Remove non-digits
        formattedCpf = formattedCpf.replace(/\D/g, '');
        // Format as XXX.XXX.XXX-XX if length is 11
        if (formattedCpf.length === 11) {
          formattedCpf = `${formattedCpf.substring(0, 3)}.${formattedCpf.substring(3, 6)}.${formattedCpf.substring(6, 9)}-${formattedCpf.substring(9, 11)}`;
        }
      }

      await updateClient(selectedClientData.id, {
        ...data,
        cpf: formattedCpf
      });
      
      // Refresh client data
      await fetchClients();
      
      // Update selected client data
      const updatedClient = clients.find(c => c.id === selectedClientData.id);
      setSelectedClientData(updatedClient || null);
      
      // Close the edit form
      setShowClientEdit(false);
      
      toast.success('Dados do cliente atualizados com sucesso!');
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar dados do cliente');
    }
  };

  const createCashRegisterEntry = async (data: SubscriptionFormData) => {
    try {
      const client = clients.find(c => c.id === data.client_id);
      const plan = plans.find(p => p.id === data.plan_id);
      
      if (!client || !plan) {
        throw new Error('Cliente ou plano não encontrado');
      }

      // Map Asaas payment method to local payment method
      const localPaymentMethod = data.payment_method === 'BOLETO' ? 'cash' : 
                               data.payment_method === 'CREDIT_CARD' ? 'credit_card' : 
                               data.payment_method === 'PIX' ? 'pix' : 'cash';

      // Create transaction in cash register
      await createOrder({
        client_id: client.id,
        barber_id: null, // Optional in transaction
        is_monthly_billing: false,
        items: [{
          service_id: null,
          product_id: null,
          quantity: 1,
          unit_price: plan.monthly_price,
          // Subscription paid directly in cash register
          is_loyalty_service: true,
          subscription_id: null // Will be filled after subscription is created
        }]
      });

      // Create the subscription locally without Asaas integration
      const { send_to_asaas, ...dataForDb } = data;
      return await onSubmit(dataForDb);
    } catch (error) {
      console.error('Error creating cash register entry:', error);
      toast.error(`Erro ao criar entrada no caixa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }
  };

  const handleFormSubmit = async (data: SubscriptionFormData) => {
    try {
      console.log("Submitting form with data:", data);
      
      // Explicit check to ensure client_id is present and valid
      if (!data.client_id) {
        setClientSelectionError("Cliente é obrigatório. Por favor, selecione um cliente.");
        return;
      }

      // Make sure we have client data before proceeding
      if (!selectedClientData && data.client_id) {
        // Try to fetch the client one more time
        await fetchClientById(data.client_id);
        
        // If still null after fetching, we have a problem
        if (!selectedClientData) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', data.client_id)
            .single();
            
          if (clientData) {
            setSelectedClientData(clientData);
          } else {
            setClientSelectionError("Cliente não encontrado no sistema. Por favor, tente novamente.");
            return;
          }
        }
      }
      
      setIsSubmitting(true);
      setAsaasError(null);

      // If we're updating an existing subscription, pass directly to onSubmit
      if (initialData) {
        const { send_to_asaas, ...dataForDb } = data;
        await onSubmit(dataForDb);
        toast.success('Assinatura atualizada com sucesso!');
        return;
      }

      // Double-check if client exists by making a direct database query
      const { data: clientExists, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', data.client_id)
        .single();
        
      if (clientError || !clientExists) {
        setClientSelectionError("Cliente não encontrado no sistema. Por favor, selecione um cliente válido.");
        setIsSubmitting(false);
        return;
      }

      // If not sending to Asaas, create a cash register entry instead
      if (!data.send_to_asaas) {
        await createCashRegisterEntry(data);
        toast.success('Assinatura criada e paga com sucesso!');
        return;
      }

      // For Asaas integrations, validate client data
      const { valid, missing } = validateClientData(selectedClientData);
      if (!valid) {
        setAsaasError(`Dados do cliente incompletos. Preencha os seguintes campos: ${missing.join(', ')}`);
        setShowClientEdit(true);
        setIsSubmitting(false);
        return;
      }

      // Get client and plan details
      const client = clients.find(c => c.id === data.client_id) || selectedClientData;
      const plan = plans.find(p => p.id === data.plan_id);
      
      if (!client || !plan) {
        throw new Error('Cliente ou plano não encontrado');
      }

      // Create or get Asaas customer
      let asaasCustomerId = client.asaas_customer_id;
      
      if (!asaasCustomerId) {
        try {
          // Test connection before creating customer
          await testAsaasConnection();

          const asaasCustomer = await createCustomer({
            name: client.full_name,
            cpfCnpj: client.cpf!,
            email: client.email || undefined,
            phone: client.phone || undefined,
          });
          asaasCustomerId = asaasCustomer.id;

          // Update client with Asaas ID
          const { error: updateError } = await supabase
            .from('clients')
            .update({ asaas_customer_id: asaasCustomerId })
            .eq('id', client.id);

          if (updateError) {
            console.error('Error updating client with Asaas ID:', updateError);
            throw new Error('Erro ao atualizar cliente com ID do Asaas');
          }
        } catch (error) {
          console.error('Error creating Asaas customer:', error);
          
          if (error instanceof Error) {
            if (error.message.includes('Sem conexão')) {
              setAsaasError('Sem conexão com a internet. Verifique sua conexão e tente novamente.');
              setIsSubmitting(false);
              return;
            }
            if (error.message.includes('CPF')) {
              setAsaasError('CPF do cliente é inválido. Verifique o cadastro do cliente.');
              setIsSubmitting(false);
              return;
            }
            if (error.message.includes('API Key')) {
              setAsaasError('Erro de autenticação com o Asaas. Verifique as configurações.');
              setIsSubmitting(false);
              return;
            }
            setAsaasError(error.message);
          } else {
            setAsaasError('Erro ao criar cliente no Asaas. Tente novamente mais tarde.');
          }
          setIsSubmitting(false);
          return;
        }
      }

      // Create Asaas subscription
      try {
        const asaasSubscription = await createSubscription({
          customer: asaasCustomerId,
          value: plan.monthly_price,
          billingType: data.payment_method,
          description: `Assinatura do plano ${plan.name}`,
          nextDueDate: data.start_date,
        });

        // Add Asaas subscription ID to the data
        const subscriptionData = {
          ...data,
          asaas_subscription_id: asaasSubscription.id,
        };

        // Remove send_to_asaas which is not a database column
        const { send_to_asaas, ...dataForDb } = subscriptionData;

        // Create local subscription
        await onSubmit(dataForDb);
        toast.success('Assinatura criada com sucesso no Asaas!');
      } catch (error) {
        console.error('Error creating Asaas subscription:', error);
        if (error instanceof Error) {
          setAsaasError(error.message);
        } else {
          setAsaasError('Erro ao criar assinatura no Asaas. Verifique as configurações e tente novamente.');
        }
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error in handleFormSubmit:', error);
      if (error instanceof Error) {
        setAsaasError(error.message);
      } else {
        setAsaasError('Erro ao criar assinatura. Tente novamente mais tarde.');
      }
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {asaasError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erro na integração com o Asaas</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{asaasError}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={testAsaasConnection}
                  disabled={isTestingConnection}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {isTestingConnection ? 'Testando conexão...' : 'Testar conexão com Asaas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client edit modal */}
      {showClientEdit && selectedClientData && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Atualizar Dados do Cliente
              </h3>
              <button 
                type="button"
                onClick={() => setShowClientEdit(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Os seguintes dados são necessários para a criação da assinatura: {' '}
                    <span className="font-medium">
                      {validateClientData(selectedClientData).missing.join(', ')}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitClient(handleUpdateClientData)} className="space-y-4">
              <div>
                <label htmlFor="client-fullname" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="client-fullname"
                  {...registerClient('full_name')}
                  className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                {clientErrors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{clientErrors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="client-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="client-email"
                  {...registerClient('email')}
                  className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                {clientErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{clientErrors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="client-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="client-phone"
                  {...registerClient('phone')}
                  className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                {clientErrors.phone && (
                  <p className="mt-1 text-sm text-red-600">{clientErrors.phone.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="client-cpf" className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  id="client-cpf"
                  {...registerClient('cpf')}
                  placeholder="000.000.000-00"
                  className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                {clientErrors.cpf && (
                  <p className="mt-1 text-sm text-red-600">{clientErrors.cpf.message}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClientEdit(false)}
                  className="h-10 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isClientSubmitting}
                  className="h-10 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isClientSubmitting ? 'Salvando...' : 'Atualizar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tooltip">
        <label htmlFor="client-field" className="block text-sm font-medium text-gray-700 mb-1">
          Cliente
        </label>
        <span className="tooltiptext">
          Selecione o cliente que irá assinar o plano
        </span>
      
        {initialData ? (
          // Display client name as static text when editing
          <div className="mt-1">
            <div className="py-2 px-3 bg-gray-100 rounded-md border border-gray-300 text-gray-700 h-10 flex items-center">
              {clientDetails?.full_name || 'Cliente não encontrado'}
            </div>
            <input type="hidden" id="client-field" {...register('client_id')} />
            <p className="mt-1 text-xs text-gray-500">O cliente não pode ser alterado em uma assinatura existente.</p>
          </div>
        ) : (
          // Show search field for new subscriptions
          <div className="mt-1 relative">
            <ClientSearchField
              value={watch('client_id')}
              onChange={handleClientChange}
              error={errors.client_id?.message || clientSelectionError}
              required={true}
              onClientCreate={() => setIsNewClient(true)}
            />
            {selectedClientData && sendToAsaas && !clientValidation.valid && (
              <div className="mt-2 flex items-center justify-between bg-yellow-50 p-2 rounded-md border border-yellow-200">
                <div className="flex items-center text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>Dados incompletos: falta {clientValidation.missing.join(', ')}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowClientEdit(true)}
                  className="text-primary-600 hover:text-primary-800 text-sm flex items-center"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Editar
                </button>
              </div>
            )}
            {selectedClientData && sendToAsaas && clientValidation.valid && (
              <div className="mt-2 flex items-center justify-between bg-green-50 p-2 rounded-md border border-green-200">
                <div className="flex items-center text-sm text-green-800">
                  <CheckCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>Dados completos para assinatura</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowClientEdit(true)}
                  className="text-primary-600 hover:text-primary-800 text-sm flex items-center"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Editar
                </button>
              </div>
            )}
          </div>
        )}
        {(errors.client_id || clientSelectionError) && (
          <p className="mt-1 text-sm text-red-600">{errors.client_id?.message || clientSelectionError}</p>
        )}
      </div>

      <div className="tooltip">
        <label htmlFor="plan-select" className="block text-sm font-medium text-gray-700 mb-1">
          Plano
        </label>
        <span className="tooltiptext">
          Selecione o plano de assinatura
        </span>
        <select
          id="plan-select"
          {...register('plan_id')}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="">Selecione um plano</option>
          {plans?.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} - R$ {plan.monthly_price.toFixed(2)}/mês
            </option>
          ))}
        </select>
        {errors.plan_id && (
          <p className="mt-1 text-sm text-red-600">{errors.plan_id.message}</p>
        )}
      </div>
      
      <div className="border-t border-gray-200 pt-4">
        <div className="tooltip flex items-center mb-4">
          <input
            type="checkbox"
            id="send-to-asaas"
            {...register('send_to_asaas')}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            disabled={!!initialData}
          />
          <label htmlFor="send-to-asaas" className="ml-2 block text-sm text-gray-900">
            Enviar para o Asaas (cobrança online)
          </label>
          <span className="tooltiptext">
            Se marcado, a assinatura será enviada para o Asaas para cobrança online automática
          </span>
        </div>
        
        <p className="text-sm text-gray-500 mb-4">
          {sendToAsaas ? 
            "O cliente receberá cobrança online via Asaas conforme o vencimento." : 
            "A assinatura será processada diretamente no caixa como paga."}
        </p>
      </div>

      <div className="tooltip">
        <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-1">
          Forma de Pagamento
        </label>
        <span className="tooltiptext">
          Selecione como o cliente irá pagar pela assinatura
        </span>
        <select
          id="payment-method"
          {...register('payment_method')}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="BOLETO">Boleto</option>
          <option value="CREDIT_CARD">Cartão de Crédito</option>
          <option value="PIX">PIX</option>
          {!sendToAsaas && <option value="CASH">Dinheiro</option>}
        </select>
        {errors.payment_method && (
          <p className="mt-1 text-sm text-red-600">{errors.payment_method.message}</p>
        )}
      </div>

      <div className="tooltip">
        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Início
        </label>
        <span className="tooltiptext">
          Data em que a assinatura começa a valer
        </span>
        <input
          type="date"
          id="start-date"
          {...register('start_date')}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.start_date && (
          <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
        )}
      </div>

      <div className="tooltip flex items-center mb-4">
        <input
          type="checkbox"
          {...register('is_recurring')}
          id="is-recurring"
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          onChange={(e) => {
            setIsRecurring(e.target.checked);
            if (e.target.checked) {
              setValue('end_date', null);
            }
          }}
        />
        <label htmlFor="is-recurring" className="ml-2 block text-sm text-gray-900">
          Assinatura recorrente (sem data de término)
        </label>
        <span className="tooltiptext">
          Se marcado, a assinatura será renovada automaticamente todo mês sem data de término
        </span>
      </div>

      {!isRecurring && (
        <div className="tooltip">
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
            Data de Término
          </label>
          <span className="tooltiptext">
            Data em que a assinatura expira
          </span>
          <input
            type="date"
            id="end-date"
            {...register('end_date')}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          {errors.end_date && (
            <p className="mt-1 text-sm text-red-600">{errors.end_date.message}</p>
          )}
        </div>
      )}

      <div className="tooltip flex items-center">
        <input
          type="checkbox"
          id="subscription-active"
          {...register('active')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="subscription-active" className="ml-2 block text-sm text-gray-900">
          Assinatura ativa
        </label>
        <span className="tooltiptext">
          Controle se a assinatura está ativa ou suspensa
        </span>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <div className="tooltip">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <span className="tooltiptext">
            Cancelar e voltar sem salvar alterações
          </span>
        </div>
        <div className="tooltip">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
          </button>
          <span className="tooltiptext">
            {initialData ? 'Salvar alterações na assinatura' : 'Criar nova assinatura'}
          </span>
        </div>
      </div>
    </form>
  );
}