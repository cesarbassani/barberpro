import { create } from 'zustand';
import { supabase } from './supabase';
import toast from 'react-hot-toast';
import { format, startOfDay, endOfDay, isAfter, isBefore, set, isToday } from 'date-fns';
import { useAuth } from './auth';

// Types
export type CashRegisterStatus = 'open' | 'closed' | 'auto_closed';
export type CashOperationType = 'open' | 'close' | 'sale' | 'payment' | 'withdrawal' | 'deposit' | 'refund';
export type TransactionCategory = 'sale' | 'payment' | 'withdrawal' | 'deposit' | 'adjustment' | 'refund';

export interface CashRegister {
  id: string;
  opening_employee_id: string;
  closing_employee_id?: string;
  opened_at: string;
  closed_at?: string;
  initial_amount: number;
  final_amount?: number;
  expected_amount?: number;
  difference_amount?: number;
  notes?: string;
  status: CashRegisterStatus;
  next_day_amount: number;
  created_at: string;
  opening_employee?: {
    full_name: string;
  };
  closing_employee?: {
    full_name: string;
  };
}

export interface CashTransaction {
  id: string;
  cash_register_id: string;
  employee_id: string;
  amount: number;
  operation_type: CashOperationType;
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix';
  description?: string;
  reference_id?: string;
  category: TransactionCategory;
  created_at: string;
  employee?: {
    full_name: string;
  };
  client_name?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  supervisor_id?: string; // ID of the supervisor who approved the cancellation
}

export interface CashMovement {
  date: string;
  description: string;
  category: TransactionCategory;
  amount: number;
  type: 'in' | 'out';
  payment_method: string;
  client_name?: string;
}

export interface CashBalance {
  cash: number;
  creditCard: number;
  debitCard: number;
  pix: number;
  total: number;
}

export interface CloseCashData {
  countedCash: number;
  nextDayAmount: number;
  notes: string;
}

interface CashEditData extends CloseCashData {
  id: string;
}

export interface RefundPaymentData {
  transaction_id: string;
  cancellation_reason: string;
  supervisor_id: string;
  issue_receipt: boolean;
}

interface CashRegisterState {
  currentRegister: CashRegister | null;
  previousRegisters: CashRegister[];
  transactions: CashTransaction[];
  isLoading: boolean;
  error: string | null;
  currentBalance: CashBalance;
  movements: CashMovement[];
  isSubmitting: boolean;
  processingTransactions: Record<string, boolean>; // Track transactions in progress to prevent double-clicks
  
  // Actions
  fetchCurrentRegister: () => Promise<void>;
  openCashRegister: (initialAmount: number) => Promise<void>;
  closeCashRegister: (data: CloseCashData) => Promise<void>;
  editCashRegister: (data: CashEditData) => Promise<void>;
  createRetroactiveTransaction: (registerId: string, data: any) => Promise<void>;
  autoCloseCashRegister: () => Promise<boolean>;
  checkAndAutoCloseCashRegister: () => Promise<void>;
  addDeposit: (amount: number, description: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => Promise<void>;
  addWithdrawal: (amount: number, description: string) => Promise<void>;
  fetchCashRegisterHistory: (startDate?: Date, endDate?: Date) => Promise<void>;
  fetchTransactionsByRegisterId: (registerId: string) => Promise<void>;
  calculateDailyBalance: (date?: Date) => Promise<CashBalance>;
  fetchCashMovements: (registerId: string) => Promise<void>;
  getOperatorName: (profileId: string) => string;
  cancelPayment: (data: RefundPaymentData) => Promise<void>;
  calculateRegisterBalance: (registerId: string) => Promise<CashBalance>;
}

export const useCashRegister = create<CashRegisterState>((set, get) => ({
  currentRegister: null,
  previousRegisters: [],
  transactions: [],
  isLoading: false,
  error: null,
  currentBalance: { cash: 0, creditCard: 0, debitCard: 0, pix: 0, total: 0 },
  movements: [],
  isSubmitting: false,
  processingTransactions: {},

  fetchCurrentRegister: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check if there's an open cash register
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          opening_employee:profiles!opening_employee_id(full_name),
          closing_employee:profiles!closing_employee_id(full_name)
        `)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        set({ currentRegister: data[0] });
        
        // Fetch transactions for this register
        await get().fetchTransactionsByRegisterId(data[0].id);
        
        // Calculate current balance
        const balance = await get().calculateRegisterBalance(data[0].id);
        set({ currentBalance: balance });
        
        // Fetch movements
        await get().fetchCashMovements(data[0].id);
      } else {
        set({ currentRegister: null });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar caixa atual';
      set({ error: errorMessage });
      console.error('Error fetching current register:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  openCashRegister: async (initialAmount: number) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      // Check if there's already an open register
      const { data: checkData, error: checkError } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open');

      if (checkError) throw checkError;
      if (checkData && checkData.length > 0) {
        throw new Error('Já existe um caixa aberto. Feche-o antes de abrir um novo.');
      }
      
      // Get user ID from auth context
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // Create a new cash register
      const { data, error } = await supabase
        .from('cash_registers')
        .insert([
          {
            opening_employee_id: user.id,
            initial_amount: initialAmount,
            status: 'open'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Also record an opening transaction
      const { error: transactionError } = await supabase
        .from('cash_register_transactions')
        .insert([
          {
            cash_register_id: data.id,
            employee_id: user.id,
            amount: initialAmount,
            operation_type: 'open',
            payment_method: 'cash',
            description: 'Abertura de caixa',
            category: 'deposit'
          }
        ]);

      if (transactionError) throw transactionError;

      // Refresh current register data
      await get().fetchCurrentRegister();
      
      toast.success('Caixa aberto com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao abrir caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  closeCashRegister: async ({ countedCash, nextDayAmount, notes }) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      const currentRegister = get().currentRegister;
      if (!currentRegister) throw new Error('Não há caixa aberto para fechar');

      // Get user ID from auth context
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // Calculate expected amount
      const balance = await get().calculateRegisterBalance(currentRegister.id);
      const expectedAmount = balance.cash;
      const differenceAmount = countedCash - expectedAmount;

      // Close the register
      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          closing_employee_id: user.id,
          closed_at: new Date().toISOString(),
          final_amount: countedCash,
          expected_amount: expectedAmount,
          difference_amount: differenceAmount,
          next_day_amount: nextDayAmount,
          notes: notes
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      // Record a closing transaction
      const { error: transactionError } = await supabase
        .from('cash_register_transactions')
        .insert([
          {
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount: countedCash,
            operation_type: 'close',
            payment_method: 'cash',
            description: 'Fechamento de caixa',
            category: 'adjustment'
          }
        ]);

      if (transactionError) throw transactionError;

      // Refresh current register data
      set({ currentRegister: null });
      await get().fetchCashRegisterHistory();

      toast.success('Caixa fechado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fechar caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  editCashRegister: async ({ id, countedCash, nextDayAmount, notes }) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      // Get user ID from auth context
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // Get register data to calculate difference
      const { data: registerData, error: fetchError } = await supabase
        .from('cash_registers')
        .select('expected_amount')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      
      const expectedAmount = registerData?.expected_amount || 0;
      const differenceAmount = countedCash - expectedAmount;

      // Update the register
      const { error } = await supabase
        .from('cash_registers')
        .update({
          final_amount: countedCash,
          difference_amount: differenceAmount,
          next_day_amount: nextDayAmount,
          notes: notes
        })
        .eq('id', id);

      if (error) throw error;

      // Refresh history data
      await get().fetchCashRegisterHistory();

      toast.success('Registro de caixa atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao editar registro de caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  createRetroactiveTransaction: async (registerId, data) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      // Get user ID from auth context
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // Add transaction
      const { error } = await supabase
        .from('cash_register_transactions')
        .insert([
          {
            cash_register_id: registerId,
            employee_id: user.id,
            amount: data.amount,
            operation_type: data.operation_type,
            payment_method: data.payment_method,
            description: data.description || `Lançamento retroativo - ${data.operation_type}`,
            category: data.category,
            created_at: data.transaction_date || new Date().toISOString(),
            client_name: data.client_name
          }
        ]);

      if (error) throw error;

      // Recalculate register balance
      const { data: registerData } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('id', registerId)
        .single();

      if (registerData && registerData.status === 'closed') {
        // Calculate new expected amount
        const balance = await get().calculateRegisterBalance(registerId);
        const expectedAmount = balance.cash;
        const differenceAmount = registerData.final_amount - expectedAmount;

        // Update the register with new expected amount
        await supabase
          .from('cash_registers')
          .update({
            expected_amount: expectedAmount,
            difference_amount: differenceAmount
          })
          .eq('id', registerId);
      }

      // Refresh transaction data
      await get().fetchTransactionsByRegisterId(registerId);

      toast.success('Lançamento retroativo registrado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar lançamento retroativo';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  cancelPayment: async (data) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // First get the transaction to cancel
      const { data: transaction, error: fetchError } = await supabase
        .from('cash_register_transactions')
        .select('*')
        .eq('id', data.transaction_id)
        .single();

      if (fetchError) throw fetchError;
      if (!transaction) throw new Error('Transação não encontrada');

      // Get current register
      const { data: currentRegister, error: registerError } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .single();

      if (registerError && registerError.code !== 'PGRST116') {
        throw registerError;
      }

      if (!currentRegister) {
        throw new Error('É necessário um caixa aberto para processar o cancelamento');
      }

      // Create a refund transaction
      const refundData = {
        cash_register_id: currentRegister.id,
        employee_id: user.id,
        amount: transaction.amount,
        operation_type: 'refund',
        payment_method: transaction.payment_method,
        description: `Cancelamento: ${transaction.description || 'Transação '+ transaction.id.substring(0, 8)}`,
        category: 'refund',
        reference_id: transaction.id,
        cancellation_reason: data.cancellation_reason,
        supervisor_id: data.supervisor_id,
        client_name: transaction.client_name
      };

      const { error: refundError } = await supabase
        .from('cash_register_transactions')
        .insert([refundData]);

      if (refundError) throw refundError;

      // In a real implementation, we would also handle payment processor refunds here
      // For example, for credit card refunds, we would call the payment processor's API

      // Refresh current register data
      await get().fetchCurrentRegister();

      toast.success('Pagamento cancelado e estornado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar cancelamento';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  autoCloseCashRegister: async () => {
    // Auto-closing has been disabled as per the requirement
    return false;
  },

  checkAndAutoCloseCashRegister: async () => {
    // Auto-closing has been disabled as per the requirement
    // This function now does nothing
    return;
  },

  addDeposit: async (amount, description, paymentMethod) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      const currentRegister = get().currentRegister;
      if (!currentRegister) throw new Error('Não há caixa aberto para registrar depósito');

      // Get user ID from auth context
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // Add deposit transaction
      const { error } = await supabase
        .from('cash_register_transactions')
        .insert([
          {
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount: amount,
            operation_type: 'deposit',
            payment_method: paymentMethod,
            description: description || 'Suprimento de caixa',
            category: 'deposit'
          }
        ]);

      if (error) throw error;

      // Refresh current register data
      await get().fetchCurrentRegister();
      
      toast.success('Suprimento registrado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar suprimento';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  addWithdrawal: async (amount, description) => {
    set({ isLoading: true, error: null, isSubmitting: true });
    try {
      const currentRegister = get().currentRegister;
      if (!currentRegister) throw new Error('Não há caixa aberto para registrar sangria');

      // Get user ID from auth context
      const { user } = useAuth.getState();
      if (!user) throw new Error('Usuário não autenticado');

      // Check if there's enough cash
      const balance = await get().calculateRegisterBalance(currentRegister.id);
      if (balance.cash < amount) {
        throw new Error(`Saldo em dinheiro insuficiente para realizar sangria. Disponível: R$ ${balance.cash.toFixed(2)}`);
      }

      // Add withdrawal transaction
      const { error } = await supabase
        .from('cash_register_transactions')
        .insert([
          {
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount: amount,
            operation_type: 'withdrawal',
            payment_method: 'cash', // Withdrawals are always cash
            description: description || 'Sangria de caixa',
            category: 'withdrawal'
          }
        ]);

      if (error) throw error;

      // Refresh current register data
      await get().fetchCurrentRegister();
      
      toast.success('Sangria registrada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar sangria';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false, isSubmitting: false });
    }
  },

  fetchCashRegisterHistory: async (startDate, endDate) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('cash_registers')
        .select(`
          *,
          opening_employee:profiles!opening_employee_id(full_name),
          closing_employee:profiles!closing_employee_id(full_name)
        `)
        .order('opened_at', { ascending: false });

      // Add date filters if provided
      if (startDate) {
        query = query.gte('opened_at', startOfDay(startDate).toISOString());
      }
      
      if (endDate) {
        query = query.lte('opened_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      set({ previousRegisters: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar histórico de caixa';
      set({ error: errorMessage });
      console.error('Error fetching cash register history:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTransactionsByRegisterId: async (registerId) => {
    set({ isLoading: true, error: null });
    try {
      // First get transactions with employee info
      const { data, error } = await supabase
        .from('cash_register_transactions')
        .select(`
          *,
          employee:profiles!employee_id(full_name)
        `)
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Get client names for transactions with reference_id (linked to orders/transactions)
      const transactionsWithClientInfo = await Promise.all((data || []).map(async (transaction) => {
        // Only find client info for sales and payments
        if (['sale', 'payment'].includes(transaction.operation_type) && transaction.reference_id) {
          const { data: orderData } = await supabase
            .from('transactions')
            .select(`
              client_id,
              client:clients!client_id(full_name)
            `)
            .eq('id', transaction.reference_id)
            .maybeSingle();
            
          if (orderData?.client?.full_name) {
            return {
              ...transaction,
              client_name: orderData.client.full_name
            };
          }
        }
        return transaction;
      }));

      set({ transactions: transactionsWithClientInfo || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar transações';
      set({ error: errorMessage });
      console.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  calculateRegisterBalance: async (registerId) => {
    try {
      // Get all transactions for this register
      const { data, error } = await supabase
        .from('cash_register_transactions')
        .select('*')
        .eq('cash_register_id', registerId);

      if (error) throw error;

      let cash = 0;
      let creditCard = 0;
      let debitCard = 0;
      let pix = 0;

      // Get initial amount from register
      const { data: registerData, error: registerError } = await supabase
        .from('cash_registers')
        .select('initial_amount')
        .eq('id', registerId)
        .single();

      if (registerError) throw registerError;
      
      // Initial amount is always cash
      cash += Number(registerData.initial_amount || 0);

      // Calculate balance for each payment method
      data?.forEach(transaction => {
        const amount = Number(transaction.amount);
        
        // Determine if this is an inflow or outflow transaction
        const isInflow = ['open', 'sale', 'deposit'].includes(transaction.operation_type);
        const isOutflow = ['close', 'payment', 'withdrawal', 'refund'].includes(transaction.operation_type);
        
        // Skip the opening transaction as we've already accounted for it
        if (transaction.operation_type === 'open') return;
        
        // Apply amount to appropriate balance
        if (transaction.payment_method === 'cash') {
          cash += isInflow ? amount : -amount;
        } else if (transaction.payment_method === 'credit_card') {
          creditCard += isInflow ? amount : -amount;
        } else if (transaction.payment_method === 'debit_card') {
          debitCard += isInflow ? amount : -amount;
        } else if (transaction.payment_method === 'pix') {
          pix += isInflow ? amount : -amount;
        }
      });

      const balance = {
        cash,
        creditCard,
        debitCard,
        pix,
        total: cash + creditCard + debitCard + pix
      };

      return balance;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao calcular saldo';
      console.error('Error calculating balance:', errorMessage);
      throw err;
    }
  },

  calculateDailyBalance: async (date = new Date()) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Get all transactions for the day
      const { data, error } = await supabase
        .from('cash_register_transactions')
        .select(`
          *,
          cash_register:cash_registers(opened_at)
        `)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`);

      if (error) throw error;

      let cash = 0;
      let creditCard = 0;
      let debitCard = 0;
      let pix = 0;

      // Calculate balance for each payment method
      data?.forEach(transaction => {
        const amount = Number(transaction.amount);
        
        // Determine if this is an inflow or outflow transaction
        const isInflow = ['sale', 'deposit'].includes(transaction.operation_type);
        const isOutflow = ['payment', 'withdrawal', 'refund'].includes(transaction.operation_type);
        
        // Skip open/close transactions for daily balance
        if (['open', 'close'].includes(transaction.operation_type)) return;
        
        // Apply amount to appropriate balance
        if (transaction.payment_method === 'cash') {
          cash += isInflow ? amount : -amount;
        } else if (transaction.payment_method === 'credit_card') {
          creditCard += isInflow ? amount : -amount;
        } else if (transaction.payment_method === 'debit_card') {
          debitCard += isInflow ? amount : -amount;
        } else if (transaction.payment_method === 'pix') {
          pix += isInflow ? amount : -amount;
        }
      });

      const balance = {
        cash,
        creditCard,
        debitCard,
        pix,
        total: cash + creditCard + debitCard + pix
      };

      return balance;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao calcular saldo do dia';
      console.error('Error calculating daily balance:', errorMessage);
      throw err;
    }
  },

  fetchCashMovements: async (registerId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('cash_register_transactions')
        .select(`
          *,
          employee:profiles!employee_id(full_name)
        `)
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get client names for transactions with reference_id (linked to orders/transactions)
      const transactionsWithClientInfo = await Promise.all((data || []).map(async (transaction) => {
        // Only find client info for sales and payments
        if (['sale', 'payment'].includes(transaction.operation_type) && transaction.reference_id) {
          try {
            const { data: orderData } = await supabase
              .from('transactions')
              .select(`
                client_id,
                client:clients!client_id(full_name)
              `)
              .eq('id', transaction.reference_id)
              .maybeSingle();
              
            if (orderData?.client?.full_name) {
              return {
                ...transaction,
                client_name: orderData.client.full_name
              };
            }
          } catch (err) {
            console.error('Error fetching client info:', err);
          }
        }
        return transaction;
      }));

      const movements: CashMovement[] = (transactionsWithClientInfo || []).map(transaction => {
        const isInflow = ['open', 'sale', 'deposit'].includes(transaction.operation_type);
        return {
          date: format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm'),
          description: transaction.description || getOperationDescription(transaction.operation_type),
          category: transaction.category,
          amount: Number(transaction.amount),
          type: isInflow ? 'in' : 'out',
          payment_method: getPaymentMethodLabel(transaction.payment_method),
          client_name: transaction.client_name
        };
      });

      set({ movements: movements });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar movimentações';
      set({ error: errorMessage });
      console.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  getOperatorName: (profileId) => {
    // Find the profile in the current transactions
    const { transactions } = get();
    const transaction = Array.isArray(transactions) ? transactions.find(t => t.employee_id === profileId) : undefined;
    return transaction?.employee?.full_name || 'Operador desconhecido';
  }
}));

// Helper functions
function getOperationDescription(operationType: CashOperationType): string {
  switch (operationType) {
    case 'sale': return 'Venda';
    case 'payment': return 'Pagamento';
    case 'withdrawal': return 'Sangria';
    case 'deposit': return 'Suprimento';
    case 'open': return 'Abertura de Caixa';
    case 'close': return 'Fechamento de Caixa';
    case 'refund': return 'Estorno/Cancelamento';
    default: return 'Operação';
  }
}

function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Dinheiro';
    case 'credit_card': return 'Cartão de crédito';
    case 'debit_card': return 'Cartão de débito';
    case 'pix': return 'PIX';
    default: return method;
  }
}

// Function to connect sales to cash register
export async function recordSaleInCashRegister(
  transactionId: string, 
  amount: number, 
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix',
  clientName?: string
) {
  const cashRegisterStore = useCashRegister.getState();
  
  // Check if transaction is already processing to prevent double submission
  if (cashRegisterStore.processingTransactions[transactionId]) {
    toast.error('Esta transação já está sendo processada');
    return false;
  }
  
  // Mark transaction as processing
  cashRegisterStore.processingTransactions[transactionId] = true;
  
  try {
    // Get current user
    const { user } = useAuth.getState();
    if (!user) throw new Error('Usuário não autenticado');

    // Check if there's an open cash register
    const { data: registerData } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!registerData || registerData.length === 0) {
      throw new Error('Não há caixa aberto para registrar a venda');
    }

    const registerId = registerData[0].id;

    // Get client name if not provided
    let clientNameToUse = clientName;
    if (!clientNameToUse) {
      const { data: orderData } = await supabase
        .from('transactions')
        .select(`
          client:clients!client_id(full_name)
        `)
        .eq('id', transactionId)
        .maybeSingle();
        
      if (orderData?.client?.full_name) {
        clientNameToUse = orderData.client.full_name;
      }
    }

    // Record transaction in cash register
    const { error } = await supabase
      .from('cash_register_transactions')
      .insert([
        {
          cash_register_id: registerId,
          employee_id: user.id,
          amount,
          operation_type: 'sale',
          payment_method: paymentMethod,
          description: clientNameToUse ? `Venda para ${clientNameToUse}` : `Venda #${transactionId.substring(0, 8)}`,
          reference_id: transactionId,
          category: 'sale'
        }
      ]);

    if (error) throw error;
    
    // Reload cash register data
    await cashRegisterStore.fetchCurrentRegister();
    
    return true;
  } catch (error) {
    console.error('Error recording sale in cash register:', error);
    return false;
  } finally {
    // Remove transaction from processing list
    const processingTransactions = {...cashRegisterStore.processingTransactions};
    delete processingTransactions[transactionId];
    cashRegisterStore.processingTransactions = processingTransactions;
  }
}