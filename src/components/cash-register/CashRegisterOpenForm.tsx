import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, AlertCircle, HelpCircle } from 'lucide-react';

const formSchema = z.object({
  initialAmount: z.number().min(0, 'O valor inicial não pode ser negativo'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CashRegisterOpenFormProps {
  onSubmit: (initialAmount: number) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CashRegisterOpenForm({ onSubmit, onCancel, isSubmitting = false }: CashRegisterOpenFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      initialAmount: 0,
      notes: '',
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit(data.initialAmount);
  };

  const tooltips = {
    initialAmount: "Informe o valor em dinheiro físico que está sendo colocado no caixa para iniciar as operações.",
    notes: "Adicione observações ou informações relevantes sobre a abertura deste caixa."
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Informe o valor em dinheiro que está sendo utilizado para iniciar o caixa.
            </p>
          </div>
        </div>
      </div>
      
      <div>
        <div className="flex items-center">
          <label htmlFor="initial-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Valor Inicial (R$)
          </label>
          <div className="tooltip ml-1">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="tooltiptext">
              {tooltips.initialAmount}
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
            id="initial-amount"
            {...register('initialAmount', { valueAsNumber: true })}
            className="h-10 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="0.00"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">BRL</span>
          </div>
        </div>
        {errors.initialAmount && (
          <p className="mt-1 text-sm text-red-600">{errors.initialAmount.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-center">
          <label htmlFor="open-notes" className="block text-sm font-medium text-gray-700 mb-1">
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
          id="open-notes"
          {...register('notes')}
          rows={3}
          className="block w-full sm:text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          placeholder="Informações adicionais sobre a abertura do caixa..."
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
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
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Abrindo...' : 'Abrir Caixa'}
        </button>
      </div>
    </form>
  );
}