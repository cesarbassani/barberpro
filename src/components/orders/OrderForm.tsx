import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOrders } from '../../lib/orders';
import { useProfiles } from '../../lib/profiles';
import { useServices } from '../../lib/services';
import { useProducts } from '../../lib/products';
import { useAuth } from '../../lib/auth';
import { useLoyalty } from '../../lib/loyalty';
import { useInventory } from '../../lib/inventory';
import { Plus, Trash2, AlertTriangle, Users, User } from 'lucide-react';
import type { Transaction } from '../../types/database';
import toast from 'react-hot-toast';
import { ClientSearchField } from '../common/ClientSearchField';
import { ClientForm } from '../clients/ClientForm';
import { ProfessionalSelector } from './ProfessionalSelector';

const orderItemSchema = z.object({
  type: z.enum(['service', 'product']),
  service_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  quantity: z.number().min(1, 'Quantidade deve ser maior que zero'),
  unit_price: z.number().min(0, 'Preço deve ser maior ou igual a zero'),
  is_loyalty_service: z.boolean().optional(),
  subscription_id: z.string().uuid().nullable().optional(),
  professional_id: z.string().uuid().nullable(),
});

const orderSchema = z.object({
  client_id: z.string().uuid('Cliente é obrigatório'),
  is_monthly_billing: z.boolean().default(false),
  items: z.array(orderItemSchema).min(1, 'Adicione pelo menos um item').refine(
    (items) => {
      return items.every((item) => {
        if (item.type === 'service') return !!item.service_id;
        if (item.type === 'product') return !!item.product_id;
        return false;
      });
    },
    { message: 'Selecione um serviço ou produto para cada item' }
  ).refine(
    (items) => {
      // Verifica se todos os itens têm profissional atribuído
      return items.every((item) => !!item.professional_id);
    },
    { message: 'Todos os itens devem ter um profissional atribuído' }
  ),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  initialData?: Transaction & {
    items: Array<{
      id: string;
      service_id: string | null;
      product_id: string | null;
      quantity: number;
      unit_price: number;
      total_price: number;
      service?: { name: string } | null;
      product?: { name: string } | null;
      is_loyalty_service?: boolean;
      subscription_id?: string | null;
      professional_id?: string | null;
      professional?: { full_name: string } | null;
    }>;
  };
  onClose: () => void;
}

export function OrderForm({ initialData, onClose }: OrderFormProps) {
  const { createOrder, updateOrder } = useOrders();
  const { clients, barbers, fetchClients, fetchBarbers } = useProfiles();
  const { services, fetchServices } = useServices();
  const { products, fetchProducts } = useProducts();
  const { profile } = useAuth();
  const { getActiveSubscriptionForClient, checkServiceCoverage } = useLoyalty();
  const { isStockAvailable } = useInventory();
  
  // Estado para controlar erros de submit
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para controlar o cliente selecionado
  const [selectedClient, setSelectedClient] = useState<string | null>(
    initialData?.client_id || null
  );
  
  // Estado para cliente ativo, assinatura e plano
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [serviceCoverage, setServiceCoverage] = useState<Record<string, any>>({});
  
  // Estado para novo cliente
  const [isNewClientFormOpen, setIsNewClientFormOpen] = useState(false);
  
  // Estado para controle de scroll da lista de produtos/serviços
  const [itemsScrollHeight, setItemsScrollHeight] = useState('');

  // Estado para controle de disponibilidade de estoque
  const [stockAvailability, setStockAvailability] = useState<Record<string, boolean>>({});

  // Lógica para calcular a altura máxima para scroll responsivo
  useEffect(() => {
    const updateScrollHeight = () => {
      // Calcular 60% da altura da janela, limitado entre 300px e 600px
      const viewportHeight = window.innerHeight;
      const maxHeight = Math.max(300, Math.min(600, viewportHeight * 0.6));
      setItemsScrollHeight(`${maxHeight}px`);
    };

    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);
    return () => window.removeEventListener('resize', updateScrollHeight);
  }, []);
  
  // Criar o objeto de valores padrão
  const defaultValues = React.useMemo(() => {
    if (initialData) {
      // Mapeia os itens corretamente para o formato esperado pelo formulário
      const mappedItems = initialData.items.map(item => ({
        type: item.service_id ? 'service' : 'product',
        service_id: item.service_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        is_loyalty_service: item.is_loyalty_service || false,
        subscription_id: item.subscription_id || null,
        professional_id: item.professional_id || null
      }));

      return {
        client_id: initialData.client_id,
        is_monthly_billing: initialData.is_monthly_billing || false,
        items: mappedItems,
      };
    }

    return {
      client_id: selectedClient || '',
      is_monthly_billing: false,
      items: [{ 
        type: 'service', 
        service_id: null, 
        product_id: null, 
        quantity: 1, 
        unit_price: 0,
        is_loyalty_service: false,
        subscription_id: null,
        professional_id: profile?.role === 'barber' ? profile.id : null
      }],
    };
  }, [initialData, selectedClient, profile]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues,
    mode: 'onChange'
  });

  // Atualizar o formulário se o cliente muda
  React.useEffect(() => {
    if (selectedClient && !initialData) {
      setValue('client_id', selectedClient);
    }
  }, [selectedClient, setValue, initialData]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
    keyName: 'fieldId'
  });

  // Carregar dados necessários
  React.useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchClients(),
          fetchBarbers(),
          fetchServices(),
          fetchProducts()
        ]);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setSubmitError('Erro ao carregar dados. Tente novamente.');
      }
    };
    
    loadData();
  }, [fetchClients, fetchBarbers, fetchServices, fetchProducts]);

  // Verificar plano de assinatura ativa quando o cliente é selecionado
  React.useEffect(() => {
    const checkSubscription = async () => {
      if (!selectedClient) {
        setActiveSubscription(null);
        setServiceCoverage({});
        return;
      }
      
      try {
        const subscriptionData = await getActiveSubscriptionForClient(selectedClient);
        setActiveSubscription(subscriptionData?.subscription || null);
        
        // Se existe assinatura ativa, verificar cobertura para todos os serviços
        if (subscriptionData?.subscription) {
          const coverageInfo: Record<string, any> = {};
          
          // Check coverage for all services
          for (const service of services) {
            const coverage = await checkServiceCoverage(
              selectedClient, 
              service.id
            );
            coverageInfo[service.id] = coverage;
          }
          
          setServiceCoverage(coverageInfo);
        }
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
      }
    };
    
    checkSubscription();
  }, [selectedClient, services, getActiveSubscriptionForClient, checkServiceCoverage]);

  // Função para tratar a seleção de cliente
  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    setValue('client_id', clientId, { shouldValidate: true });
  };
  
  // Função para tratar a criação de um novo cliente
  const handleClientCreate = () => {
    setIsNewClientFormOpen(true);
  };
  
  // Função para tratar o sucesso na criação de um novo cliente
  const handleClientCreated = () => {
    setIsNewClientFormOpen(false);
    // Recarregar lista de clientes
    fetchClients();
  };

  // Função para tratar a mudança de tipo (serviço/produto)
  const handleTypeChange = (index: number, type: 'service' | 'product') => {
    // Limpar o ID do outro tipo ao alternar
    if (type === 'service') {
      setValue(`items.${index}.product_id`, null);
    } else {
      setValue(`items.${index}.service_id`, null);
    }
    setValue(`items.${index}.type`, type);
    setValue(`items.${index}.unit_price`, 0);
    setValue(`items.${index}.quantity`, 1);
    setValue(`items.${index}.is_loyalty_service`, false);
    setValue(`items.${index}.subscription_id`, null);
    
    // Manter o professional_id inalterado ao trocar o tipo
    // Isso garante que o profissional permanece atribuído mesmo ao trocar serviço/produto
  };

  // Função para tratar a seleção de serviço
  const handleServiceChange = async (index: number, serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setValue(`items.${index}.service_id`, serviceId);
      setValue(`items.${index}.unit_price`, Number(service.price));
      setValue(`items.${index}.quantity`, 1);
      
      // Verificar se o serviço está coberto pelo plano de fidelidade
      if (activeSubscription && selectedClient) {
        const coverage = serviceCoverage[serviceId];
        if (coverage?.isCovered) {
          setValue(`items.${index}.is_loyalty_service`, true);
          setValue(`items.${index}.unit_price`, 0);
          setValue(`items.${index}.subscription_id`, activeSubscription.id);
        } else {
          setValue(`items.${index}.is_loyalty_service`, false);
          setValue(`items.${index}.subscription_id`, null);
        }
      }
    }
  };

  // Função para tratar a seleção de produto
  const handleProductChange = async (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setValue(`items.${index}.product_id`, productId);
      
      // Apply discount if client has an active plan
      let finalPrice = Number(product.price);
      if (activeSubscription) {
        const discountPercent = activeSubscription.plan.product_discount_percentage;
        if (discountPercent > 0) {
          finalPrice = finalPrice * (1 - discountPercent / 100);
        }
      }
      
      setValue(`items.${index}.unit_price`, finalPrice);
      setValue(`items.${index}.quantity`, 1);
      
      // Check stock availability
      const isAvailable = await isStockAvailable(productId, 1);
      updateStockAvailability(productId, isAvailable);
    }
  };

  // Update stock availability when quantity changes
  const handleQuantityChange = async (index: number, quantity: number) => {
    const items = watch('items');
    const item = items[index];
    
    if (item && item.type === 'product' && item.product_id) {
      const isAvailable = await isStockAvailable(item.product_id, quantity);
      updateStockAvailability(item.product_id, isAvailable);
    }
    
    setValue(`items.${index}.quantity`, quantity);
  };

  // Update stock availability state
  const updateStockAvailability = (productId: string, isAvailable: boolean) => {
    setStockAvailability(prev => ({
      ...prev,
      [productId]: isAvailable
    }));
  };

  // Função para tratar a seleção de profissional
  const handleProfessionalChange = (index: number, professionalId: string) => {
    setValue(`items.${index}.professional_id`, professionalId);
  };

  // Função para verificar se um serviço está coberto pelo plano
  const isServiceCoveredByPlan = (serviceId: string) => {
    return (
      activeSubscription && 
      serviceCoverage[serviceId]?.isCovered
    );
  };

  // Função para obter a informação de cobertura do serviço
  const getServiceCoverageInfo = (serviceId: string) => {
    if (!activeSubscription || !serviceCoverage[serviceId]) {
      return null;
    }
    
    return serviceCoverage[serviceId];
  };

  // Envio do formulário
  const onSubmit = async (data: OrderFormData) => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      // Verificar se há cliente selecionado
      if (!data.client_id) {
        throw new Error('Cliente não selecionado');
      }
      
      // Validação de itens - garantir que cada item tem pelo menos um serviço ou produto
      for (const item of data.items) {
        if (item.type === 'service' && !item.service_id) {
          throw new Error('Serviço não selecionado para um ou mais itens');
        }
        if (item.type === 'product' && !item.product_id) {
          throw new Error('Produto não selecionado para um ou mais itens');
        }
      }
      
      // Verificar que todos os itens têm profissionais atribuídos
      const itemsWithoutProfessional = data.items.filter(
        item => !item.professional_id
      );
      
      if (itemsWithoutProfessional.length > 0) {
        throw new Error('Cada item deve ter um profissional atribuído');
      }
      
      // Verificar disponibilidade de estoque para produtos
      const productItems = data.items.filter(item => item.type === 'product' && item.product_id);
      
      for (const item of productItems) {
        if (item.product_id) {
          const isAvailable = await isStockAvailable(item.product_id, item.quantity);
          if (!isAvailable) {
            const product = products.find(p => p.id === item.product_id);
            throw new Error(`Estoque insuficiente para "${product?.name || 'produto'}"`);
          }
        }
      }
      
      // Formatar itens corretamente
      const formattedItems = data.items.map(item => ({
        service_id: item.type === 'service' ? item.service_id : null,
        product_id: item.type === 'product' ? item.product_id : null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        is_loyalty_service: item.is_loyalty_service || false,
        subscription_id: item.subscription_id || null,
        professional_id: item.professional_id || null
      }));

      // Se estamos atualizando uma comanda existente
      if (initialData) {
        await updateOrder(initialData.id, {
          client_id: initialData.client_id, // Garantir que usamos o ID do cliente original
          is_monthly_billing: data.is_monthly_billing,
          items: formattedItems,
        });
        toast.success('Comanda atualizada com sucesso!');
      } else {
        // Criando nova comanda
        await createOrder({
          client_id: data.client_id,
          is_monthly_billing: data.is_monthly_billing,
          items: formattedItems,
        });
        toast.success('Comanda criada com sucesso!');
      }

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar comanda';
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {submitError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="client-field" className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          {initialData ? (
            <div className="fixed-height-input flex items-center h-10 px-3 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
              <span className="truncate">
                {initialData.client?.full_name || "Cliente"}
              </span>
              <input type="hidden" id="client-field" {...register('client_id')} />
            </div>
          ) : (
            <ClientSearchField
              value={selectedClient || ''}
              onChange={handleClientChange}
              onClientCreate={handleClientCreate}
              error={errors.client_id?.message}
              required={true}
            />
          )}
          {errors.client_id && (
            <p className="mt-1 text-sm text-red-600">{errors.client_id.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="monthly-billing"
              {...register('is_monthly_billing')}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="monthly-billing" className="ml-2 block text-sm text-gray-900">
              Faturamento Mensal
            </label>
          </div>
        </div>
      </div>

      {/* Client Plan Info - Show if client has an active subscription */}
      {activeSubscription && (
        <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-indigo-800 flex items-center">
                <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                Cliente possui plano de fidelidade ativo
              </h3>
              <div className="mt-2 text-sm text-indigo-600">
                <p><strong>Plano:</strong> {activeSubscription.plan.name}</p>
                <p><strong>Descontos:</strong> {activeSubscription.plan.product_discount_percentage}% em produtos, {activeSubscription.plan.service_discount_percentage}% em serviços</p>
                <p>
                  <strong>Status:</strong> {activeSubscription.active ? 'Ativo' : 'Inativo'} 
                  {activeSubscription.end_date && !activeSubscription.is_recurring && (
                    <span> até {new Date(activeSubscription.end_date).toLocaleDateString()}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-medium text-gray-900">Itens</h4>
          <button
            type="button"
            onClick={() => append({ 
              type: 'service', 
              service_id: null, 
              product_id: null, 
              quantity: 1, 
              unit_price: 0,
              is_loyalty_service: false,
              subscription_id: null,
              professional_id: null
            })}
            title="Adicionar novo item à comanda"
            className="flex items-center px-2 py-1 text-sm text-primary-600 hover:text-primary-900"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Item
          </button>
        </div>

        <div 
          className="space-y-4 overflow-y-auto" 
          style={{ maxHeight: itemsScrollHeight }}
        >
          {fields.map((field, index) => {
            const itemType = watch(`items.${index}.type`);
            const serviceId = watch(`items.${index}.service_id`);
            const productId = watch(`items.${index}.product_id`);
            const professionalId = watch(`items.${index}.professional_id`);
            const isLoyaltyService = watch(`items.${index}.is_loyalty_service`);
            const productQuantity = watch(`items.${index}.quantity`);
            
            // Get coverage info for this service
            const coverageInfo = serviceId ? getServiceCoverageInfo(serviceId) : null;
            
            // Check stock availability for this product
            const isProductAvailable = productId 
              ? stockAvailability[productId] !== undefined 
                ? stockAvailability[productId] 
                : true // Default to true if not checked yet
              : true;
            
            return (
              <div key={field.fieldId} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-4">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={`item-type-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo
                        </label>
                        <select
                          id={`item-type-${index}`}
                          value={itemType}
                          onChange={(e) => handleTypeChange(index, e.target.value as 'service' | 'product')}
                          className="fixed-height-select-container block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                          <option value="service">Serviço</option>
                          <option value="product">Produto</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`item-select-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                          {itemType === 'service' ? 'Serviço' : 'Produto'}
                        </label>
                        <select
                          id={`item-select-${index}`}
                          value={itemType === 'service' ? serviceId || '' : productId || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              if (itemType === 'service') {
                                handleServiceChange(index, e.target.value);
                              } else {
                                handleProductChange(index, e.target.value);
                              }
                            }
                          }}
                          className="fixed-height-select-container block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                          <option value="">Selecione</option>
                          {itemType === 'service'
                            ? services.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name} - R$ {Number(service.price).toFixed(2)}
                                  {isServiceCoveredByPlan(service.id) ? ' [Plano]' : ''}
                                </option>
                              ))
                            : products.map((product) => {
                                // Apply discount if client has an active plan
                                let discountedPrice = Number(product.price);
                                if (activeSubscription) {
                                  const discountPercent = activeSubscription.plan.product_discount_percentage;
                                  if (discountPercent > 0) {
                                    discountedPrice = discountedPrice * (1 - discountPercent / 100);
                                  }
                                }
                                
                                return (
                                  <option 
                                    key={product.id} 
                                    value={product.id}
                                    disabled={product.stock_quantity <= 0}
                                  >
                                    {product.name} - R$ {discountedPrice.toFixed(2)}
                                    {activeSubscription && activeSubscription.plan.product_discount_percentage > 0 
                                      ? ` (${activeSubscription.plan.product_discount_percentage}% off)` 
                                      : ''}
                                    {product.stock_quantity <= 0 ? ' [Sem estoque]' : ''}
                                  </option>
                                );
                              })}
                        </select>
                      </div>
                    </div>

                    {/* Professional selector for ALL items */}
                    <div>
                      <label htmlFor={`item-professional-${index}`} className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <User className="h-4 w-4 mr-1 text-primary-600" />
                        Profissional Responsável
                      </label>
                      <ProfessionalSelector
                        id={`item-professional-${index}`}
                        value={professionalId || ''}
                        onChange={(id) => handleProfessionalChange(index, id)}
                        barbers={barbers}
                      />
                      {!professionalId && (
                        <p className="mt-1 text-xs text-red-500">
                          É necessário selecionar um profissional para este item
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={`item-quantity-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          id={`item-quantity-${index}`}
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className="fixed-height-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                          disabled={isLoyaltyService}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value))}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="mt-1 text-sm text-red-600">{errors.items?.[index]?.quantity?.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`item-price-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                          Preço Unitário
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          id={`item-price-${index}`}
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                          className="fixed-height-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                          disabled={isLoyaltyService}
                        />
                        <input
                          type="hidden"
                          {...register(`items.${index}.is_loyalty_service`)}
                        />
                        <input
                          type="hidden"
                          {...register(`items.${index}.subscription_id`)}
                        />
                        <input
                          type="hidden"
                          {...register(`items.${index}.professional_id`)}
                        />
                        {errors.items?.[index]?.unit_price && (
                          <p className="mt-1 text-sm text-red-600">{errors.items?.[index]?.unit_price?.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Stock warning for products */}
                    {itemType === 'product' && productId && !isProductAvailable && (
                      <div className="text-xs p-2 rounded bg-red-50 text-red-800">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          <span className="font-medium">Estoque insuficiente</span>
                        </div>
                        <p className="mt-1">
                          A quantidade solicitada não está disponível no estoque.
                        </p>
                      </div>
                    )}

                    {/* Plan coverage information */}
                    {itemType === 'service' && serviceId && coverageInfo && (
                      <div className={`text-xs p-2 rounded ${isLoyaltyService ? 'bg-indigo-50 text-indigo-800' : 'bg-gray-50 text-gray-700'}`}>
                        <div className="flex justify-between">
                          <span>Plano de Fidelidade:</span>
                          <span>
                            {coverageInfo.isCovered 
                              ? `Incluído (${coverageInfo.usesLeft} uso(s) restante(s))` 
                              : `Não incluso (${coverageInfo.usedCount}/${coverageInfo.totalAllowed} usados)`}
                          </span>
                        </div>
                        {isLoyaltyService && (
                          <p className="mt-1 font-medium text-indigo-700">
                            Este serviço está sendo coberto pelo plano de fidelidade
                          </p>
                        )}
                        {!isLoyaltyService && coverageInfo.isCovered && (
                          <button
                            type="button"
                            className="mt-1 text-indigo-600 hover:text-indigo-800 font-medium"
                            onClick={() => {
                              setValue(`items.${index}.is_loyalty_service`, true);
                              setValue(`items.${index}.unit_price`, 0);
                              setValue(`items.${index}.subscription_id`, activeSubscription.id);
                            }}
                          >
                            Usar benefício do plano
                          </button>
                        )}
                        {isLoyaltyService && (
                          <button
                            type="button"
                            className="mt-1 text-gray-600 hover:text-gray-800 font-medium"
                            onClick={() => {
                              setValue(`items.${index}.is_loyalty_service`, false);
                              const service = services.find(s => s.id === serviceId);
                              if (service) {
                                setValue(`items.${index}.unit_price`, Number(service.price));
                              }
                              setValue(`items.${index}.subscription_id`, null);
                            }}
                          >
                            Cobrar valor normal
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Product discount information */}
                    {itemType === 'product' && productId && activeSubscription && activeSubscription.plan.product_discount_percentage > 0 && (
                      <div className="text-xs p-2 rounded bg-indigo-50 text-indigo-800">
                        <div className="flex justify-between">
                          <span>Desconto do Plano:</span>
                          <span>{activeSubscription.plan.product_discount_percentage}% aplicado</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    title="Remover este item da comanda"
                    className="mt-6 text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {errors.items && (
          <p className="mt-1 text-sm text-red-600">{errors.items.message}</p>
        )}
      </div>
      
      {/* New client form modal */}
      {isNewClientFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Novo Cliente
            </h3>
            <ClientForm
              onCancel={() => setIsNewClientFormOpen(false)}
              onSuccess={handleClientCreated}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          title="Cancelar e fechar formulário"
          className="h-10 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          title={initialData ? "Salvar alterações na comanda" : "Criar nova comanda"}
          className="h-10 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar Comanda'}
        </button>
      </div>
    </form>
  );
}