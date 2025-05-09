import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  DollarSign, 
  CreditCard, 
  Wallet, 
  Check, 
  ArrowLeft, 
  XCircle,
  AlertTriangle,
  Receipt,
  CheckCircle
} from 'lucide-react';
import { useCashRegister, recordSaleInCashRegister } from '../../lib/cashRegisterStore';
import { useAuth } from '../../lib/auth';
import { useOrders } from '../../lib/orders';
import toast from 'react-hot-toast';

const paymentMethodSchema = z.object({
  method: z.enum(['cash', 'credit_card', 'debit_card', 'pix']),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
});

const paymentSchema = z.object({
  methods: z.array(paymentMethodSchema),
}).refine(
  data => data.methods.reduce((sum, method) => sum + method.amount, 0) > 0,
  {
    message: "O total dos pagamentos deve ser maior que zero",
    path: ["methods"]
  }
);

type PaymentFormData = z.infer<typeof paymentSchema>;

interface OrderPaymentModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function OrderPaymentModal({ order, onClose, onSuccess }: OrderPaymentModalProps) {
  const [step, setStep] = useState<'payment' | 'processing' | 'success'>('payment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [remainingAmount, setRemainingAmount] = useState<number>(Number(order.total_amount || 0));
  const [defaultPaymentAmount, setDefaultPaymentAmount] = useState<number>(Number(order.total_amount || 0));
  const [paymentMethods, setPaymentMethods] = useState<{id: string, name: string, value: string}[]>([]);
  
  const { currentRegister, processingTransactions } = useCashRegister();
  const { updateOrderStatus } = useOrders();
  const { profile } = useAuth();

  // Set up form with default values
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      methods: [
        { method: 'cash', amount: defaultPaymentAmount }
      ]
    }
  });

  // Set up field array for payment methods
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'methods'
  });

  // Watch payment methods for calculations
  const methods = watch('methods');

  // Calculate totals whenever payment methods change
  useEffect(() => {
    if (methods) {
      const total = methods.reduce((sum, method) => sum + (method.amount || 0), 0);
      setTotalPaid(total);
      setRemainingAmount(Number(order.total_amount || 0) - total);
    }
  }, [methods, order.total_amount]);

  // Update available payment methods
  useEffect(() => {
    // Get all possible payment methods
    const allMethods = [
      { id: 'cash', name: 'Dinheiro', value: 'cash' },
      { id: 'credit_card', name: 'Cartão de Crédito', value: 'credit_card' },
      { id: 'debit_card', name: 'Cartão de Débito', value: 'debit_card' },
      { id: 'pix', name: 'PIX', value: 'pix' }
    ];
    
    // Filter out methods already selected
    const usedMethods = methods.map(m => m.method);
    const availableMethods = allMethods.filter(m => !usedMethods.includes(m.value as any));
    
    setPaymentMethods(availableMethods);
  }, [methods]);

  // Add a new payment method
  const handleAddPaymentMethod = (method: 'cash' | 'credit_card' | 'debit_card' | 'pix') => {
    // Don't add if already at max methods or this method already exists
    if (fields.length >= 4 || methods.some(m => m.method === method)) {
      return;
    }
    
    append({
      method,
      amount: remainingAmount > 0 ? remainingAmount : 0
    });
  };

  // Process the payment
  const handlePayment = async (data: PaymentFormData) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!currentRegister) {
        throw new Error('Não há caixa aberto para registrar pagamento');
      }
      
      // Check if the transaction is already being processed
      if (processingTransactions && processingTransactions[order.id]) {
        throw new Error('Este pagamento já está sendo processado');
      }
      
      // Check if total paid matches order amount
      const total = data.methods.reduce((sum, method) => sum + method.amount, 0);
      if (Math.abs(total - Number(order.total_amount)) > 0.01) {
        throw new Error(`O valor total de R$ ${total.toFixed(2)} não corresponde ao valor da comanda de R$ ${Number(order.total_amount).toFixed(2)}`);
      }
      
      setStep('processing');
      
      // Update order status
      await updateOrderStatus(order.id, 'completed');
      
      // Process each payment method
      for (const payment of data.methods) {
        await recordSaleInCashRegister(
          order.id,
          payment.amount,
          payment.method,
          order.client?.full_name
        );
      }
      
      setStep('success');
      
      // Wait a bit to show success message before closing
      setTimeout(() => {
        onSuccess();
        toast.success('Pagamento processado com sucesso!');
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento');
      setStep('payment');
      setIsSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Get icon for payment method
  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Wallet className="h-5 w-5" />;
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="h-5 w-5" />;
      case 'pix':
        return <DollarSign className="h-5 w-5" />;
      default:
        return null;
    }
  };

  // Get name for payment method
  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Dinheiro';
      case 'credit_card':
        return 'Cartão de Crédito';
      case 'debit_card':
        return 'Cartão de Débito';
      case 'pix':
        return 'PIX';
      default:
        return method;
    }
  };

  // Helper to get a color for a payment method
  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'cash':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'credit_card':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'debit_card':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'pix':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Render content based on current step
  const renderStepContent = () => {
    switch (step) {
      case 'payment':
        return (
          <>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Resumo da Comanda</h3>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-gray-600">Cliente:</span>
                <span className="font-medium">{order.client?.full_name}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Itens:</span>
                <span className="font-medium">{order.items?.length || 0} item(s)</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span>{formatCurrency(Number(order.total_amount))}</span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900 mb-2 flex items-center">
                <Receipt className="h-5 w-5 mr-2 text-primary-600" />
                Formas de Pagamento
              </h3>
              
              {/* Payment methods section */}
              <form onSubmit={handleSubmit(handlePayment)} className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className={`p-3 border rounded-md ${getPaymentMethodColor(methods[index]?.method)}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        {getPaymentIcon(methods[index]?.method)}
                        <span className="ml-2 font-medium">{getPaymentMethodName(methods[index]?.method)}</span>
                      </div>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register(`methods.${index}.amount` as const, { valueAsNumber: true })}
                        className="pl-[35px] block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.methods?.[index]?.amount && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.methods[index]?.amount?.message}
                      </p>
                    )}
                  </div>
                ))}

                {/* Add payment method buttons */}
                {fields.length < 4 && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {paymentMethods.map(method => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => handleAddPaymentMethod(method.value as any)}
                        className="flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        {getPaymentIcon(method.value)}
                        <span className="ml-2">{method.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Payment summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Total da Comanda:</span>
                    <span className="font-medium">{formatCurrency(Number(order.total_amount))}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Total Pago:</span>
                    <span className={`font-medium ${totalPaid > Number(order.total_amount) ? 'text-red-600' : totalPaid === Number(order.total_amount) ? 'text-green-600' : ''}`}>
                      {formatCurrency(totalPaid)}
                    </span>
                  </div>
                  {Math.abs(remainingAmount) > 0.01 && (
                    <div className="flex justify-between text-sm font-medium">
                      <span>{remainingAmount > 0 ? 'Faltando:' : 'Troco:'}</span>
                      <span className={remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Math.abs(remainingAmount))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || Math.abs(Number(order.total_amount) - totalPaid) > 0.01}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                  >
                    Confirmar Pagamento
                  </button>
                </div>
              </form>
            </div>
          </>
        );

      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600 mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processando Pagamento</h3>
            <p className="text-gray-500 text-center">Aguarde enquanto processamos o seu pagamento...</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Pagamento Realizado</h3>
            <p className="text-gray-500 text-center mb-6">O pagamento foi processado com sucesso!</p>
            
            {/* Payment summary */}
            <div className="w-full max-w-md p-4 bg-gray-50 rounded-md mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Resumo do Pagamento</h4>
              {methods.map((method, index) => (
                <div key={index} className="flex justify-between text-sm mb-2">
                  <span>{getPaymentMethodName(method.method)}:</span>
                  <span className="font-medium">{formatCurrency(method.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 mt-2">
                <span>Total:</span>
                <span>{formatCurrency(totalPaid)}</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Fechar
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-md">
        <div className="px-6 py-4 bg-primary-50 border-b border-primary-100">
          <h3 className="text-lg font-medium text-primary-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-primary-600" />
            Pagamento de Comanda
          </h3>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}