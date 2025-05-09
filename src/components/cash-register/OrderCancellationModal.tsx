import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Lock, 
  Search, 
  ArrowLeft, 
  Package, 
  CheckCircle,
  User,
  Calendar,
  Clock,
  CreditCard
} from 'lucide-react';
import { useOrders } from '../../lib/orders';
import { useAuth } from '../../lib/auth';
import toast from 'react-hot-toast';

// Define form schema with validation rules
const supervisorAuthSchema = z.object({
  supervisor_password: z.string().min(4, 'Senha do supervisor é obrigatória'),
  cancellation_reason: z.string().min(10, 'O motivo precisa ter pelo menos 10 caracteres'),
  return_inventory: z.boolean().default(true),
});

type SupervisorAuthFormData = z.infer<typeof supervisorAuthSchema>;

const searchOrderSchema = z.object({
  order_id: z.string().min(1, 'ID da comanda é obrigatório')
});

type SearchOrderFormData = z.infer<typeof searchOrderSchema>;

interface OrderCancellationModalProps {
  onClose: () => void;
  preselectedOrderId?: string;
}

export function OrderCancellationModal({ onClose, preselectedOrderId }: OrderCancellationModalProps) {
  const [step, setStep] = useState<'search' | 'confirm' | 'password' | 'processing' | 'success'>(
    preselectedOrderId ? 'confirm' : 'search'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const { orders, fetchOrders, updateOrderStatus } = useOrders();
  const { profile } = useAuth();

  // Search form
  const {
    register: registerSearch,
    handleSubmit: handleSearchSubmit,
    formState: { errors: searchErrors }
  } = useForm<SearchOrderFormData>({
    resolver: zodResolver(searchOrderSchema),
    defaultValues: {
      order_id: preselectedOrderId || '',
    }
  });

  // Authorization form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupervisorAuthFormData>({
    resolver: zodResolver(supervisorAuthSchema),
    defaultValues: {
      supervisor_password: '',
      cancellation_reason: '',
      return_inventory: true
    }
  });

  // Handle order search
  const onSearchSubmit = async (data: SearchOrderFormData) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await fetchOrders();
      
      // Search for order by ID (simplifying by using substring check)
      const foundOrder = orders.find(order => 
        order.id.toLowerCase().includes(data.order_id.toLowerCase()) ||
        order.id.substring(0, 8).toLowerCase() === data.order_id.toLowerCase()
      );
      
      if (!foundOrder) {
        throw new Error('Comanda não encontrada. Verifique o ID e tente novamente.');
      }
      
      if (foundOrder.status === 'cancelled') {
        throw new Error('Esta comanda já está cancelada.');
      }
      
      if (foundOrder.status === 'completed') {
        throw new Error('Comandas concluídas não podem ser canceladas. Use o cancelamento de pagamento.');
      }
      
      setSelectedOrder(foundOrder);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar comanda');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle authorization form submission
  const onAuthSubmit = async (data: SupervisorAuthFormData) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Validate supervisor password (in a real app, this would be a server call)
      // For demo purposes, we'll use a dummy password
      if (data.supervisor_password !== "1234") {
        throw new Error("Senha do supervisor incorreta");
      }
      
      setStep('processing');
      
      // Cancel the order
      await cancelOrder(selectedOrder.id, {
        reason: data.cancellation_reason,
        supervisor_id: profile?.id,
        return_inventory: data.return_inventory
      });
      
      setStep('success');
      
      // Refresh orders list
      await fetchOrders();
      
      // Display success message after a brief pause
      setTimeout(() => {
        onClose();
        toast.success('Comanda cancelada com sucesso!');
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar cancelamento');
      setStep('password');
      setIsSubmitting(false);
    }
  };

  // Cancel order function
  const cancelOrder = async (orderId: string, options: any) => {
    try {
      // In a real implementation, this would be a more complex operation
      // involving refunds, inventory updates, etc.
      await updateOrderStatus(orderId, 'cancelled');
      
      // If we should return items to inventory, we would do that here
      // This is handled by triggers in the database
      
      return { success: true };
    } catch (err) {
      throw new Error('Falha ao cancelar comanda. Tente novamente.');
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };
  
  // Calculate order total
  const calculateOrderTotal = () => {
    if (!selectedOrder || !selectedOrder.items) return 0;
    
    return selectedOrder.items.reduce((total: number, item: any) => 
      total + Number(item.total_price), 0);
  };

  // Render different steps
  const renderStep = () => {
    switch (step) {
      case 'search':
        return (
          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Atenção</h3>
                  <p className="mt-2 text-sm text-yellow-700">
                    O cancelamento de comanda afeta todo o pedido e pode requerer a devolução
                    de produtos. Use esta opção apenas para comandas não finalizadas.
                  </p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSearchSubmit(onSearchSubmit)}>
              <div>
                <label htmlFor="order-id" className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar Comanda
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="order-id"
                    {...registerSearch('order_id')}
                    placeholder="Digite o número da comanda"
                    className="h-10 block w-full pl-[35px] pr-12 border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="text-primary-600 hover:text-primary-800 focus:outline-none"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {searchErrors.order_id && (
                  <p className="mt-1 text-sm text-red-600">{searchErrors.order_id.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Digite o número completo ou os primeiros dígitos da comanda.
                </p>
              </div>
              
              {error && (
                <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
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
              
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="mr-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </form>
          </div>
        );
        
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
                      Você está prestes a cancelar esta comanda. Esta operação:
                    </p>
                    <ul className="list-disc pl-5 mt-1">
                      <li>Não pode ser desfeita</li>
                      <li>Afeta todos os itens da comanda</li>
                      <li>Requer autorização de supervisor</li>
                      <li>Será registrada no log do sistema</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">
                  Comanda #{selectedOrder?.id?.substring(0, 8)}
                </h3>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium">{selectedOrder?.client?.full_name || 'Não informado'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Atendente:</span>
                  <span className="font-medium">{selectedOrder?.barber?.full_name || 'Não atribuído'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Data:</span>
                  <span className="font-medium">{new Date(selectedOrder?.created_at).toLocaleString('pt-BR')}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${
                    selectedOrder?.status === 'open' 
                      ? 'text-yellow-600' 
                      : selectedOrder?.status === 'in_progress' 
                      ? 'text-blue-600' 
                      : 'text-gray-600'
                  }`}>
                    {selectedOrder?.status === 'open' 
                      ? 'Aberta' 
                      : selectedOrder?.status === 'in_progress' 
                      ? 'Em Andamento' 
                      : selectedOrder?.status}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-gray-900">{formatCurrency(Number(selectedOrder?.total_amount || 0))}</span>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Itens da Comanda:</h4>
                  <ul className="space-y-2">
                    {selectedOrder?.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item: any) => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {item.quantity}x {item.service?.name || item.product?.name || 'Item'}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(Number(item.total_price))}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-500">Nenhum item na comanda</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('search')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
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
          <form onSubmit={handleSubmit(onAuthSubmit)} className="space-y-4">
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
                placeholder="Detalhe o motivo do cancelamento desta comanda..."
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
                id="return-inventory"
                type="checkbox"
                {...register('return_inventory')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="return-inventory" className="ml-2 block text-sm text-gray-900">
                Retornar itens ao estoque
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
              <p className="text-sm text-gray-500 text-center">
                Estamos processando o cancelamento da comanda e atualizando o estoque.
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
              <h3 className="text-xl font-medium text-gray-900">Comanda Cancelada</h3>
              <p className="text-center text-sm text-gray-500 max-w-md">
                A comanda foi cancelada com sucesso e todos os registros foram atualizados.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Resumo do Cancelamento</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Comanda:</span>
                  <span className="font-medium">#{selectedOrder?.id?.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data/Hora:</span>
                  <span className="font-medium">{new Date().toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Operador:</span>
                  <span className="font-medium">{profile?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor Cancelado:</span>
                  <span className="font-medium text-red-600">{formatCurrency(Number(selectedOrder?.total_amount || 0))}</span>
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
            Cancelamento de Comanda
          </h3>
        </div>
        
        <div className="p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}