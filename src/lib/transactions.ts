import { create } from 'zustand';
import { supabase } from './supabase';
import type { Transaction } from '../types/database';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface TransactionsState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  fetchTransactionsByDateRange: (startDate: Date, endDate: Date) => Promise<void>;
  fetchTransactions: () => Promise<void>;
  createTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  fetchTransactionsByBarberId: (barberId: string, startDate?: Date, endDate?: Date) => Promise<Transaction[]>;
}

export const useTransactions = create<TransactionsState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,

  fetchTransactionsByDateRange: async (startDate: Date, endDate: Date) => {
    set({ isLoading: true, error: null });
    try {
      // Format dates to ISO strings for the query
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
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
            service:services(name),
            product:products(name),
            professional_id,
            professional:profiles!professional_id(full_name)
          )
        `)
        .gte('created_at', `${startDateStr}T00:00:00`)
        .lte('created_at', `${endDateStr}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ transactions: data || [] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erro ao carregar transações' });
      console.error('Error fetching transactions:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
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
            service:services(name),
            product:products(name),
            professional_id,
            professional:profiles!professional_id(full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ transactions: data || [] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erro ao carregar transações' });
      console.error('Error fetching transactions:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createTransaction: async (transaction) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();
      
      if (error) throw error;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erro ao criar transação' });
      console.error('Error creating transaction:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateTransaction: async (id, transaction) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('transactions')
        .update(transaction)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Transação atualizada com sucesso!');
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Erro ao atualizar transação' });
      console.error('Error updating transaction:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchTransactionsByBarberId: async (barberId: string, startDate?: Date, endDate?: Date) => {
    try {
      let query = supabase
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
            service:services(name),
            product:products(name),
            professional_id,
            professional:profiles!professional_id(full_name)
          )
        `)
        .eq('barber_id', barberId);
        
      // Add date range filters if provided
      if (startDate) {
        query = query.gte('created_at', format(startDate, 'yyyy-MM-dd'));
      }
      
      if (endDate) {
        query = query.lte('created_at', `${format(endDate, 'yyyy-MM-dd')}T23:59:59`);
      }
      
      // Order by date
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching barber transactions:', err);
      return [];
    }
  }
}));