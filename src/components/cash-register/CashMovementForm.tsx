import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, HelpCircle } from 'lucide-react';

interface CashMovementFormProps {
  type: 'deposit' | 'withdrawal';
  maxAmount?: number;
  onSubmit: (amount: number, description: string, paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'pix') => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CashMovementForm({ type, maxAmount, onSubmit, onCancel, isSubmitting = false }: CashMovementFormProps) {
  const isDeposit = type === 'deposit';

  // Create schema based on movement type
  const formSchema = z.object({
    amount: isDeposit 
      ? z.number().min(0.01, 'O valor deve ser maior que zero')
      : z.number()
        .min(0.01, 'O valor deve ser maior que zero')
        .max(maxAmount || Infinity, `O valor máximo para sangria é R$ ${maxAmount?.toFixed(2)}`),
    description: z.string().min(3, 'A descrição deve ter pelo menos 3 caracteres'),
    paymentMethod: isDeposit 
      ? z.enum(['cash', 'credit_card', 'debit_card', 'pix'])
      : z.literal('cash'),
  });

  type FormData = z.infer<typeof formSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      description: isDeposit ? 'Suprimento de caixa' : 'Sangria de caixa',
      paymentMethod: 'cash',
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    if (isDeposit) {
      await onSubmit(data.amount, data.description, data.paymentMethod);
    } else {
      await onSubmit(data.amount, data.description);
    }
  };

  const tooltips = {
    deposit: "Adicione valores ao caixa para gerenciar o fluxo financeiro. Use para repor troco, adicionar cédulas, ou registrar entradas diversas.",
    withdrawal: "Retire dinheiro do caixa para outras finalidades. Use para pagar fornecedores, despesas operacionais, ou transferir valores.", 
    depositAmount: "Digite o valor a ser adicionado ao caixa.",
    withdrawalAmount: "Digite o valor a ser retirado do caixa (não pode exceder o saldo disponível).",
    description: "Informe o motivo ou finalidade desta movimentação para controle financeiro.",
    paymentMethod: "Selecione o meio de pagamento utilizado para este suprimento."
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <div className="flex items-center">
          <label htmlFor="amount-input" className="block text-sm font-medium text-gray-700 mb-1">
            {isDeposit ? 'Valor do Suprimento' : 'Valor da Sangria'}
          </label>
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              {isDeposit ? tooltips.depositAmount : tooltips.withdrawalAmount}
            </span>
          </div>
        </div>
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            id="amount-input"
            {...register('amount', { valueAsNumber: true })}
            className="h-10 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
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

      {isDeposit && (
        <div>
          <div className="flex items-center">
            <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-1">
              Forma de Pagamento
            </label>
            <div className="tooltip ml-1">
              <HelpCircle className="h-4 w-4 text-gray-400" />
              <span className="tooltiptext">
                {tooltips.paymentMethod}
              </span>
            </div>
          </div>
          <select
            id="payment-method"
            {...register('paymentMethod')}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option value="cash">Dinheiro</option>
            <option value="credit_card">Cartão de Crédito</option>
            <option value="debit_card">Cartão de Débito</option>
            <option value="pix">PIX</option>
          </select>
          {errors.paymentMethod && (
            <p className="mt-1 text-sm text-red-600">{errors.paymentMethod.message}</p>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center">
          <label htmlFor="description-input" className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              {tooltips.description}
            </span>
          </div>
        </div>
        <textarea
          id="description-input"
          {...register('description')}
          rows={3}
          className="block w-full sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          placeholder={isDeposit ? "Motivo do suprimento de caixa..." : "Motivo da sangria de caixa..."}
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
          className={`inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
            isDeposit 
              ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
              : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50`}
        >
          {isSubmitting 
            ? (isDeposit ? 'Registrando...' : 'Registrando...') 
            : (
              <>
                {isDeposit 
                  ? <><ArrowUpCircle className="h-4 w-4 mr-2" /> Adicionar Suprimento</> 
                  : <><ArrowDownCircle className="h-4 w-4 mr-2" /> Registrar Sangria</>
                }
              </>
            )
          }
        </button>
      </div>
    </form>
  );
}