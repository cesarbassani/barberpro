import { create } from 'zustand';
import { supabase } from './supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface CashRegisterState {
  dailyTotal: number;
  pendingMonthlyTotal: number;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  openedAt: Date | null;
  fetchDailyTotal: (date: Date) => Promise<void>;
  fetchPendingMonthlyTotal: () => Promise<void>;
  openCashRegister: () => Promise<void>;
  closeCashRegister: (date: Date) => Promise<void>;
  processPayment: (orderId: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => Promise<void>;
}

export const useCashRegister = create<CashRegisterState>((set, get) => ({
  dailyTotal: 0,
  pendingMonthlyTotal: 0,
  isLoading: false,
  error: null,
  isOpen: false,
  openedAt: null,

  fetchDailyTotal: async (date: Date) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .rpc('calculate_daily_cash_register_total', {
          closing_date: format(date, 'yyyy-MM-dd')
        });

      if (error) throw error;
      set({ dailyTotal: data || 0 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar total diário';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPendingMonthlyTotal: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .rpc('calculate_pending_monthly_billings');

      if (error) throw error;
      set({ pendingMonthlyTotal: data || 0 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar total mensal pendente';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  openCashRegister: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check if there's any unclosed cash register from today
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: unclosedData, error: unclosedError } = await supabase
        .from('transactions')
        .select('id')
        .eq('is_cash_register_closed', false)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .limit(1);

      if (unclosedError) throw unclosedError;

      if (unclosedData && unclosedData.length > 0) {
        throw new Error('Existe um caixa aberto que precisa ser fechado primeiro');
      }

      set({ isOpen: true, openedAt: new Date() });
      toast.success('Caixa aberto com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao abrir caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  closeCashRegister: async (date: Date) => {
    set({ isLoading: true, error: null });
    try {
      if (!get().isOpen) {
        throw new Error('O caixa precisa estar aberto para ser fechado');
      }

      const { error } = await supabase
        .rpc('close_cash_register', {
          closing_date: format(date, 'yyyy-MM-dd')
        });

      if (error) throw error;
      
      const fetchDailyTotal = get().fetchDailyTotal;
      const fetchPendingMonthlyTotal = get().fetchPendingMonthlyTotal;
      
      await fetchDailyTotal(date);
      await fetchPendingMonthlyTotal();
      
      set({ isOpen: false, openedAt: null });
      toast.success('Caixa fechado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fechar caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  processPayment: async (orderId: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => {
    set({ isLoading: true, error: null });
    try {
      if (!get().isOpen) {
        throw new Error('O caixa precisa estar aberto para processar pagamentos');
      }

      // Update transaction status and payment method
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          payment_method: paymentMethod,
          payment_status: 'completed',
          status: 'completed'
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Refresh totals
      const today = new Date();
      const fetchDailyTotal = get().fetchDailyTotal;
      const fetchPendingMonthlyTotal = get().fetchPendingMonthlyTotal;
      
      await fetchDailyTotal(today);
      await fetchPendingMonthlyTotal();

      toast.success('Pagamento processado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar pagamento';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err; // Re-throw to handle in the component
    } finally {
      set({ isLoading: false });
    }
  },
}));