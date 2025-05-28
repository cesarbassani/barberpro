import React, { useState, useEffect, useRef } from 'react';
import { useCashRegisterStore, recordSaleInCashRegister } from '../../lib/cashRegisterStore';
import { useAuth } from '../../lib/auth';
import { format, addDays, isToday, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { 
  Receipt, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Power, 
  AlertTriangle, 
  Crown,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Filter,
  FileText,
  HelpCircle,
  AlarmClock,
  Eye,
  Edit2,
  Truck,
  XCircle
} from 'lucide-react';
import { useOrders } from '../../lib/orders';
import { CashRegisterOpenForm } from './CashRegisterOpenForm';
import { CashRegisterCloseForm } from './CashRegisterCloseForm';
import { CashMovementForm } from './CashMovementForm';
import { CashRegisterHistoryTab } from './CashRegisterHistoryTab';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { RetroactiveTransactionForm } from './RetroactiveTransactionForm';
import { EditCashRegisterForm } from './EditCashRegisterForm';
import { CancelPaymentModal } from './CancelPaymentModal';
import { OrderCancellationModal } from './OrderCancellationModal';
import toast from 'react-hot-toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';

type Tab = 'register' | 'history';

export function CashRegisterPage() {
  const [selectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<Tab>('register');
  const [isOpenFormVisible, setIsOpenFormVisible] = useState(false);
  const [isCloseFormVisible, setIsCloseFormVisible] = useState(false);
  const [isDepositFormVisible, setIsDepositFormVisible] = useState(false);
  const [isWithdrawalFormVisible, setIsWithdrawalFormVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isTransactionDetailsModalOpen, setIsTransactionDetailsModalOpen] = useState(false);
  const [isRetroactiveFormOpen, setIsRetroactiveFormOpen] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<any | null>(null);
  const [isEditRegisterFormOpen, setIsEditRegisterFormOpen] = useState(false);
  const [isCancelPaymentModalOpen, setIsCancelPaymentModalOpen] = useState(false);
  const [isCancelOrderModalOpen, setIsCancelOrderModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  const { 
    currentRegister, 
    currentBalance,
    movements,
    transactions,
    isLoading, 
    isSubmitting,
    error, 
    fetchCashRegisterHistory,
    fetchCurrentRegister,
    fetchTransactionsByRegisterId,
    processingTransactions,
    getOperatorName
  } = useCashRegisterStore();
  
  const { orders, isLoading: ordersLoading, fetchOrders, updateOrderStatus } = useOrders();
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Use getState() to ensure we're getting the latest reference to the function
    const fetchRegister = useCashRegisterStore.getState().fetchCurrentRegister;
    const fetchHistoryFn = useCashRegisterStore.getState().fetchCashRegisterHistory;
    
    fetchRegister();
    fetchOrders();
    fetchHistoryFn();
  }, [fetchOrders]);

  // Debug - log state for troubleshooting
  useEffect(() => {
    console.log('Current Register:', currentRegister);
    console.log('Transactions:', transactions);
    console.log('Movements:', movements);
    console.log('Current Balance:', currentBalance);
  }, [currentRegister, transactions, movements, currentBalance]);

  useEffect(() => {
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      if (currentRegister) {
        fetchCurrentRegister();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentRegister]);

  const handleOpenCashRegister = async (initialAmount: number) => {
    try {
      await useCashRegisterStore.getState().openCashRegister(initialAmount);
      setIsOpenFormVisible(false);
    } catch (error) {
      console.error('Error opening cash register:', error);
    }
  };

  const handleCloseCashRegister = async (data: any) => {
    try {
      await useCashRegisterStore.getState().closeCashRegister(data);
      setIsCloseFormVisible(false);
    } catch (error) {
      console.error('Error closing cash register:', error);
    }
  };

  const handleEditCashRegister = async (data: any) => {
    try {
      await useCashRegisterStore.getState().editCashRegister({
        id: selectedRegister?.id || '',
        countedCash: data.countedCash,
        nextDayAmount: data.nextDayAmount,
        notes: data.notes
      });
      setIsEditRegisterFormOpen(false);
      setSelectedRegister(null);
    } catch (error) {
      console.error('Error editing cash register:', error);
    }
  };

  const handleSubmitRetroactiveTransaction = async (data: any) => {
    try {
      if (!selectedRegister) return;
      
      await useCashRegisterStore.getState().createRetroactiveTransaction(
        selectedRegister.id,
        data
      );
      setIsRetroactiveFormOpen(false);
    } catch (error) {
      console.error('Error creating retroactive transaction:', error);
    }
  };

  const handleDeposit = async (amount: number, description: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => {
    try {
      await useCashRegisterStore.getState().addDeposit(amount, description, paymentMethod);
      setIsDepositFormVisible(false);
    } catch (error) {
      console.error('Error adding deposit:', error);
    }
  };

  const handleWithdrawal = async (amount: number, description: string) => {
    try {
      await useCashRegisterStore.getState().addWithdrawal(amount, description);
      setIsWithdrawalFormVisible(false);
    } catch (error) {
      console.error('Error adding withdrawal:', error);
    }
  };
  
  const handleCancelPayment = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsCancelPaymentModalOpen(true);
  };
  
  const handleOrderCancellation = (orderId?: string) => {
    if (orderId) {
      setSelectedOrderId(orderId);
    } else {
      setSelectedOrderId(null);
    }
    setIsCancelOrderModalOpen(true);
  };

  const debouncedPayment = useDebounce(async (orderId: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => {
    try {
      if (!currentRegister) {
        toast.error('Não há caixa aberto para processar pagamentos');
        return;
      }
      
      // Update order status in the main database
      await updateOrderStatus(orderId, 'completed');

      // Find order to get amount
      const order = orders?.find(o => o.id === orderId);
      if (!order) {
        throw new Error('Comanda não encontrada');
      }

      // Record sale in cash register
      const success = await recordSaleInCashRegister(
        orderId, 
        Number(order.total_amount), 
        paymentMethod,
        order.client?.full_name
      );

      if (success) {
        toast.success('Pagamento processado com sucesso!');
        await fetchOrders();
        // Atualizar o caixa para mostrar a nova movimentação
        await fetchCurrentRegister();
      } else {
        toast.error('Erro ao registrar pagamento no caixa');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Erro ao processar pagamento');
    }
  }, 500);

  const handlePayment = (orderId: string, paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix') => {
    // Check if the transaction is already being processed
    if (processingTransactions && processingTransactions[orderId]) {
      toast.error('Este pagamento já está sendo processado');
      return;
    }
    
    debouncedPayment(orderId, paymentMethod);
  };

  const handleViewTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionDetailsModalOpen(true);
  };

  const pendingOrders = Array.isArray(orders) 
    ? orders.filter(order => order.status === 'open' || order.status === 'in_progress')
    : [];

  const isLoaded = !isLoading && !ordersLoading;
  const cashRegisterReady = isLoaded && currentRegister;
  const transactionHistory = Array.isArray(transactions) 
  ? transactions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  : [];
  
  // Calculate total by category for today
  const salesTotal = Array.isArray(movements) 
    ? movements.filter(m => m.category === 'sale').reduce((sum, m) => sum + m.amount, 0)
    : 0;
  
  const depositsTotal = Array.isArray(movements)
    ? movements.filter(m => m.category === 'deposit').reduce((sum, m) => sum + m.amount, 0)
    : 0;
  
  const withdrawalsTotal = Array.isArray(movements)
    ? movements.filter(m => m.category === 'withdrawal').reduce((sum, m) => sum + m.amount, 0)
    : 0;
  
  const refundsTotal = Array.isArray(movements)
    ? movements.filter(m => m.category === 'refund').reduce((sum, m) => sum + m.amount, 0)
    : 0;

  // Tooltip descriptions for features
  const tooltips = {
    openRegister: "Abrir um novo caixa para registrar vendas, pagamentos e outras movimentações financeiras.",
    closeRegister: "Fecha o caixa atual, registra valores finais e permite contagem de dinheiro com cálculo de diferença.",
    supply: "Adicionar dinheiro ou outros valores ao caixa (ex: troco, novas cédulas, etc).",
    withdrawal: "Retirar dinheiro do caixa para outros fins (ex: pagamentos, despesas, etc).",
    refresh: "Atualizar informações do caixa e movimentações.",
    cashBalance: "Total de dinheiro em espécie no caixa.",
    cardBalance: "Total recebido em cartões de crédito e débito.",
    pixBalance: "Total recebido via PIX.",
    totalBalance: "Saldo total do caixa considerando todas as formas de pagamento.",
    dailySales: "Total de vendas realizadas no caixa atual.",
    supplies: "Total de suprimentos adicionados ao caixa.",
    withdrawals: "Total de retiradas (sangrias) realizadas no caixa.",
    refunds: "Total de cancelamentos e estornos realizados no caixa."
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('register')}
          className={`${
            activeTab === 'register'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center mr-8`}
        >
          <DollarSign className="h-5 w-5 mr-2" />
          Operação do Caixa
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`${
            activeTab === 'history'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center mr-8`}
        >
          <Clock className="h-5 w-5 mr-2" />
          Histórico
        </button>
      </div>
      
      {activeTab === 'register' && (
        <>
          {/* Cash Register Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Caixa</h2>
            <div className="flex items-center space-x-4">
              {currentRegister ? (
                <>
                  <div className="tooltip">
                    <button
                      onClick={async () => {
                        console.log('Forcing refresh...');
                        await fetchCurrentRegister();
                        // Force também um refresh dos pedidos
                        await fetchOrders();
                      }}
                      className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar
                    </button>
                    <span className="tooltiptext">
                      {tooltips.refresh}
                    </span>
                  </div>
                  <div className="tooltip">
                    <button
                      onClick={() => setIsDepositFormVisible(true)}
                      disabled={isSubmitting}
                      className="flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Suprimento
                    </button>
                    <span className="tooltiptext">
                      {tooltips.supply}
                    </span>
                  </div>
                  <div className="tooltip">
                    <button
                      onClick={() => setIsWithdrawalFormVisible(true)}
                      disabled={isSubmitting}
                      className="flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Sangria
                    </button>
                    <span className="tooltiptext">
                      {tooltips.withdrawal}
                    </span>
                  </div>
                  <div className="tooltip">
                    <button
                      onClick={() => setIsCloseFormVisible(true)}
                      disabled={isSubmitting}
                      className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      <Power className="h-4 w-4 mr-2" />
                      Fechar Caixa
                    </button>
                    <span className="tooltiptext">
                      {tooltips.closeRegister}
                    </span>
                  </div>
                  <div className="tooltip">
                    <button
                      onClick={() => handleOrderCancellation()}
                      className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar Comanda
                    </button>
                    <span className="tooltiptext">
                      Cancelar uma comanda e retornar itens ao estoque
                    </span>
                  </div>
                </>
              ) : (
                <div className="tooltip">
                  <button
                    onClick={() => setIsOpenFormVisible(true)}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Abrir Caixa
                  </button>
                  <span className="tooltiptext">
                    {tooltips.openRegister}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!currentRegister && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    O caixa está fechado. Abra o caixa para processar pagamentos e registrar movimentações.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentRegister && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Caixa aberto desde {format(new Date(currentRegister.opened_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    {" por "} 
                    {currentRegister.opening_employee?.full_name || getOperatorName(currentRegister.opening_employee_id)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cash Register Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Wallet className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Dinheiro em Caixa</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    R$ {cashRegisterReady && currentBalance ? currentBalance.cash.toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.cashBalance}
              </span>
            </div>

            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Cartões</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    R$ {cashRegisterReady && currentBalance ? (currentBalance.creditCard + currentBalance.debitCard).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.cardBalance}
              </span>
            </div>

            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">PIX</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    R$ {cashRegisterReady && currentBalance ? currentBalance.pix.toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.pixBalance}
              </span>
            </div>

            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Saldo Total</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    R$ {cashRegisterReady && currentBalance ? currentBalance.total.toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.totalBalance}
              </span>
            </div>
          </div>

          {/* Additional summary for the day */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <ArrowUpCircle className="h-6 w-6 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Vendas do dia</p>
                  <p className="text-xl font-semibold text-green-600">
                    + R$ {salesTotal.toFixed(2)}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.dailySales}
              </span>
            </div>

            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <PlusCircle className="h-6 w-6 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Suprimentos</p>
                  <p className="text-xl font-semibold text-blue-600">
                    + R$ {depositsTotal.toFixed(2)}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.supplies}
              </span>
            </div>

            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <MinusCircle className="h-6 w-6 text-amber-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sangrias</p>
                  <p className="text-xl font-semibold text-amber-600">
                    - R$ {withdrawalsTotal.toFixed(2)}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.withdrawals}
              </span>
            </div>
            
            <div className="tooltip bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <XCircle className="h-6 w-6 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Cancelamentos</p>
                  <p className="text-xl font-semibold text-red-600">
                    - R$ {refundsTotal.toFixed(2)}
                  </p>
                </div>
              </div>
              <span className="tooltiptext">
                {tooltips.refunds}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Orders */}
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Comandas Pendentes</h3>
              </div>
              <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                {pendingOrders.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Nenhuma comanda pendente
                  </div>
                ) : (
                  pendingOrders.map((order) => (
                    <div key={order.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <Receipt className="h-5 w-5 text-gray-400" />
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            Comanda #{order.id.split('-')[0]}
                          </span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status === 'open' ? 'Aberta' : 'Em Andamento'}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-sm text-gray-600">Cliente: {order.client?.full_name}</p>
                        <p className="text-sm text-gray-600">Atendente: {order.barber?.full_name}</p>
                        <p className="text-sm text-gray-600">
                          Data: {format(new Date(order.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>

                      <div className="space-y-2 mb-4">
                        <h4 className="text-sm font-medium text-gray-900">Itens:</h4>
                        {order.items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="flex items-center">
                              {item.quantity}x {item.service?.name || item.product?.name || 'Item desconhecido'}
                              {item.is_loyalty_service && (
                                <Crown className="h-3 w-3 ml-1 text-indigo-600\" title="Incluso no plano de fidelidade" />
                              )}
                            </span>
                            <span className={`font-medium ${item.is_loyalty_service ? 'text-indigo-500' : ''}`}>
                              {item.is_loyalty_service 
                                ? 'Plano' 
                                : `R$ ${Number(item.total_price).toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-medium">
                          <span>Total</span>
                          <span>R$ {Number(order.total_amount).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="tooltip">
                            <button
                              onClick={() => handlePayment(order.id, 'cash')}
                              disabled={!currentRegister || (processingTransactions && processingTransactions[order.id])}
                              className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm ${
                                currentRegister && !(processingTransactions && processingTransactions[order.id])
                                  ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                  : 'border-gray-300 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <Wallet className="h-4 w-4 mr-2" />
                              Dinheiro
                            </button>
                            <span className="tooltiptext">
                              Receber o pagamento dessa comanda em dinheiro
                            </span>
                          </div>
                          <div className="tooltip">
                            <button
                              onClick={() => handlePayment(order.id, 'credit_card')}
                              disabled={!currentRegister || (processingTransactions && processingTransactions[order.id])}
                              className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm ${
                                currentRegister && !(processingTransactions && processingTransactions[order.id])
                                  ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                  : 'border-gray-300 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Crédito
                            </button>
                            <span className="tooltiptext">
                              Receber o pagamento dessa comanda via cartão de crédito
                            </span>
                          </div>
                          <div className="tooltip">
                            <button
                              onClick={() => handlePayment(order.id, 'debit_card')}
                              disabled={!currentRegister || (processingTransactions && processingTransactions[order.id])}
                              className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm ${
                                currentRegister && !(processingTransactions && processingTransactions[order.id])
                                  ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                  : 'border-gray-300 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Débito
                            </button>
                            <span className="tooltiptext">
                              Receber o pagamento dessa comanda via cartão de débito
                            </span>
                          </div>
                          <div className="tooltip">
                            <button
                              onClick={() => handlePayment(order.id, 'pix')}
                              disabled={!currentRegister || (processingTransactions && processingTransactions[order.id])}
                              className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm ${
                                currentRegister && !(processingTransactions && processingTransactions[order.id])
                                  ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                  : 'border-gray-300 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              PIX
                            </button>
                            <span className="tooltiptext">
                              Receber o pagamento dessa comanda via PIX
                            </span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleOrderCancellation(order.id)}
                          className="w-full flex items-center justify-center px-3 py-2 border border-red-300 rounded-md text-sm text-red-700 bg-white hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Comanda
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Movimentações do Caixa</h3>
                <button
                  onClick={() => fetchCurrentRegister()}
                  className="text-primary-600 hover:text-primary-800"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                {transactionHistory.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Nenhuma movimentação registrada neste caixa
                  </div>
                ) : (
                  transactionHistory.map((transaction) => (
                    <div key={transaction.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-gray-900">
                            {transaction.description || getOperationDescription(transaction.operation_type)}
                          </span>
                          <div className="text-sm text-gray-500">
                            {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm")}
                          </div>
                          <div className="text-sm text-gray-500">
                            Operador: {transaction.employee?.full_name}
                          </div>
                          {transaction.client_name && (
                            <div className="text-sm text-gray-500">
                              Cliente: {transaction.client_name}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <div className={`font-medium ${
                            ['withdrawal', 'payment', 'refund'].includes(transaction.operation_type) 
                              ? 'text-red-600' 
                              : 'text-green-600'
                          }`}>
                            {['withdrawal', 'payment', 'refund'].includes(transaction.operation_type) ? '- ' : '+ '}
                            R$ {Number(transaction.amount).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getPaymentMethodLabel(transaction.operation_type, transaction.payment_method)}
                          </div>
                          <div className="flex space-x-2 mt-1">
                            <button
                              onClick={() => handleViewTransactionDetails(transaction)}
                              className="text-xs text-primary-600 hover:text-primary-800 mt-1 flex items-center"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </button>
                            {['sale', 'payment'].includes(transaction.operation_type) && (
                              <button
                                onClick={() => handleCancelPayment(transaction)}
                                className="text-xs text-red-600 hover:text-red-800 flex items-center"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* History Tab */}
      {activeTab === 'history' && (
        <CashRegisterHistoryTab 
          onEditRegister={(register) => {
            setSelectedRegister(register);
            setIsEditRegisterFormOpen(true);
          }}
          onCreateRetroactiveTransaction={(register) => {
            setSelectedRegister(register);
            setIsRetroactiveFormOpen(true);
          }}
        />
      )}

      {/* Cash Register Opening Form Modal */}
      {isOpenFormVisible && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Abertura de Caixa
            </h3>
            <CashRegisterOpenForm 
              onSubmit={handleOpenCashRegister}
              onCancel={() => setIsOpenFormVisible(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Cash Register Closing Form Modal */}
      {isCloseFormVisible && currentRegister && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Fechamento de Caixa
            </h3>
            <CashRegisterCloseForm 
              expectedAmount={currentBalance ? currentBalance.cash : 0}
              onSubmit={handleCloseCashRegister}
              onCancel={() => setIsCloseFormVisible(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Edit Cash Register Form Modal */}
      {isEditRegisterFormOpen && selectedRegister && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Editar Registro de Caixa
            </h3>
            <EditCashRegisterForm 
              register={selectedRegister}
              onSubmit={handleEditCashRegister}
              onCancel={() => {
                setIsEditRegisterFormOpen(false);
                setSelectedRegister(null);
              }}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Retroactive Transaction Form Modal */}
      {isRetroactiveFormOpen && selectedRegister && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Criar Lançamento Retroativo
            </h3>
            <RetroactiveTransactionForm
              registerId={selectedRegister.id}
              registerDate={new Date(selectedRegister.opened_at)}
              onSubmit={handleSubmitRetroactiveTransaction}
              onCancel={() => {
                setIsRetroactiveFormOpen(false);
                setSelectedRegister(null);
              }}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Deposit Form Modal */}
      {isDepositFormVisible && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              Adicionar Suprimento
              <div className="tooltip ml-2">
                <HelpCircle className="h-4 w-4 text-gray-400" />
                <span className="tooltiptext">
                  {tooltips.supply}
                </span>
              </div>
            </h3>
            <CashMovementForm 
              type="deposit"
              onSubmit={(amount, description, paymentMethod) => 
                handleDeposit(amount, description, paymentMethod)
              }
              onCancel={() => setIsDepositFormVisible(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Withdrawal Form Modal */}
      {isWithdrawalFormVisible && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              Realizar Sangria
              <div className="tooltip ml-2">
                <HelpCircle className="h-4 w-4 text-gray-400" />
                <span className="tooltiptext">
                  {tooltips.withdrawal}
                </span>
              </div>
            </h3>
            <CashMovementForm 
              type="withdrawal"
              maxAmount={currentBalance ? currentBalance.cash : 0}
              onSubmit={(amount, description) => 
                handleWithdrawal(amount, description)
              }
              onCancel={() => setIsWithdrawalFormVisible(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {isTransactionDetailsModalOpen && selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onCancelPayment={handleCancelPayment}
          onClose={() => {
            setIsTransactionDetailsModalOpen(false);
            setSelectedTransaction(null);
          }}
        />
      )}
      
      {/* Cancel Payment Modal */}
      {isCancelPaymentModalOpen && selectedTransaction && (
        <CancelPaymentModal
          transaction={selectedTransaction}
          onClose={() => {
            setIsCancelPaymentModalOpen(false);
            setSelectedTransaction(null);
          }}
          onSuccess={() => {
            setIsCancelPaymentModalOpen(false);
            setSelectedTransaction(null);
            // Refresh data
            fetchCurrentRegister();
          }}
        />
      )}
      
      {/* Cancel Order Modal */}
      {isCancelOrderModalOpen && (
        <OrderCancellationModal
          onClose={() => {
            setIsCancelOrderModalOpen(false);
            setSelectedOrderId(null);
          }}
          preselectedOrderId={selectedOrderId || undefined}
        />
      )}
    </div>
  );
}

function getOperationDescription(operationType: string): string {
  switch (operationType) {
    case 'sale': return 'Venda';
    case 'payment': return 'Pagamento';
    case 'withdrawal': return 'Sangria';
    case 'deposit': return 'Suprimento';
    case 'open': return 'Abertura de caixa';
    case 'close': return 'Fechamento de caixa';
    case 'refund': return 'Estorno/Cancelamento';
    default: return 'Operação';
  }
}

// Helper function to get readable payment method labels
function getPaymentMethodLabel(operationType: string, method: string): string {
  if (operationType === 'withdrawal') return 'Sangria em dinheiro';
  if (operationType === 'refund') {
    switch (method) {
      case 'cash': return 'Estorno em dinheiro';
      case 'credit_card': return 'Estorno em cartão de crédito';
      case 'debit_card': return 'Estorno em cartão de débito';
      case 'pix': return 'Estorno via PIX';
      default: return 'Estorno';
    }
  }
  if (operationType === 'deposit') {
    switch (method) {
      case 'cash': return 'Suprimento em dinheiro';
      case 'credit_card': return 'Suprimento via crédito';
      case 'debit_card': return 'Suprimento via débito';
      case 'pix': return 'Suprimento via PIX';
      default: return 'Suprimento';
    }
  }
  
  switch (method) {
    case 'cash': return 'Dinheiro';
    case 'credit_card': return 'Cartão de crédito';
    case 'debit_card': return 'Cartão de débito';
    case 'pix': return 'PIX';
    default: return method;
  }
}