import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LoyaltyPlan } from '../../types/database';

const planSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  monthly_price: z.number().min(0, 'Preço deve ser maior ou igual a zero'),
  product_discount_percentage: z.number().min(0, 'Desconto deve ser maior ou igual a zero').max(100, 'Desconto não pode ser maior que 100%'),
  service_discount_percentage: z.number().min(0, 'Desconto deve ser maior ou igual a zero').max(100, 'Desconto não pode ser maior que 100%'),
  active: z.boolean().default(true),
});

type PlanFormData = z.infer<typeof planSchema>;

interface LoyaltyPlanFormProps {
  initialData?: LoyaltyPlan;
  onSubmit: (data: PlanFormData) => Promise<void>;
  onCancel: () => void;
}

export function LoyaltyPlanForm({ initialData, onSubmit, onCancel }: LoyaltyPlanFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: initialData || {
      active: true,
      product_discount_percentage: 0,
      service_discount_percentage: 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700">
          Nome do Plano
        </label>
        <input
          type="text"
          id="plan-name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="plan-description" className="block text-sm font-medium text-gray-700">
          Descrição
        </label>
        <textarea
          id="plan-description"
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="plan-price" className="block text-sm font-medium text-gray-700">
          Valor Mensal
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">R$</span>
          </div>
          <input
            type="number"
            step="0.01"
            id="plan-price"
            {...register('monthly_price', { valueAsNumber: true })}
            className="pl-12 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        {errors.monthly_price && (
          <p className="mt-1 text-sm text-red-600">{errors.monthly_price.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="product-discount" className="block text-sm font-medium text-gray-700">
            Desconto em Produtos (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            id="product-discount"
            {...register('product_discount_percentage', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          {errors.product_discount_percentage && (
            <p className="mt-1 text-sm text-red-600">{errors.product_discount_percentage.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="service-discount" className="block text-sm font-medium text-gray-700">
            Desconto em Serviços (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            id="service-discount"
            {...register('service_discount_percentage', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          {errors.service_discount_percentage && (
            <p className="mt-1 text-sm text-red-600">{errors.service_discount_percentage.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="plan-active"
          {...register('active')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="plan-active" className="ml-2 block text-sm text-gray-900">
          Plano ativo
        </label>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}