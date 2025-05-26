import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCashRegisterStore } from '../../lib/cashRegisterStore';
import { useAuth } from '../../lib/auth';
import { 
  XCircle, 
  AlertTriangle, 
  Lock, 
  FileText, 
  ArrowLeft,
  CreditCard,
  DollarSign,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// Define form schema with validation rules
const cancelPaymentSchema = z.object({
  supervisor_password: z.string().min(4, 'Senha do supervisor é obrigatória'),
  cancellation_reason: z.string().min(10, 'O motivo precisa ter pelo menos 10 caracteres'),
  issue_receipt: z.boolean().default(true),
});

type CancelPaymentFormData = z.infer<typeof cancelPaymentSchema>;

interface CancelPaymentModalProps {
  transaction: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelPaymentModal({ transaction, onClose, onSuccess }: CancelPaymentModalProps) {
  const [step, setStep] = useState<'confirm' | 'password' | 'processing' | 'success'>('confirm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { profile } = useAuth();
  const { cancelPayment } = useCashRegisterStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelPaymentFormData>({
    resolver: zodResolver(cancelPaymentSchema),
    defaultValues: {
      supervisor_password: '',
      cancellation_reason: '',
      issue_receipt: true
    }
  });

  // Get current date and time formatted
  const currentDateTime = new Date().toLocaleString('pt-BR');
  
  // Get payment method display name
  const getPaymentMethodName = (method: string): string => {
    const methods: Record<string, string> = {
      'cash': 'Dinheiro',
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'pix': 'PIX'
    };
    
    return methods[method] || method;
  };

  // Handle form submission
  const onSubmit = async (data: CancelPaymentFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate supervisor password (in a real app, this would be a server call)
      // For demo purposes, we'll use a dummy password
      if (data.supervisor_password !== "1234") {
        throw new Error("Senha do supervisor incorreta");
      }
      
      setStep('processing');
      
      // Call the cancelPayment function from the store
      await cancelPayment({
        transaction_id: transaction.id,
        cancellation_reason: data.cancellation_reason,
        supervisor_id: profile?.id || '',
        issue_receipt: data.issue_receipt
      });
      
      setStep('success');
      
      // Notify success after a brief pause
      setTimeout(() => {
        onSuccess();
        toast.success('Pagamento cancelado com sucesso!');
      }, 2000);
      
    } catch (error) {
      setIsSubmitting(false);
      setError(error instanceof Error ? error.message : 'Erro ao processar cancelamento');
      setStep('password');
    }
  };
  
  // Render different steps
  const renderStep = () => {
    switch (step) {
      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Atenção</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      Você está prestes a cancelar um pagamento. Esta operação:
                    </p>
                    <ul className="list-disc pl-5 mt-1">
                      <li>Requer autorização de supervisor</li>
                      <li>Não pode ser desfeita</li>
                      <li>Será registrada no log do sistema</li>
                      <li>Estornará o valor para o método de pagamento original</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 border border-gray-200 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Detalhes do Pagamento</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID:</span>
                  <span className="font-medium">{transaction.id.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data:</span>
                  <span className="font-medium">{new Date(transaction.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor:</span>
                  <span className="font-medium text-red-600">R$ {Number(transaction.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Forma de Pagamento:</span>
                  <span className="font-medium">{getPaymentMethodName(transaction.payment_method)}</span>
                </div>
                {transaction.client_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cliente:</span>
                    <span className="font-medium">{transaction.client_name}</span>
                  </div>
                )}
              </div>
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
                type="button"
                onClick={() => setStep('password')}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Prosseguir com Cancelamento
              </button>
            </div>
          </div>
        );
        
      case 'password':
        return (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="supervisor-password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha do Supervisor
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="supervisor-password"
                  {...register('supervisor_password')}
                  className="h-10 block w-full pl-[35px] border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Digite a senha de autorização"
                  autoComplete="off"
                />
              </div>
              {errors.supervisor_password && (
                <p className="mt-1 text-sm text-red-600">{errors.supervisor_password.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Solicite ao supervisor que digite a senha de autorização para prosseguir.
              </p>
            </div>
            
            <div>
              <label htmlFor="cancellation-reason" className="block text-sm font-medium text-gray-700 mb-1">
                Motivo do Cancelamento
              </label>
              <textarea
                id="cancellation-reason"
                {...register('cancellation_reason')}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Detalhe o motivo do cancelamento deste pagamento..."
              />
              {errors.cancellation_reason && (
                <p className="mt-1 text-sm text-red-600">{errors.cancellation_reason.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Este texto será registrado no histórico de auditoria do sistema.
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                id="issue-receipt"
                type="checkbox"
                {...register('issue_receipt')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="issue-receipt" className="ml-2 block text-sm text-gray-900">
                Emitir comprovante de cancelamento
              </label>
            </div>
            
            <div className="flex justify-between space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Processando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </form>
        );
        
      case 'processing':
        return (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              <h3 className="text-lg font-medium text-gray-900">Processando Cancelamento</h3>
              <p className="text-sm text-gray-500">
                Estamos processando o cancelamento do pagamento e o estorno para o método de pagamento original.
              </p>
            </div>
          </div>
        );
        
      case 'success':
        return (
          <div className="py-6 space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-medium text-gray-900">Cancelamento Concluído</h3>
              <p className="text-center text-sm text-gray-500 max-w-md">
                O pagamento foi cancelado com sucesso e o valor estornado para a forma de pagamento original.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Detalhes do Cancelamento</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Data/Hora:</span>
                  <span className="font-medium">{currentDateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Operador:</span>
                  <span className="font-medium">{profile?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Forma de Estorno:</span>
                  <span className="font-medium">{getPaymentMethodName(transaction.payment_method)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor Estornado:</span>
                  <span className="font-medium text-red-600">R$ {Number(transaction.amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                Fechar
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-md">
        <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center">
          <XCircle className="h-6 w-6 text-red-500 mr-2" />
          <h3 className="text-lg font-medium text-red-800">
            Cancelamento de Pagamento
          </h3>
        </div>
        
        <div className="p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}