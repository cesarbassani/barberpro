import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  type: z.enum(['service', 'product', 'both'], {
    required_error: 'Tipo é obrigatório',
    invalid_type_error: 'Tipo inválido',
  }),
  active: z.boolean().default(true),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    type: 'service' | 'product' | 'both';
    active: boolean;
  };
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
}

export function CategoryForm({ initialData, onSubmit, onCancel }: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: initialData || {
      active: true,
      type: 'both',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="form-group">
        <label htmlFor="category-name" className="form-label">
          Nome da Categoria
        </label>
        <input
          type="text"
          id="category-name"
          {...register('name')}
          className="form-input"
        />
        {errors.name && (
          <p className="form-error">{errors.name.message}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="category-type" className="form-label">
          Tipo
        </label>
        <select
          id="category-type"
          {...register('type')}
          className="form-select"
        >
          <option value="service">Serviços</option>
          <option value="product">Produtos</option>
          <option value="both">Ambos</option>
        </select>
        {errors.type && (
          <p className="form-error">{errors.type.message}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="category-description" className="form-label">
          Descrição
        </label>
        <textarea
          id="category-description"
          {...register('description')}
          rows={3}
          className="form-textarea"
        />
        {errors.description && (
          <p className="form-error">{errors.description.message}</p>
        )}
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="category-active"
          {...register('active')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="category-active" className="ml-2 block text-sm text-gray-900">
          Categoria ativa
        </label>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          title="Cancelar e fechar formulário"
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          title={initialData ? "Salvar alterações na categoria" : "Criar nova categoria"}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}