import React, { useState, useEffect } from 'react';
import { useOrders } from '../../lib/orders';
import { useProfiles } from '../../lib/profiles';
import { useAuth } from '../../lib/auth';
import { Receipt, Plus, Trash2, CheckCircle, XCircle, Edit2, Crown, User, DollarSign } from 'lucide-react';
import { OrderForm } from './OrderForm';
import { OrderPaymentModal } from './OrderPaymentModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Transaction } from '../../types/database';
import toast from 'react-hot-toast';

export function OrderList() {
  const { orders, isLoading, error, fetchOrders, fetchOrdersByClient, fetchOrdersByBarber, updateOrderStatus } = useOrders();
  const { barbers, fetchBarbers } = useProfiles();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Transaction | null>(null);
  const [payingOrder, setPayingOrder] = useState<Transaction | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    
    // Carregar dados dos barbeiros para exibição dos profissionais
    fetchBarbers();

    // Carregar comandas de acordo com o papel do usuário
    if (profile.role === 'client') {
      fetchOrdersByClient(profile.id);
    } else if (profile.role === 'barber') {
      fetchOrdersByBarber(profile.id);
    } else {
      fetchOrders();
    }
  }, [profile, fetchOrders, fetchOrdersByClient, fetchOrdersByBarber, fetchBarbers]);

  const handleStatusUpdate = async (orderId: string, status: 'open' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      await updateOrderStatus(orderId, status);
      toast.success(`Status atualizado para ${
        status === 'open' ? 'Aberto' : 
        status === 'in_progress' ? 'Em Andamento' : 
        status === 'completed' ? 'Concluído' : 
        'Cancelado'
      }`);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handlePayOrder = (order: Transaction) => {
    setPayingOrder(order);
  };

  const handleOrderFormClose = () => {
    setIsFormOpen(false);
    setEditingOrder(null);
    // Recarregar dados após fechar formulário
    if (profile?.role === 'client') {
      fetchOrdersByClient(profile.id);
    } else if (profile?.role === 'barber') {
      fetchOrdersByBarber(profile.id);
    } else {
      fetchOrders();
    }
  };

  const handlePaymentSuccess = () => {
    setPayingOrder(null);
    // Reload orders after payment
    fetchOrders();
  };

  // Group professionals by service
  const getProfessionalsByService = (order: any) => {
    const professionalMap: Record<string, string[]> = {};
    
    if (!order.items) return {};
    
    // Organize by service_id
    order.items.forEach((item: any) => {
      if (item.service_id && item.professional_id) {
        if (!professionalMap[item.service_id]) {
          professionalMap[item.service_id] = [];
        }
        
        const professionalName = getProfessionalName(item.professional_id);
        if (professionalName && !professionalMap[item.service_id].includes(professionalName)) {
          professionalMap[item.service_id].push(professionalName);
        }
      }
      
      // Também organizamos por product_id agora
      if (item.product_id && item.professional_id) {
        if (!professionalMap[item.product_id]) {
          professionalMap[item.product_id] = [];
        }
        
        const professionalName = getProfessionalName(item.professional_id);
        if (professionalName && !professionalMap[item.product_id].includes(professionalName)) {
          professionalMap[item.product_id].push(professionalName);
        }
      }
    });
    
    return professionalMap;
  };
  
  // Get professional name from ID
  const getProfessionalName = (professionalId: string) => {
    // Procura o profissional diretamente entre os barbeiros carregados
    const barber = barbers.find(b => b.id === professionalId);
    if (barber) return barber.full_name;
    
    // Se não encontrar entre os barbeiros, procura em todas as ordens
    if (!orders) return null;
    
    // Look in all orders' professionals
    for (const order of orders) {
      if (order.barber && order.barber.id === professionalId) {
        return order.barber.full_name;
      }
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Comandas</h2>
        {(profile?.role === 'barber' || profile?.role === 'admin') && (
          <button
            onClick={() => setIsFormOpen(true)}
            title="Criar nova comanda"
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Comanda
          </button>
        )}
      </div>

      {(isFormOpen || editingOrder) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingOrder ? 'Editar Comanda' : 'Nova Comanda'}
            </h3>
            <OrderForm
              initialData={editingOrder || undefined}
              onClose={handleOrderFormClose}
            />
          </div>
        </div>
      )}

      {payingOrder && (
        <OrderPaymentModal
          order={payingOrder}
          onClose={() => setPayingOrder(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {orders.length === 0 ? (
            <li className="py-4 text-center text-gray-500">
              Nenhuma comanda encontrada
            </li>
          ) : (
            orders.map((order) => {
              // Get professionals mapped to services/products for this order
              const professionalsByItem = getProfessionalsByService(order);
              
              return (
                <li key={order.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Receipt className="h-5 w-5 text-primary-600" />
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          Comanda #{order.id.substring(0, 8)}
                        </h3>
                        <div className="mt-1 text-sm text-gray-500">
                          <p>Cliente: {order.client?.full_name || 'Cliente não encontrado'}</p>
                          <p>Data: {format(new Date(order.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                          <p>Total: R$ {Number(order.total_amount).toFixed(2)}</p>
                          {order.is_monthly_billing && (
                            <p className="text-blue-600 font-medium">Faturamento Mensal</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {order.status === 'open'
                          ? 'Aberta'
                          : order.status === 'in_progress'
                          ? 'Em Andamento'
                          : order.status === 'completed'
                          ? 'Concluída'
                          : 'Cancelada'}
                      </span>
                      {(profile?.role === 'barber' || profile?.role === 'admin') && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingOrder(order)}
                            title="Editar esta comanda"
                            className="text-primary-600 hover:text-primary-900"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          {order.status === 'open' && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, 'in_progress')}
                              title="Marcar comanda como em andamento"
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                          )}
                          {(order.status === 'open' || order.status === 'in_progress') && (
                            <>
                              <button
                                onClick={() => handlePayOrder(order)}
                                title="Pagamento da comanda"
                                className="text-green-600 hover:text-green-900"
                              >
                                <DollarSign className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                                title="Cancelar esta comanda"
                                className="text-red-600 hover:text-red-900"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900">Itens:</h4>
                    <ul className="mt-2 divide-y divide-gray-200">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => (
                          <li key={item.id} className="py-2">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <div className="flex items-center">
                                  <span className="text-sm text-gray-900">
                                    {item.quantity}x {item.service?.name || item.product?.name || 'Item desconhecido'}
                                  </span>
                                  {item.is_loyalty_service && (
                                    <span className="ml-2 flex items-center text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 px-2 py-1">
                                      <Crown className="h-3 w-3 mr-1" /> 
                                      Plano
                                    </span>
                                  )}
                                </div>
                                {/* Professional info for this item */}
                                {item.professional_id ? (
                                  <div className="text-xs text-gray-500 flex items-center mt-1">
                                    <User className="h-3 w-3 mr-1" />
                                    {item.professional?.full_name || getProfessionalName(item.professional_id) || "Profissional não encontrado"}
                                  </div>
                                ) : (
                                  <div className="text-xs text-red-500 flex items-center mt-1">
                                    <User className="h-3 w-3 mr-1" />
                                    Sem profissional atribuído
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center">
                                <span className={`text-sm font-medium ${item.is_loyalty_service ? 'text-indigo-500' : 'text-gray-900'}`}>
                                  {item.is_loyalty_service 
                                    ? 'Incluso no plano' 
                                    : `R$ ${Number(item.total_price).toFixed(2)}`}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="py-2 text-center text-gray-500">
                          Nenhum item na comanda
                        </li>
                      )}
                    </ul>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}