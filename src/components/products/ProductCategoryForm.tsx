import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
  };
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
}

export function ProductCategoryForm({ initialData, onSubmit, onCancel }: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: initialData || {
      active: true,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nome da Categoria
        </label>
        <input
          type="text"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Descrição
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('active')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
          Categoria ativa
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