import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { 
  DollarSign, 
  CreditCard, 
  Percent, 
  FileText,
  Save,
  RefreshCw,
  HelpCircle,
  AlertCircle,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

// Schema for financial settings
const financialSettingsSchema = z.object({
  paymentMethods: z.object({
    acceptCash: z.boolean(),
    acceptCreditCard: z.boolean(),
    acceptDebitCard: z.boolean(),
    acceptPix: z.boolean(),
  }),
  
  taxes: z.object({
    taxRate: z.number().min(0, 'Taxa não pode ser negativa').max(100, 'Taxa não pode exceder 100%'),
    applyTaxToServices: z.boolean(),
    applyTaxToProducts: z.boolean(),
    includeTaxInPrice: z.boolean(),
    displayTaxSeparately: z.boolean()
  }),
  
  discounts: z.object({
    enableDiscounts: z.boolean(),
    maxDiscountPercentage: z.number().min(0, 'Desconto não pode ser negativo').max(100, 'Desconto não pode exceder 100%'),
    allowEmployeesToGiveDiscounts: z.boolean(),
    requireApprovalAbove: z.number().min(0, 'Valor não pode ser negativo').max(100, 'Valor não pode exceder 100%')
  }),
  
  commissions: z.object({
    defaultServiceCommission: z.number().min(0, 'Comissão não pode ser negativa').max(100, 'Comissão não pode exceder 100%'),
    defaultProductCommission: z.number().min(0, 'Comissão não pode ser negativa').max(100, 'Comissão não pode exceder 100%'),
    payCommissionsOnCancelled: z.boolean(),
    commissionCalculationPeriod: z.enum(['daily', 'weekly', 'biweekly', 'monthly'])
  }),
  
  invoicing: z.object({
    enableAutomaticReceipts: z.boolean(),
    receiptTemplate: z.string().optional(),
    invoicePrefix: z.string().optional(),
    invoiceStartNumber: z.number().int().min(1, 'Número inicial deve ser maior que zero').optional(),
    termsAndConditions: z.string().optional()
  })
});

type FinancialSettingsData = z.infer<typeof financialSettingsSchema>;

export function FinancialSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue,
    reset,
    formState: { errors } 
  } = useForm<FinancialSettingsData>({
    resolver: zodResolver(financialSettingsSchema),
    defaultValues: {
      paymentMethods: {
        acceptCash: true,
        acceptCreditCard: true,
        acceptDebitCard: true,
        acceptPix: true
      },
      taxes: {
        taxRate: 0,
        applyTaxToServices: false,
        applyTaxToProducts: true,
        includeTaxInPrice: true,
        displayTaxSeparately: false
      },
      discounts: {
        enableDiscounts: true,
        maxDiscountPercentage: 10,
        allowEmployeesToGiveDiscounts: false,
        requireApprovalAbove: 5
      },
      commissions: {
        defaultServiceCommission: 50,
        defaultProductCommission: 10,
        payCommissionsOnCancelled: false,
        commissionCalculationPeriod: 'biweekly'
      },
      invoicing: {
        enableAutomaticReceipts: true,
        invoicePrefix: 'BP-',
        invoiceStartNumber: 1001,
        termsAndConditions: 'Obrigado por escolher nossos serviços'
      }
    }
  });

  // Load financial settings on component mount
  useEffect(() => {
    const loadFinancialSettings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'financial_settings')
          .single();
        
        if (error) {
          if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            throw error;
          }
          // If no data, keep defaults
          return;
        }
        
        if (data?.value) {
          reset(data.value as FinancialSettingsData);
        }
      } catch (error) {
        console.error('Error loading financial settings:', error);
        toast.error('Erro ao carregar configurações financeiras');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFinancialSettings();
  }, [reset]);

  const onSubmit = async (data: FinancialSettingsData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'financial_settings',
          value: data
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      toast.success('Configurações financeiras salvas com sucesso!');
    } catch (error) {
      console.error('Error saving financial settings:', error);
      toast.error('Erro ao salvar configurações financeiras');
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
            <DollarSign className="h-6 w-6 text-primary-600 mr-2" />
            <h3 className="text-lg font-medium leading-6 text-gray-900">Parâmetros Financeiros</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section: Formas de Pagamento */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <CreditCard className="h-4 w-4 mr-2 text-primary-600" />
              Formas de Pagamento Aceitas
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="tooltip">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <label htmlFor="acceptCash" className="text-sm font-medium text-gray-700 flex items-center">
                    Dinheiro
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="acceptCash"
                      {...register('paymentMethods.acceptCash')}
                      className="sr-only"
                    />
                    <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                    <div 
                      className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                        watch('paymentMethods.acceptCash') ? 'transform translate-x-6 bg-primary-600' : ''
                      }`}
                    ></div>
                  </div>
                </div>
                <span className="tooltiptext">Aceitar pagamentos em dinheiro</span>
              </div>

              <div className="tooltip">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <label htmlFor="acceptCreditCard" className="text-sm font-medium text-gray-700 flex items-center">
                    Cartão de Crédito
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="acceptCreditCard"
                      {...register('paymentMethods.acceptCreditCard')}
                      className="sr-only"
                    />
                    <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                    <div 
                      className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                        watch('paymentMethods.acceptCreditCard') ? 'transform translate-x-6 bg-primary-600' : ''
                      }`}
                    ></div>
                  </div>
                </div>
                <span className="tooltiptext">Aceitar pagamentos com cartão de crédito</span>
              </div>

              <div className="tooltip">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <label htmlFor="acceptDebitCard" className="text-sm font-medium text-gray-700 flex items-center">
                    Cartão de Débito
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="acceptDebitCard"
                      {...register('paymentMethods.acceptDebitCard')}
                      className="sr-only"
                    />
                    <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                    <div 
                      className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                        watch('paymentMethods.acceptDebitCard') ? 'transform translate-x-6 bg-primary-600' : ''
                      }`}
                    ></div>
                  </div>
                </div>
                <span className="tooltiptext">Aceitar pagamentos com cartão de débito</span>
              </div>

              <div className="tooltip">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <label htmlFor="acceptPix" className="text-sm font-medium text-gray-700 flex items-center">
                    PIX
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="acceptPix"
                      {...register('paymentMethods.acceptPix')}
                      className="sr-only"
                    />
                    <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                    <div 
                      className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                        watch('paymentMethods.acceptPix') ? 'transform translate-x-6 bg-primary-600' : ''
                      }`}
                    ></div>
                  </div>
                </div>
                <span className="tooltiptext">Aceitar pagamentos via PIX</span>
              </div>
            </div>
          </div>

          {/* Section: Impostos */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Percent className="h-4 w-4 mr-2 text-primary-600" />
              Impostos e Taxas
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="tooltip">
                <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1">
                  Taxa de Imposto (%)
                </label>
                <span className="tooltiptext">Percentual de imposto aplicado aos produtos e serviços</span>
                <input
                  type="number"
                  id="taxRate"
                  {...register('taxes.taxRate', { valueAsNumber: true })}
                  min="0"
                  max="100"
                  step="0.01"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.taxes?.taxRate && (
                  <p className="mt-1 text-sm text-red-600">{errors.taxes.taxRate.message}</p>
                )}
              </div>

              <div className="flex flex-col space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="applyTaxToServices"
                    {...register('taxes.applyTaxToServices')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="applyTaxToServices" className="ml-2 block text-sm text-gray-700">
                    Aplicar impostos a serviços
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="applyTaxToProducts"
                    {...register('taxes.applyTaxToProducts')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="applyTaxToProducts" className="ml-2 block text-sm text-gray-700">
                    Aplicar impostos a produtos
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeTaxInPrice"
                    {...register('taxes.includeTaxInPrice')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeTaxInPrice" className="ml-2 block text-sm text-gray-700">
                    Incluir impostos no preço exibido
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="displayTaxSeparately"
                    {...register('taxes.displayTaxSeparately')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="displayTaxSeparately" className="ml-2 block text-sm text-gray-700">
                    Mostrar impostos separadamente nos recibos
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Descontos */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Percent className="h-4 w-4 mr-2 text-primary-600" />
              Política de Descontos
            </h4>
            
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="enableDiscounts" className="text-sm font-medium text-gray-700 flex items-center">
                <HelpCircle className="h-4 w-4 mr-1 text-gray-400" />
                Permitir Descontos
              </label>
              <div className="tooltip">
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="enableDiscounts"
                    {...register('discounts.enableDiscounts')}
                    className="sr-only"
                  />
                  <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                  <div 
                    className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                      watch('discounts.enableDiscounts') ? 'transform translate-x-6 bg-primary-600' : ''
                    }`}
                  ></div>
                </div>
                <span className="tooltiptext">Habilitar concessão de descontos aos clientes</span>
              </div>
            </div>
            
            <div className={`space-y-4 ${!watch('discounts.enableDiscounts') ? 'opacity-50' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="tooltip">
                  <label htmlFor="maxDiscountPercentage" className="block text-sm font-medium text-gray-700 mb-1">
                    Desconto Máximo Permitido (%)
                  </label>
                  <span className="tooltiptext">Percentual máximo de desconto que pode ser aplicado</span>
                  <input
                    type="number"
                    id="maxDiscountPercentage"
                    {...register('discounts.maxDiscountPercentage', { valueAsNumber: true })}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={!watch('discounts.enableDiscounts')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  {errors.discounts?.maxDiscountPercentage && (
                    <p className="mt-1 text-sm text-red-600">{errors.discounts.maxDiscountPercentage.message}</p>
                  )}
                </div>

                <div className="tooltip">
                  <label htmlFor="requireApprovalAbove" className="block text-sm font-medium text-gray-700 mb-1">
                    Aprovação Necessária Acima de (%)
                  </label>
                  <span className="tooltiptext">Descontos acima deste percentual requerem aprovação de administrador</span>
                  <input
                    type="number"
                    id="requireApprovalAbove"
                    {...register('discounts.requireApprovalAbove', { valueAsNumber: true })}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={!watch('discounts.enableDiscounts')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  {errors.discounts?.requireApprovalAbove && (
                    <p className="mt-1 text-sm text-red-600">{errors.discounts.requireApprovalAbove.message}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="allowEmployeesToGiveDiscounts"
                  {...register('discounts.allowEmployeesToGiveDiscounts')}
                  disabled={!watch('discounts.enableDiscounts')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="allowEmployeesToGiveDiscounts" className="ml-2 block text-sm text-gray-700">
                  Permitir que barbeiros concedam descontos
                </label>
              </div>
            </div>
          </div>

          {/* Section: Comissões */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <Percent className="h-4 w-4 mr-2 text-primary-600" />
              Configurações de Comissão
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="tooltip">
                <label htmlFor="defaultServiceCommission" className="block text-sm font-medium text-gray-700 mb-1">
                  Comissão Padrão de Serviços (%)
                </label>
                <span className="tooltiptext">Percentual padrão para comissões em serviços</span>
                <input
                  type="number"
                  id="defaultServiceCommission"
                  {...register('commissions.defaultServiceCommission', { valueAsNumber: true })}
                  min="0"
                  max="100"
                  step="0.1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.commissions?.defaultServiceCommission && (
                  <p className="mt-1 text-sm text-red-600">{errors.commissions.defaultServiceCommission.message}</p>
                )}
              </div>

              <div className="tooltip">
                <label htmlFor="defaultProductCommission" className="block text-sm font-medium text-gray-700 mb-1">
                  Comissão Padrão de Produtos (%)
                </label>
                <span className="tooltiptext">Percentual padrão para comissões em produtos</span>
                <input
                  type="number"
                  id="defaultProductCommission"
                  {...register('commissions.defaultProductCommission', { valueAsNumber: true })}
                  min="0"
                  max="100"
                  step="0.1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {errors.commissions?.defaultProductCommission && (
                  <p className="mt-1 text-sm text-red-600">{errors.commissions.defaultProductCommission.message}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="payCommissionsOnCancelled"
                {...register('commissions.payCommissionsOnCancelled')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="payCommissionsOnCancelled" className="ml-2 block text-sm text-gray-700">
                Pagar comissões em agendamentos cancelados
              </label>
            </div>
            
            <div>
              <label htmlFor="commissionCalculationPeriod" className="block text-sm font-medium text-gray-700 mb-1">
                Período de Cálculo das Comissões
              </label>
              <select
                id="commissionCalculationPeriod"
                {...register('commissions.commissionCalculationPeriod')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
          </div>

          {/* Section: Recibos e Notas Fiscais */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
              <FileText className="h-4 w-4 mr-2 text-primary-600" />
              Recibos e Notas Fiscais
            </h4>
            
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="enableAutomaticReceipts" className="text-sm font-medium text-gray-700 flex items-center">
                <HelpCircle className="h-4 w-4 mr-1 text-gray-400" />
                Gerar Recibos Automaticamente
              </label>
              <div className="tooltip">
                <div className="relative inline-block w-10 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="enableAutomaticReceipts"
                    {...register('invoicing.enableAutomaticReceipts')}
                    className="sr-only"
                  />
                  <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                  <div 
                    className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                      watch('invoicing.enableAutomaticReceipts') ? 'transform translate-x-6 bg-primary-600' : ''
                    }`}
                  ></div>
                </div>
                <span className="tooltiptext">Gerar recibos automaticamente para todas as vendas</span>
              </div>
            </div>
            
            <div className={`space-y-4 ${!watch('invoicing.enableAutomaticReceipts') ? 'opacity-50' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="invoicePrefix" className="block text-sm font-medium text-gray-700 mb-1">
                    Prefixo para Numeração
                  </label>
                  <input
                    type="text"
                    id="invoicePrefix"
                    {...register('invoicing.invoicePrefix')}
                    disabled={!watch('invoicing.enableAutomaticReceipts')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="BP-"
                  />
                </div>

                <div>
                  <label htmlFor="invoiceStartNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Número Inicial
                  </label>
                  <input
                    type="number"
                    id="invoiceStartNumber"
                    {...register('invoicing.invoiceStartNumber', { valueAsNumber: true })}
                    min="1"
                    disabled={!watch('invoicing.enableAutomaticReceipts')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="1001"
                  />
                  {errors.invoicing?.invoiceStartNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.invoicing.invoiceStartNumber.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="termsAndConditions" className="block text-sm font-medium text-gray-700 mb-1">
                  Termos e Condições em Recibos
                </label>
                <textarea
                  id="termsAndConditions"
                  {...register('invoicing.termsAndConditions')}
                  rows={3}
                  disabled={!watch('invoicing.enableAutomaticReceipts')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Texto que aparecerá nos recibos..."
                ></textarea>
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