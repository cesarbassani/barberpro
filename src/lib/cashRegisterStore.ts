import { create } from 'zustand';
import { supabase, withRetry } from './supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Tipos para o estado do caixa
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
  status: 'open' | 'closed' | 'auto_closed';
  next_day_amount: number;
  created_at: string;
  opening_employee?: { full_name: string };
  closing_employee?: { full_name: string };
}

export interface CashTransaction {
  id: string;
  cash_register_id: string;
  employee_id: string;
  amount: number;
  operation_type: 'open' | 'close' | 'sale' | 'payment' | 'withdrawal' | 'deposit' | 'refund';
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix';
  description?: string;
  reference_id?: string;
  category: 'sale' | 'payment' | 'withdrawal' | 'deposit' | 'refund' | 'adjustment';
  created_at: string;
  employee?: { full_name: string };
  client_name?: string;
}

export interface CashMovement {
  category: string;
  amount: number;
}

export interface CashBalance {
  cash: number;
  creditCard: number;
  debitCard: number;
  pix: number;
  total: number;
}

interface CashRegisterState {
  currentRegister: CashRegister | null;
  previousRegisters: CashRegister[];
  transactions: CashTransaction[];
  movements: CashMovement[];
  currentBalance: CashBalance | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  processingTransactions: Record<string, boolean> | null;
  
  // Funções
  fetchCurrentRegister: () => Promise<void>;
  fetchCashRegisterHistory: (startDate?: Date, endDate?: Date) => Promise<void>;
  fetchTransactionsByRegisterId: (registerId: string) => Promise<void>;
  openCashRegister: (initialAmount: number, notes?: string) => Promise<void>;
  closeCashRegister: (data: { countedCash: number; nextDayAmount: number; notes?: string }) => Promise<void>;
  editCashRegister: (data: { id: string; countedCash: number; nextDayAmount: number; notes?: string }) => Promise<void>;
  addDeposit: (amount: number, description: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => Promise<void>;
  addWithdrawal: (amount: number, description: string) => Promise<void>;
  cancelPayment: (data: { transaction_id: string; cancellation_reason: string; supervisor_id: string; issue_receipt: boolean }) => Promise<void>;
  createRetroactiveTransaction: (registerId: string, data: any) => Promise<void>;
  calculateDailyBalance: (date: Date) => Promise<CashBalance>;
  getOperatorName: (operatorId: string) => string;
}

export const useCashRegisterStore = create<CashRegisterState>((set, get) => ({
  currentRegister: null,
  previousRegisters: [],
  transactions: [],
  movements: [],
  currentBalance: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  processingTransactions: null,

  fetchCurrentRegister: async () => {
    set({ isLoading: true, error: null });
    try {
      // Buscar o caixa atual (aberto)
      const { data: registers, error: registersError } = await withRetry(() =>
        supabase
          .from('cash_registers')
          .select(`
            *,
            opening_employee:profiles!opening_employee_id(full_name),
            closing_employee:profiles!closing_employee_id(full_name)
          `)
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
      );

      if (registersError) throw registersError;

      const currentRegister = registers && registers.length > 0 ? registers[0] : null;
      
      set({ currentRegister });

      // Se tiver um caixa aberto, buscar as transações
      if (currentRegister) {
        // Buscar transações do caixa atual
        const { data: transactions, error: transactionsError } = await withRetry(() =>
          supabase
            .from('cash_register_transactions')
            .select(`
              *,
              employee:profiles!employee_id(full_name)
            `)
            .eq('cash_register_id', currentRegister.id)
            .order('created_at', { ascending: false })
        );

        if (transactionsError) {
          console.error('Erro ao buscar transações:', transactionsError);
          throw transactionsError;
        }
        
        console.log('Transactions from cash_register_transactions:', transactions);
        
        // Calcular saldo atual
        const balance = calculateBalance(transactions || []);
        
        // Calcular movimentos por categoria
        const movements = calculateMovements(transactions || []);
        
        set({ 
          transactions: transactions || [],
          currentBalance: balance,
          movements
        });
      } else {
        set({ 
          transactions: [],
          currentBalance: null,
          movements: []
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar caixa';
      set({ error: errorMessage });
      console.error('Error fetching cash register:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCashRegisterHistory: async (startDate?: Date, endDate?: Date) => {
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

      // Aplicar filtros de data se fornecidos
      if (startDate) {
        query = query.gte('opened_at', startDate.toISOString());
      }
      
      if (endDate) {
        query = query.lte('opened_at', endDate.toISOString());
      }

      const { data, error } = await withRetry(() => query);

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

  fetchTransactionsByRegisterId: async (registerId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .select(`
            *,
            employee:profiles!employee_id(full_name)
          `)
          .eq('cash_register_id', registerId)
          .order('created_at', { ascending: true })
      );

      if (error) throw error;
      set({ transactions: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar transações';
      set({ error: errorMessage });
      console.error('Error fetching transactions:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  openCashRegister: async (initialAmount: number, notes?: string) => {
    set({ isSubmitting: true, error: null });
    try {
      // Verificar se já existe um caixa aberto
      const { data: openRegisters, error: checkError } = await withRetry(() =>
        supabase
          .from('cash_registers')
          .select('id')
          .eq('status', 'open')
      );

      if (checkError) throw checkError;

      if (openRegisters && openRegisters.length > 0) {
        throw new Error('Já existe um caixa aberto. Feche o caixa atual antes de abrir um novo.');
      }

      // Get user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Criar novo caixa
      const { data: register, error: registerError } = await withRetry(() =>
        supabase
          .from('cash_registers')
          .insert({
            opening_employee_id: user.id,
            initial_amount: initialAmount,
            notes,
            status: 'open'
          })
          .select()
          .single()
      );

      if (registerError) throw registerError;

      // Registrar transação de abertura
      const { error: transactionError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .insert({
            cash_register_id: register.id,
            employee_id: user.id,
            amount: initialAmount,
            operation_type: 'open',
            payment_method: 'cash',
            description: 'Abertura de caixa',
            category: 'deposit'
          })
      );

      if (transactionError) throw transactionError;

      // Atualizar estado
      await get().fetchCurrentRegister();
      toast.success('Caixa aberto com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao abrir caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  closeCashRegister: async (data: { countedCash: number; nextDayAmount: number; notes?: string }) => {
    set({ isSubmitting: true, error: null });
    try {
      const { currentRegister, currentBalance } = get();
      
      if (!currentRegister) {
        throw new Error('Não há caixa aberto para fechar');
      }

      if (!currentBalance) {
        throw new Error('Não foi possível calcular o saldo atual');
      }

      // Get user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Calcular diferença
      const expectedAmount = currentBalance.cash;
      const differenceAmount = data.countedCash - expectedAmount;

      // Fechar caixa
      const { error: updateError } = await withRetry(() =>
        supabase
          .from('cash_registers')
          .update({
            closing_employee_id: user.id,
            closed_at: new Date().toISOString(),
            final_amount: data.countedCash,
            expected_amount: expectedAmount,
            difference_amount: differenceAmount,
            next_day_amount: data.nextDayAmount,
            notes: data.notes,
            status: 'closed'
          })
          .eq('id', currentRegister.id)
      );

      if (updateError) throw updateError;

      // Registrar transação de fechamento
      const { error: transactionError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .insert({
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount: data.countedCash,
            operation_type: 'close',
            payment_method: 'cash',
            description: 'Fechamento de caixa',
            category: 'adjustment'
          })
      );

      if (transactionError) throw transactionError;

      // Atualizar estado
      await get().fetchCurrentRegister();
      await get().fetchCashRegisterHistory();
      toast.success('Caixa fechado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fechar caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  editCashRegister: async (data: { id: string; countedCash: number; nextDayAmount: number; notes?: string }) => {
    set({ isSubmitting: true, error: null });
    try {
      // Buscar o caixa para calcular a diferença
      const { data: register, error: fetchError } = await withRetry(() =>
        supabase
          .from('cash_registers')
          .select('expected_amount')
          .eq('id', data.id)
          .single()
      );

      if (fetchError) throw fetchError;

      // Calcular diferença
      const differenceAmount = data.countedCash - (register.expected_amount || 0);

      // Atualizar caixa
      const { error: updateError } = await withRetry(() =>
        supabase
          .from('cash_registers')
          .update({
            final_amount: data.countedCash,
            difference_amount: differenceAmount,
            next_day_amount: data.nextDayAmount,
            notes: data.notes
          })
          .eq('id', data.id)
      );

      if (updateError) throw updateError;

      // Atualizar estado
      await get().fetchCashRegisterHistory();
      toast.success('Caixa atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao editar caixa';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  addDeposit: async (amount: number, description: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => {
    set({ isSubmitting: true, error: null });
    try {
      const { currentRegister } = get();
      
      if (!currentRegister) {
        throw new Error('Não há caixa aberto para registrar suprimento');
      }

      // Get user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Registrar transação de suprimento
      const { error: transactionError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .insert({
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount,
            operation_type: 'deposit',
            payment_method: paymentMethod,
            description,
            category: 'deposit'
          })
      );

      if (transactionError) throw transactionError;

      // Atualizar estado
      await get().fetchCurrentRegister();
      toast.success('Suprimento registrado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar suprimento';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  addWithdrawal: async (amount: number, description: string) => {
    set({ isSubmitting: true, error: null });
    try {
      const { currentRegister, currentBalance } = get();
      
      if (!currentRegister) {
        throw new Error('Não há caixa aberto para registrar sangria');
      }

      if (!currentBalance) {
        throw new Error('Não foi possível calcular o saldo atual');
      }

      // Get user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Verificar se há saldo suficiente
      if (currentBalance.cash < amount) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${currentBalance.cash.toFixed(2)}`);
      }

      // Registrar transação de sangria
      const { error: transactionError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .insert({
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount,
            operation_type: 'withdrawal',
            payment_method: 'cash',
            description,
            category: 'withdrawal'
          })
      );

      if (transactionError) throw transactionError;

      // Atualizar estado
      await get().fetchCurrentRegister();
      toast.success('Sangria registrada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar sangria';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  cancelPayment: async (data: { transaction_id: string; cancellation_reason: string; supervisor_id: string; issue_receipt: boolean }) => {
    set({ isSubmitting: true, error: null });
    try {
      const { currentRegister } = get();
      
      if (!currentRegister) {
        throw new Error('Não há caixa aberto para processar cancelamento');
      }

      // Get user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Buscar a transação original
      const { data: transaction, error: fetchError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .select('*')
          .eq('id', data.transaction_id)
          .single()
      );

      if (fetchError) throw fetchError;

      // Registrar transação de cancelamento
      const { error: transactionError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .insert({
            cash_register_id: currentRegister.id,
            employee_id: user.id,
            amount: transaction.amount,
            operation_type: 'payment',
            payment_method: transaction.payment_method,
            description: `Cancelamento: ${data.cancellation_reason}`,
            reference_id: transaction.id,
            category: 'refund'
          })
      );

      if (transactionError) throw transactionError;

      // Atualizar estado
      await get().fetchCurrentRegister();
      toast.success('Pagamento cancelado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar pagamento';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  createRetroactiveTransaction: async (registerId: string, data: any) => {
    set({ isSubmitting: true, error: null });
    try {
      // Get user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Validar dados
      if (!data.operation_type || !data.amount || !data.payment_method || !data.category) {
        throw new Error('Dados incompletos para o lançamento retroativo');
      }

      // Criar transação retroativa
      const { error: transactionError } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .insert({
            cash_register_id: registerId,
            employee_id: user.id,
            amount: data.amount,
            operation_type: data.operation_type,
            payment_method: data.payment_method,
            description: data.description || 'Lançamento retroativo',
            category: data.category,
            created_at: data.transaction_date || new Date().toISOString(),
            client_name: data.client_name
          })
      );

      if (transactionError) throw transactionError;

      // Atualizar estado
      await get().fetchTransactionsByRegisterId(registerId);
      toast.success('Lançamento retroativo registrado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar lançamento retroativo';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  calculateDailyBalance: async (date: Date) => {
    try {
      // Formatar data para o formato ISO
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Buscar transações do dia
      const { data: transactions, error } = await withRetry(() =>
        supabase
          .from('cash_register_transactions')
          .select('*')
          .gte('created_at', `${dateStr}T00:00:00`)
          .lte('created_at', `${dateStr}T23:59:59`)
      );

      if (error) throw error;
      
      // Calcular saldo
      return calculateBalance(transactions || []);
    } catch (err) {
      console.error('Error calculating daily balance:', err);
      return {
        cash: 0,
        creditCard: 0,
        debitCard: 0,
        pix: 0,
        total: 0
      };
    }
  },

  getOperatorName: (operatorId: string) => {
    // Função auxiliar para obter o nome do operador quando não está disponível diretamente
    return 'Operador';
  }
}));

// Função auxiliar para calcular o saldo atual
function calculateBalance(transactions: CashTransaction[]): CashBalance {
  const balance = {
    cash: 0,
    creditCard: 0,
    debitCard: 0,
    pix: 0,
    total: 0
  };

  transactions.forEach(transaction => {
    const amount = transaction.amount;
    
    // Determinar se é entrada ou saída
    const isInflow = ['open', 'sale', 'deposit'].includes(transaction.operation_type);
    const isOutflow = ['close', 'withdrawal', 'refund'].includes(transaction.operation_type);
    
    let value = amount;
    if (isOutflow) {
      value = -amount;
    }
    
    // Atualizar saldo por método de pagamento
    switch (transaction.payment_method) {
      case 'cash':
        balance.cash += value;
        break;
      case 'credit_card':
        balance.creditCard += value;
        break;
      case 'debit_card':
        balance.debitCard += value;
        break;
      case 'pix':
        balance.pix += value;
        break;
    }
  });

  // Calcular total
  balance.total = balance.cash + balance.creditCard + balance.debitCard + balance.pix;
  
  return balance;
}

// Função auxiliar para calcular movimentos por categoria
function calculateMovements(transactions: CashTransaction[]): CashMovement[] {
  const categories: Record<string, number> = {
    sale: 0,
    deposit: 0,
    withdrawal: 0,
    refund: 0
  };

  transactions.forEach(transaction => {
    const category = transaction.category;
    const amount = transaction.amount;
    
    // Incluir transações de abertura como depósito inicial
    if (transaction.operation_type === 'open') {
      categories.deposit += amount;
      return;
    }
    
    // Ignorar apenas transações de fechamento
    if (transaction.operation_type === 'close') {
      return;
    }
    
    // Somar valores por categoria
    if (category in categories) {
      if (['sale', 'deposit'].includes(transaction.operation_type)) {
        categories[category] += amount;
      } else if (['withdrawal', 'refund'].includes(transaction.operation_type)) {
        categories[category] += amount;
      }
    }
  });

  // Converter para array de movimentos
  return Object.entries(categories)
    .filter(([_, amount]) => amount > 0) // Apenas categorias com valores
    .map(([category, amount]) => ({
      category,
      amount
    }));
}

// Função para registrar venda no caixa
export async function recordSaleInCashRegister(
  orderId: string,
  amount: number,
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix',
  clientName?: string
): Promise<boolean> {
  console.log('=== RECORD SALE IN CASH REGISTER ===');
  console.log('Order ID:', orderId);
  console.log('Amount:', amount);
  console.log('Payment Method:', paymentMethod);
  console.log('Client Name:', clientName);
  
  try {
    // Marcar transação como em processamento
    useCashRegisterStore.setState(state => ({
      processingTransactions: {
        ...state.processingTransactions,
        [orderId]: true
      }
    }));

    // Obter o caixa atual
    const currentRegister = useCashRegisterStore.getState().currentRegister;
    console.log('Current Register:', currentRegister);
    
    if (!currentRegister) {
      console.error('No cash register open');
      throw new Error('Não há caixa aberto para registrar venda');
    }

    // Get user ID first
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Preparar dados da transação
    const transactionData = {
      cash_register_id: currentRegister.id,
      employee_id: user.id,
      amount,
      operation_type: 'sale',
      payment_method: paymentMethod,
      description: `Pagamento da comanda #${orderId.substring(0, 8)}`,
      reference_id: orderId,
      category: 'sale',
      client_name: clientName
    };
    
    console.log('Transaction data to insert:', transactionData);

    // Registrar transação de venda
    const { data: insertedData, error: transactionError } = await withRetry(() =>
      supabase
        .from('cash_register_transactions')
        .insert(transactionData)
        .select()
    );

    console.log('Insert result:', insertedData);
    console.log('Insert error:', transactionError);

    if (transactionError) throw transactionError;

    console.log('Transaction inserted successfully, refreshing cash register...');
    
    // Atualizar estado imediatamente após inserir
    await useCashRegisterStore.getState().fetchCurrentRegister();
    
    // Remover transação do processamento
    useCashRegisterStore.setState(state => {
      const newProcessingTransactions = { ...state.processingTransactions };
      delete newProcessingTransactions[orderId];
      return { processingTransactions: newProcessingTransactions };
    });

    console.log('Sale recorded successfully');
    return true;
  } catch (err) {
    console.error('Error recording sale:', err);
    
    // Remover transação do processamento em caso de erro
    useCashRegisterStore.setState(state => {
      const newProcessingTransactions = { ...state.processingTransactions };
      delete newProcessingTransactions[orderId];
      return { processingTransactions: newProcessingTransactions };
    });
    
    return false;
  }
}