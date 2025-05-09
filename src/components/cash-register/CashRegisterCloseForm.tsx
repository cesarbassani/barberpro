import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';

const formSchema = z.object({
  countedCash: z.number().min(0, 'O valor em dinheiro não pode ser negativo'),
  nextDayAmount: z.number().min(0, 'O valor para o próximo dia não pode ser negativo'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CashRegisterCloseFormProps {
  expectedAmount: number;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CashRegisterCloseForm({ expectedAmount, onSubmit, onCancel, isSubmitting = false }: CashRegisterCloseFormProps) {
  const [confirmDifference, setConfirmDifference] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      countedCash: expectedAmount,
      nextDayAmount: 0,
      notes: '',
    },
  });

  const countedCash = watch('countedCash');
  const difference = countedCash - expectedAmount;
  const hasDifference = Math.abs(difference) > 0.01; // Allow for small floating point differences

  const handleFormSubmit = async (data: FormData) => {
    // If there's a difference and user hasn't confirmed, show confirmation first
    if (hasDifference && !confirmDifference) {
      setConfirmDifference(true);
      return;
    }
    
    await onSubmit(data);
  };

  const tooltips = {
    countedCash: "Informe o valor real em dinheiro contado fisicamente no momento do fechamento.",
    nextDayAmount: "Valor em dinheiro que será mantido para o início do próximo caixa.",
    notes: "Adicione observações ou comentários sobre o fechamento, especialmente se houver diferenças.",
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Realize a contagem do dinheiro físico em caixa para realizar o fechamento.
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-50 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Valor Esperado:</span>
          <span className="text-lg font-semibold text-gray-900">R$ {expectedAmount.toFixed(2)}</span>
        </div>
      </div>
      
      <div>
        <div className="flex items-center">
          <label htmlFor="counted-cash" className="block text-sm font-medium text-gray-700 mb-1">
            Dinheiro em Caixa (Contagem Física)
          </label>
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              {tooltips.countedCash}
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
            id="counted-cash"
            {...register('countedCash', { valueAsNumber: true })}
            className="h-10 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="0.00"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">BRL</span>
          </div>
        </div>
        {errors.countedCash && (
          <p className="mt-1 text-sm text-red-600">{errors.countedCash.message}</p>
        )}

        {hasDifference && (
          <div className={`mt-2 p-2 rounded-md ${difference > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center">
              {difference > 0 
                ? <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> 
                : <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
              <span className={`text-sm ${difference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {difference > 0 
                  ? `Sobra de R$ ${difference.toFixed(2)}` 
                  : `Falta de R$ ${Math.abs(difference).toFixed(2)}`}
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center">
          <label htmlFor="next-day-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Valor para Próximo Dia
          </label>
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              {tooltips.nextDayAmount}
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
            id="next-day-amount"
            {...register('nextDayAmount', { valueAsNumber: true })}
            className="h-10 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="0.00"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">BRL</span>
          </div>
        </div>
        {errors.nextDayAmount && (
          <p className="mt-1 text-sm text-red-600">{errors.nextDayAmount.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Este valor será separado e usado como valor inicial para o próximo caixa.
        </p>
      </div>

      <div>
        <div className="flex items-center">
          <label htmlFor="close-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Observações (opcional)
          </label>
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              {tooltips.notes}
            </span>
          </div>
        </div>
        <textarea
          id="close-notes"
          {...register('notes')}
          rows={3}
          className="block w-full sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          placeholder="Informações adicionais sobre o fechamento do caixa..."
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
        )}
      </div>

      {confirmDifference && hasDifference && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Atenção: Diferença no Caixa</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Existe uma diferença de {difference > 0 
                    ? `R$ ${difference.toFixed(2)} a mais` 
                    : `R$ ${Math.abs(difference).toFixed(2)} a menos`} no caixa.
                </p>
                <p className="mt-1">
                  Tem certeza que deseja fechar o caixa com esta diferença?
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
            confirmDifference && hasDifference
              ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
              : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50`}
        >
          {isSubmitting 
            ? 'Fechando...' 
            : (confirmDifference && hasDifference)
              ? 'Confirmar Fechamento com Diferença'
              : 'Fechar Caixa'}
        </button>
      </div>
    </form>
  );
}