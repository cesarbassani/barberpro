import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { Calendar, DollarSign, ArrowUp, ArrowDown, HelpCircle, User } from 'lucide-react';

interface RetroactiveTransactionFormProps {
  registerId: string;
  registerDate: Date;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function RetroactiveTransactionForm({
  registerId,
  registerDate,
  onSubmit,
  onCancel,
  isSubmitting = false
}: RetroactiveTransactionFormProps) {
  // Configure form schema
  const formSchema = z.object({
    operation_type: z.enum(['sale', 'payment', 'deposit', 'withdrawal']),
    category: z.enum(['sale', 'payment', 'deposit', 'withdrawal', 'adjustment']),
    amount: z.number().min(0.01, 'O valor deve ser maior que zero'),
    payment_method: z.enum(['cash', 'credit_card', 'debit_card', 'pix']),
    description: z.string().min(3, 'Descrição deve ter pelo menos 3 caracteres'),
    transaction_date: z.string().refine(
      (date) => {
        const parsedDate = new Date(date);
        // Ensure date is valid and within the cash register's open period
        return (
          !isNaN(parsedDate.getTime()) && 
          isBefore(parsedDate, new Date()) &&
          isAfter(parsedDate, registerDate)
        );
      },
      { message: 'Data inválida ou fora do período do caixa' }
    ),
    client_name: z.string().optional(),
  });

  type FormData = z.infer<typeof formSchema>;

  // Set up form with default values
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      operation_type: 'sale',
      category: 'sale',
      amount: 0,
      payment_method: 'cash',
      description: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
      client_name: '',
    }
  });

  const operationType = watch('operation_type');
  
  // Update category when operation type changes
  React.useEffect(() => {
    const mapping: Record<string, any> = {
      'sale': 'sale',
      'payment': 'payment',
      'deposit': 'deposit',
      'withdrawal': 'withdrawal',
    };
  }, [operationType]);
  
  // Handle form submission
  const handleFormSubmit = async (data: FormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          Tipo de Operação
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              Selecione o tipo de operação para este lançamento retroativo
            </span>
          </div>
        </label>
        <select
          {...register('operation_type')}
          onChange={(e) => {
            // Set the category based on the operation type
            const value = e.target.value as 'sale' | 'payment' | 'deposit' | 'withdrawal';
            const mapping: Record<string, any> = {
              'sale': 'sale',
              'payment': 'payment',
              'deposit': 'deposit',
              'withdrawal': 'withdrawal',
            };
          }}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="sale">Venda</option>
          <option value="payment">Pagamento</option>
          <option value="deposit">Suprimento</option>
          <option value="withdrawal">Sangria</option>
        </select>
        {errors.operation_type && (
          <p className="mt-1 text-sm text-red-600">{errors.operation_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          Valor
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              Informe o valor da transação
            </span>
          </div>
        </label>
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            {...register('amount', { valueAsNumber: true })}
            className="h-10 block w-full pl-12 pr-10 sm:text-sm border-gray-300 rounded-md focus:border-primary-500 focus:ring-primary-500"
            placeholder="0.00"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">BRL</span>
          </div>
        </div>
        {errors.amount && (
          <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          Forma de Pagamento
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              Selecione a forma de pagamento para esta transação
            </span>
          </div>
        </label>
        <select
          {...register('payment_method')}
          className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="cash">Dinheiro</option>
          <option value="credit_card">Cartão de Crédito</option>
          <option value="debit_card">Cartão de Débito</option>
          <option value="pix">PIX</option>
        </select>
        {errors.payment_method && (
          <p className="mt-1 text-sm text-red-600">{errors.payment_method.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          Data e Hora da Transação
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              Informe quando ocorreu esta transação (deve ser posterior à abertura do caixa)
            </span>
          </div>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="datetime-local"
            {...register('transaction_date')}
            className="h-10 block w-full pl-12 sm:text-sm border-gray-300 rounded-md focus:border-primary-500 focus:ring-primary-500"
            min={format(registerDate, 'yyyy-MM-dd\'T\'HH:mm')}
            max={format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')}
          />
        </div>
        {errors.transaction_date && (
          <p className="mt-1 text-sm text-red-600">{errors.transaction_date.message}</p>
        )}
      </div>

      {['sale', 'payment'].includes(operationType) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            Nome do Cliente (opcional)
            <div className="tooltip ml-1">
              <HelpCircle className="h-4 w-4 text-gray-400" />
              <span className="tooltiptext">
                Informe o nome do cliente para esta venda ou pagamento
              </span>
            </div>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              {...register('client_name')}
              className="h-10 block w-full pl-12 sm:text-sm border-gray-300 rounded-md focus:border-primary-500 focus:ring-primary-500"
              placeholder="Nome do cliente"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
          Descrição
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              Adicione uma descrição detalhada para esta transação
            </span>
          </div>
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="block w-full sm:text-sm border-gray-300 rounded-md focus:border-primary-500 focus:ring-primary-500"
          placeholder="Descreva o motivo ou detalhes desta transação..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Registrando...' : 'Registrar Lançamento'}
        </button>
      </div>
    </form>
  );
}