import { create } from 'zustand';
import { supabase, checkSupabaseConnection, withRetry } from './supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type InventoryTransactionType = 'purchase' | 'sale' | 'adjustment' | 'return' | 'transfer' | 'loss';
export type AdjustmentReasonCode = 'damaged' | 'expired' | 'lost' | 'found' | 'correction' | 'other';
export type ProductCondition = 'damaged' | 'unopened' | 'expired' | 'wrong_item' | 'other';
export type QualityControlStatus = 'passed' | 'failed' | 'pending';

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  expiration_date: string | null;
  manufacturing_date: string | null;
  purchase_date: string | null;
  cost_price: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  product?: {
    name: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

export interface InventoryAdjustment {
  id: string;
  product_id: string;
  quantity: number;
  reason_code: AdjustmentReasonCode;
  notes: string | null;
  created_by: string;
  transaction_id: string;
  created_at: string;
  product?: {
    name: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

export interface QualityControl {
  id: string;
  product_id: string;
  batch_id: string | null;
  status: QualityControlStatus;
  inspection_date: string;
  inspector_id: string;
  notes: string | null;
  action_taken: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
  };
  inspector?: {
    full_name: string;
  };
  batch?: ProductBatch;
}

export interface ReturnedItem {
  id: string;
  product_id: string;
  transaction_id: string | null;
  quantity: number;
  reason: string;
  condition: ProductCondition;
  action_taken: string;
  returned_to_stock: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

export interface BelowReorderPoint {
  product_id: string;
  product_name: string;
  current_stock: number;
  reorder_point: number;
  last_restock_date: string | null;
}

export interface InventoryTurnover {
  product_id: string;
  product_name: string;
  beginning_inventory: number;
  ending_inventory: number;
  sales_quantity: number;
  turnover_rate: number;
}

interface InventoryState {
  batches: ProductBatch[];
  transactions: InventoryTransaction[];
  adjustments: InventoryAdjustment[];
  qualityControls: QualityControl[];
  returnedItems: ReturnedItem[];
  belowReorderPoint: BelowReorderPoint[];
  inventoryTurnover: InventoryTurnover[];
  inventoryValue: number;
  isLoading: boolean;
  error: string | null;

  fetchBatches: (productId?: string) => Promise<void>;
  createBatch: (batch: Omit<ProductBatch, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateBatch: (id: string, batch: Partial<ProductBatch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  
  fetchTransactions: (productId?: string, limit?: number) => Promise<void>;
  recordTransaction: (
    productId: string,
    transactionType: InventoryTransactionType,
    quantity: number,
    notes?: string,
    referenceId?: string
  ) => Promise<string>;
  
  fetchAdjustments: (productId?: string) => Promise<void>;
  createAdjustment: (
    productId: string, 
    quantity: number, 
    reasonCode: AdjustmentReasonCode, 
    notes?: string
  ) => Promise<void>;
  
  fetchQualityControls: (productId?: string) => Promise<void>;
  createQualityControl: (qualityControl: Omit<QualityControl, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateQualityControl: (id: string, qualityControl: Partial<QualityControl>) => Promise<void>;
  
  fetchReturnedItems: (productId?: string) => Promise<void>;
  createReturnedItem: (returnedItem: Omit<ReturnedItem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  processReturn: (
    returnedItem: Omit<ReturnedItem, 'id' | 'created_at' | 'updated_at' | 'returned_to_stock'>,
    returnToStock: boolean
  ) => Promise<void>;
  
  fetchProductsBelowReorderPoint: () => Promise<void>;
  fetchInventoryTurnover: (startDate: Date, endDate: Date) => Promise<void>;
  calculateInventoryValue: () => Promise<void>;

  isStockAvailable: (productId: string, quantity: number) => Promise<boolean>;
  getProductAvailableStock: (productId: string) => Promise<number>;
}

export const useInventory = create<InventoryState>((set, get) => ({
  batches: [],
  transactions: [],
  adjustments: [],
  qualityControls: [],
  returnedItems: [],
  belowReorderPoint: [],
  inventoryTurnover: [],
  inventoryValue: 0,
  isLoading: false,
  error: null,

  fetchBatches: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      let query = supabase
        .from('product_batches')
        .select(`
          *,
          product:products(name)
        `)
        .order('expiration_date', { ascending: true, nullsLast: true });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await withRetry(() => query, 5, 1000);

      if (error) throw error;
      set({ batches: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar lotes';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err; // Re-throw to allow handling by the component
    } finally {
      set({ isLoading: false });
    }
  },

  createBatch: async (batch) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(() => supabase
        .from('product_batches')
        .insert([batch])
        .select());

      if (error) throw error;

      // Record transaction for the added stock
      await get().recordTransaction(
        batch.product_id,
        'purchase',
        batch.quantity,
        `Lote ${batch.batch_number} adicionado ao estoque`
      );

      toast.success('Lote criado com sucesso!');
      await get().fetchBatches(batch.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar lote';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  updateBatch: async (id, batch) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      // Get original batch
      const { data: originalBatch, error: fetchError } = await supabase
        .from('product_batches')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update batch
      const { error } = await withRetry(() => supabase
        .from('product_batches')
        .update(batch)
        .eq('id', id));

      if (error) throw error;

      // If quantity changed, record transaction
      if (batch.quantity !== undefined && originalBatch && batch.quantity !== originalBatch.quantity) {
        const quantityDifference = batch.quantity - originalBatch.quantity;
        const transactionType = quantityDifference > 0 ? 'adjustment' : 'adjustment';
        const quantity = Math.abs(quantityDifference);
        
        await get().recordTransaction(
          originalBatch.product_id,
          transactionType,
          quantity,
          `Ajuste de quantidade no lote ${originalBatch.batch_number}`
        );
      }

      toast.success('Lote atualizado com sucesso!');
      await get().fetchBatches(originalBatch?.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar lote';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteBatch: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      // Get batch details first
      const { data: batch, error: fetchError } = await supabase
        .from('product_batches')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Delete batch
      const { error } = await withRetry(() => supabase
        .from('product_batches')
        .delete()
        .eq('id', id));

      if (error) throw error;

      // Record transaction for the removed stock
      if (batch) {
        await get().recordTransaction(
          batch.product_id,
          'adjustment',
          -batch.quantity,
          `Lote ${batch.batch_number} removido do estoque`
        );
      }

      toast.success('Lote excluído com sucesso!');
      await get().fetchBatches(batch?.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir lote';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTransactions: async (productId, limit = 100) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      let query = supabase
        .from('inventory_transactions')
        .select(`
          *,
          product:products(name),
          created_by_profile:profiles!created_by(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await withRetry(() => query, 5, 2000); // More retries with longer delay

      if (error) throw error;
      set({ transactions: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar transações';
      set({ error: errorMessage });
      console.error('Error fetching transactions:', err);
      // Don't show toast here as it might be called multiple times
    } finally {
      set({ isLoading: false });
    }
  },

  recordTransaction: async (productId, transactionType, quantity, notes, referenceId) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      // Call function to record transaction
      const { data, error } = await withRetry(() => supabase
        .rpc('record_inventory_transaction', {
          p_product_id: productId,
          p_transaction_type: transactionType,
          p_quantity: quantity,
          p_reference_id: referenceId || null,
          p_notes: notes || null
        }));

      if (error) throw error;

      // Return transaction ID
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar transação de inventário';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAdjustments: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      let query = supabase
        .from('inventory_adjustments')
        .select(`
          *,
          product:products(name),
          created_by_profile:profiles!created_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await withRetry(() => query);

      if (error) throw error;
      set({ adjustments: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar ajustes de estoque';
      set({ error: errorMessage });
      console.error('Error fetching adjustments:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createAdjustment: async (productId, quantity, reasonCode, notes) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      // First record the transaction
      const transactionId = await get().recordTransaction(
        productId,
        'adjustment',
        quantity,
        `Ajuste de estoque: ${reasonCode}`
      );

      // Get the user session before using it in the insert operation
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Create adjustment record
      const { error } = await withRetry(() => supabase
        .from('inventory_adjustments')
        .insert([{
          product_id: productId,
          quantity,
          reason_code: reasonCode,
          notes,
          created_by: userId,
          transaction_id: transactionId
        }]));

      if (error) throw error;

      toast.success('Ajuste de estoque registrado com sucesso!');
      await get().fetchAdjustments(productId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar ajuste de estoque';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchQualityControls: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      let query = supabase
        .from('quality_control')
        .select(`
          *,
          product:products(name),
          inspector:profiles!inspector_id(full_name),
          batch:product_batches(*)
        `)
        .order('inspection_date', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await withRetry(() => query);

      if (error) throw error;
      set({ qualityControls: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar registros de controle de qualidade';
      set({ error: errorMessage });
      console.error('Error fetching quality controls:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createQualityControl: async (qualityControl) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { error } = await withRetry(() => supabase
        .from('quality_control')
        .insert([qualityControl]));

      if (error) throw error;

      // If the status is 'failed', we might need to adjust inventory
      if (qualityControl.status === 'failed' && qualityControl.action_taken === 'remove_from_inventory') {
        // Get the quantity from the batch if provided
        let quantityToRemove = 0;
        
        if (qualityControl.batch_id) {
          const { data: batch } = await supabase
            .from('product_batches')
            .select('quantity')
            .eq('id', qualityControl.batch_id)
            .single();
            
          if (batch) {
            quantityToRemove = batch.quantity;
          }
        }
        
        // If no batch or couldn't get quantity, use a default value
        if (quantityToRemove <= 0) {
          quantityToRemove = 1;
        }
        
        // Record inventory adjustment
        await get().createAdjustment(
          qualityControl.product_id,
          -quantityToRemove,
          'damaged',
          `Produto falhou no controle de qualidade em ${format(new Date(), 'dd/MM/yyyy')}`
        );
      }

      toast.success('Registro de controle de qualidade criado com sucesso!');
      await get().fetchQualityControls(qualityControl.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar registro de controle de qualidade';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  updateQualityControl: async (id, qualityControl) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { error } = await withRetry(() => supabase
        .from('quality_control')
        .update(qualityControl)
        .eq('id', id));

      if (error) throw error;

      toast.success('Registro de controle de qualidade atualizado com sucesso!');
      await get().fetchQualityControls(qualityControl.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar registro de controle de qualidade';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchReturnedItems: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      let query = supabase
        .from('returned_items')
        .select(`
          *,
          product:products(name),
          created_by_profile:profiles!created_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await withRetry(() => query);

      if (error) throw error;
      set({ returnedItems: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar registros de itens devolvidos';
      set({ error: errorMessage });
      console.error('Error fetching returned items:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createReturnedItem: async (returnedItem) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { error } = await withRetry(() => supabase
        .from('returned_items')
        .insert([returnedItem]));

      if (error) throw error;

      toast.success('Item devolvido registrado com sucesso!');
      await get().fetchReturnedItems(returnedItem.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar item devolvido';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  processReturn: async (returnedItem, returnToStock) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      // Get the user session before using it in the insert operation
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Create returned item record
      const { data: newReturnedItem, error } = await withRetry(() => supabase
        .from('returned_items')
        .insert([{
          ...returnedItem,
          returned_to_stock: returnToStock,
          created_by: userId
        }])
        .select()
        .single());

      if (error) throw error;

      // If returning to stock, record transaction
      if (returnToStock) {
        await get().recordTransaction(
          returnedItem.product_id,
          'return',
          returnedItem.quantity,
          `Devolução: ${returnedItem.reason}`,
          newReturnedItem.id
        );
      }

      toast.success('Devolução processada com sucesso!');
      await get().fetchReturnedItems(returnedItem.product_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar devolução';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchProductsBelowReorderPoint: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(() => supabase
        .rpc('get_products_below_reorder_point'));

      if (error) throw error;
      set({ belowReorderPoint: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar produtos abaixo do ponto de reabastecimento';
      set({ error: errorMessage });
      console.error('Error fetching products below reorder point:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchInventoryTurnover: async (startDate, endDate) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(() => supabase
        .rpc('calculate_inventory_turnover', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }));

      if (error) throw error;
      set({ inventoryTurnover: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao calcular giro de estoque';
      set({ error: errorMessage });
      console.error('Error calculating inventory turnover:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  calculateInventoryValue: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(() => supabase
        .rpc('calculate_inventory_value'));

      if (error) throw error;
      set({ inventoryValue: data || 0 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao calcular valor do inventário';
      set({ error: errorMessage });
      console.error('Error calculating inventory value:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  isStockAvailable: async (productId, quantity) => {
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(() => supabase
        .rpc('is_stock_available', {
          p_product_id: productId,
          p_quantity: quantity
        }));

      if (error) throw error;
      return !!data;
    } catch (err) {
      console.error('Error checking stock availability:', err);
      return false;
    }
  },

  getProductAvailableStock: async (productId) => {
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(() => supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single());

      if (error) throw error;
      return data?.stock_quantity || 0;
    } catch (err) {
      console.error('Error getting available stock:', err);
      return 0;
    }
  }
}));