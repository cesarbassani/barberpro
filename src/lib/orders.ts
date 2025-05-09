import { create } from 'zustand';
import { supabase, checkSupabaseConnection, withRetry } from './supabase';
import type { Transaction, TransactionItem } from '../../types/database';
import toast from 'react-hot-toast';
import { useLoyalty } from './loyalty';

interface OrdersState {
  orders: (Transaction & {
    client?: { full_name: string } | null;
    barber?: { full_name: string } | null;
    items: Array<TransactionItem & {
      service?: { name: string } | null;
      product?: { name: string } | null;
      is_loyalty_service?: boolean;
      subscription_id?: string | null;
      professional_id?: string | null;
      professional?: { full_name: string } | null;
    }>;
  })[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  fetchOrdersByClient: (clientId: string) => Promise<void>;
  fetchOrdersByBarber: (barberId: string) => Promise<void>;
  createOrder: (data: {
    client_id: string;
    barber_id?: string | null;
    is_monthly_billing: boolean;
    items: {
      service_id?: string | null;
      product_id?: string | null;
      quantity: number;
      unit_price: number;
      is_loyalty_service?: boolean;
      subscription_id?: string | null;
      professional_id?: string | null;
    }[];
  }) => Promise<void>;
  updateOrder: (orderId: string, data: {
    client_id: string;
    barber_id?: string | null;
    is_monthly_billing: boolean;
    items: {
      service_id?: string | null;
      product_id?: string | null;
      quantity: number;
      unit_price: number;
      is_loyalty_service?: boolean;
      subscription_id?: string | null;
      professional_id?: string | null;
    }[];
  }) => Promise<void>;
  updateOrderStatus: (orderId: string, status: 'open' | 'in_progress' | 'completed' | 'cancelled') => Promise<void>;
}

export const useOrders = create<OrdersState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check if browser is online
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Navegador está offline. Verifique sua conexão com a internet.');
      }
      
      // Check database connection
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      const { data, error } = await withRetry(() => supabase
        .from('transactions')
        .select(`
          *,
          client:clients(*),
          barber:profiles!barber_id(*),
          items:order_items(
            id,
            service_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            is_loyalty_service,
            subscription_id,
            professional_id,
            professional:profiles!professional_id(full_name),
            service:services(name),
            product:products(name)
          )
        `)
        .order('created_at', { ascending: false }));

      if (error) throw error;
      
      set({ orders: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar comandas';
      set({ error: errorMessage });
      console.error('Error fetching orders:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOrdersByClient: async (clientId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      const { data, error } = await withRetry(() => supabase
        .from('transactions')
        .select(`
          *,
          client:clients(*),
          barber:profiles!barber_id(*),
          items:order_items(
            id,
            service_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            is_loyalty_service,
            subscription_id,
            professional_id,
            professional:profiles!professional_id(full_name),
            service:services(name),
            product:products(name)
          )
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }));

      if (error) throw error;
      
      set({ orders: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar comandas';
      set({ error: errorMessage });
      console.error('Error fetching client orders:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOrdersByBarber: async (barberId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      const { data, error } = await withRetry(() => supabase
        .from('transactions')
        .select(`
          *,
          client:clients(*),
          barber:profiles!barber_id(*),
          items:order_items(
            id,
            service_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            is_loyalty_service,
            subscription_id,
            professional_id,
            professional:profiles!professional_id(full_name),
            service:services(name),
            product:products(name)
          )
        `)
        .eq('barber_id', barberId)
        .order('created_at', { ascending: false }));

      if (error) throw error;
      
      set({ orders: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar comandas';
      set({ error: errorMessage });
      console.error('Error fetching barber orders:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createOrder: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }
      
      // Validar cliente
      console.log('Criando comanda com cliente_id:', data.client_id);
      if (!data.client_id) {
        throw new Error('Cliente não selecionado');
      }

      // Validate items
      if (!data.items || data.items.length === 0) {
        throw new Error('A comanda precisa ter pelo menos um item');
      }

      // Validate each item has either service_id or product_id and professional_id
      for (const item of data.items) {
        if (!item.service_id && !item.product_id) {
          throw new Error('Cada item precisa ser um serviço ou produto');
        }
        if (!item.professional_id) {
          throw new Error('Cada item precisa ter um profissional atribuído');
        }
      }

      console.log("Dados para criação de comanda:", JSON.stringify(data, null, 2));

      // Create transaction
      const { data: order, error: orderError } = await withRetry(() => supabase
        .from('transactions')
        .insert([{
          client_id: data.client_id,
          barber_id: data.barber_id || null,
          payment_method: 'cash', // Default to cash
          payment_status: 'pending',
          status: 'open',
          is_monthly_billing: data.is_monthly_billing,
          total_amount: 0, // Will be updated by trigger
          commission_amount: 0 // Will be updated by trigger
        }])
        .select()
        .single());

      if (orderError) {
        console.error('Erro ao criar transação:', orderError);
        throw orderError;
      }
      
      if (!order) throw new Error('Erro ao criar comanda');

      console.log("Transação criada com sucesso:", order.id);

      // Insert order items
      const orderItems = data.items.map(item => ({
        transaction_id: order.id,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        is_loyalty_service: item.is_loyalty_service || false,
        subscription_id: item.subscription_id || null,
        professional_id: item.professional_id || null
      }));

      console.log("Itens para inserção:", JSON.stringify(orderItems, null, 2));

      const { error: itemsError } = await withRetry(() => supabase
        .from('order_items')
        .insert(orderItems));

      if (itemsError) {
        // If items insertion fails, delete the transaction
        console.error('Error inserting order items:', itemsError);
        await supabase
          .from('transactions')
          .delete()
          .eq('id', order.id);
        throw itemsError;
      }

      console.log("Itens inseridos com sucesso");

      // Record service usage for loyalty plan if applicable
      const { useServiceFromPlan } = useLoyalty.getState();
      
      for (const item of data.items) {
        if (item.is_loyalty_service && item.service_id && item.subscription_id) {
          try {
            await useServiceFromPlan(item.subscription_id, item.service_id, order.id);
            console.log("Uso de serviço de fidelidade registrado");
          } catch (error) {
            console.error('Error recording service usage:', error);
          }
        }
      }

      await get().fetchOrders();
      toast.success('Comanda criada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar comanda';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('Error creating order:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateOrder: async (orderId, data) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }
      
      // Validar cliente
      console.log('Atualizando comanda com cliente_id:', data.client_id);
      if (!data.client_id) {
        throw new Error('Cliente não selecionado');
      }

      // Validate items
      if (!data.items || data.items.length === 0) {
        throw new Error('A comanda precisa ter pelo menos um item');
      }

      // Validate each item has either service_id or product_id and professional_id
      for (const item of data.items) {
        if (!item.service_id && !item.product_id) {
          throw new Error('Cada item precisa ser um serviço ou produto');
        }
        if (!item.professional_id) {
          throw new Error('Cada item precisa ter um profissional atribuído');
        }
      }

      console.log("Atualizando comanda, dados:", JSON.stringify(data, null, 2));

      // Update transaction
      const { error: orderError } = await withRetry(() => supabase
        .from('transactions')
        .update({
          barber_id: data.barber_id,
          is_monthly_billing: data.is_monthly_billing,
        })
        .eq('id', orderId));

      if (orderError) {
        console.error("Erro ao atualizar transação:", orderError);
        throw orderError;
      }

      console.log("Transação atualizada com sucesso");
      
      // Criar itens formatados para inserção
      const orderItems = data.items.map(item => ({
        transaction_id: orderId,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        is_loyalty_service: item.is_loyalty_service || false,
        subscription_id: item.subscription_id || null,
        professional_id: item.professional_id || null
      }));

      console.log("Itens formatados para inserção:", JSON.stringify(orderItems, null, 2));

      // Delete existing items
      const { error: deleteError } = await withRetry(() => supabase
        .from('order_items')
        .delete()
        .eq('transaction_id', orderId));

      if (deleteError) {
        console.error("Erro ao excluir itens existentes:", deleteError);
        throw deleteError;
      }
      
      console.log("Itens antigos removidos com sucesso");

      // Wait a moment to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Insert new items
      const { error: itemsError } = await withRetry(() => supabase
        .from('order_items')
        .insert(orderItems));

      if (itemsError) {
        console.error("Erro ao inserir novos itens:", itemsError);
        throw itemsError;
      }

      console.log("Novos itens inseridos com sucesso");
      
      // Update service usage for loyalty plan if applicable
      const { useServiceFromPlan } = useLoyalty.getState();
      
      // First, delete any existing usage records for this transaction
      try {
        await withRetry(() => supabase
          .from('loyalty_service_usage')
          .delete()
          .eq('transaction_id', orderId));
          
        console.log("Registros de uso de serviço anteriores removidos");
      } catch (error) {
        console.error('Erro ao excluir registros de uso de serviços:', error);
      }
      
      // Wait a moment to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Then record new usage
      for (const item of data.items) {
        if (item.is_loyalty_service && item.service_id && item.subscription_id) {
          try {
            await useServiceFromPlan(item.subscription_id, item.service_id, orderId);
            console.log("Uso de serviço de fidelidade registrado com sucesso");
          } catch (error) {
            console.error('Erro ao registrar uso de serviço:', error);
          }
        }
      }

      await get().fetchOrders();
      console.log("Comanda atualizada com sucesso");
      toast.success('Comanda atualizada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar comanda';
      console.error("Erro detalhado:", err);
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally { 
      set({ isLoading: false });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      const { error } = await withRetry(() => supabase
        .from('transactions')
        .update({ status })
        .eq('id', orderId));

      if (error) throw error;

      await get().fetchOrders();
      toast.success('Status atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar status';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('Error updating order status:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
}));