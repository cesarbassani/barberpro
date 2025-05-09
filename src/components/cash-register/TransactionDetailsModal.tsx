import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  X, 
  DollarSign, 
  Clock, 
  User, 
  CreditCard,
  FileText,
  Clipboard,
  XCircle
} from 'lucide-react';

interface TransactionDetailsModalProps {
  transaction: any;
  onClose: () => void;
  onCancelPayment?: (transaction: any) => void;
}

export function TransactionDetailsModal({ transaction, onClose, onCancelPayment }: TransactionDetailsModalProps) {
  const isInflow = ['open', 'sale', 'deposit'].includes(transaction.operation_type);
  const canCancel = transaction.operation_type === 'sale' || transaction.operation_type === 'payment';
  
  // Helper to get operation type label
  const getOperationTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'open': 'Abertura de Caixa',
      'close': 'Fechamento de Caixa',
      'sale': 'Venda',
      'payment': 'Pagamento',
      'withdrawal': 'Sangria',
      'deposit': 'Suprimento'
    };
    
    return types[type] || type;
  };
  
  // Helper to get payment method label
  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'cash': 'Dinheiro',
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'pix': 'PIX'
    };
    
    return methods[method] || method;
  };
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden w-full max-w-md">
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="h-5 w-5 text-primary-600 mr-2" />
            Detalhes da Movimentação
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Header with amount */}
          <div className={`flex justify-between items-center p-3 rounded-lg ${
            isInflow ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
          }`}>
            <div className="flex items-center">
              <DollarSign className={`h-6 w-6 ${isInflow ? 'text-green-500' : 'text-red-500'}`} />
              <div className="ml-2">
                <p className="text-sm font-medium text-gray-700">
                  {getOperationTypeLabel(transaction.operation_type)}
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(transaction.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className={`text-lg font-bold ${isInflow ? 'text-green-600' : 'text-red-600'}`}>
              {isInflow ? '+' : '-'} R$ {Number(transaction.amount).toFixed(2)}
            </div>
          </div>
          
          {/* Transaction details */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center">
                  <Clock className="h-4 w-4 mr-1 text-gray-400" />
                  Data e Hora
                </p>
                <p className="text-sm text-gray-900">
                  {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center">
                  <User className="h-4 w-4 mr-1 text-gray-400" />
                  Operador
                </p>
                <p className="text-sm text-gray-900">
                  {transaction.employee?.full_name || 'Não disponível'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center">
                  <CreditCard className="h-4 w-4 mr-1 text-gray-400" />
                  Forma de Pagamento
                </p>
                <p className="text-sm text-gray-900">
                  {getPaymentMethodLabel(transaction.payment_method)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center">
                  <Clipboard className="h-4 w-4 mr-1 text-gray-400" />
                  Categoria
                </p>
                <p className="text-sm text-gray-900">
                  {transaction.category === 'sale' ? 'Venda' : 
                   transaction.category === 'payment' ? 'Pagamento' : 
                   transaction.category === 'withdrawal' ? 'Sangria' : 
                   transaction.category === 'deposit' ? 'Suprimento' : 
                   transaction.category === 'adjustment' ? 'Ajuste' : 
                   transaction.category}
                </p>
              </div>
            </div>
            
            {transaction.client_name && (
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center">
                  <User className="h-4 w-4 mr-1 text-gray-400" />
                  Cliente
                </p>
                <p className="text-sm text-gray-900">
                  {transaction.client_name}
                </p>
              </div>
            )}
            
            {transaction.description && (
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center">
                  <FileText className="h-4 w-4 mr-1 text-gray-400" />
                  Descrição
                </p>
                <p className="text-sm text-gray-900">
                  {transaction.description}
                </p>
              </div>
            )}
            
            {transaction.reference_id && (
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Referência
                </p>
                <p className="text-sm text-gray-900">
                  ID: {transaction.reference_id.substring(0, 8)}...
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
          {canCancel && onCancelPayment && (
            <button
              onClick={() => onCancelPayment(transaction)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Pagamento
            </button>
          )}
          <button
            onClick={onClose}
            className={`px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${canCancel && onCancelPayment ? '' : 'ml-auto'}`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}