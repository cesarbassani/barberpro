import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useServices } from '../../lib/services';
import type { Service } from '../../types/database';

const serviceSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  duration: z.string().regex(/^\d{2}:\d{2}$/, 'Duração deve estar no formato HH:MM'),
  price: z.number().min(0, 'Preço deve ser maior que zero'),
  category_id: z.string().uuid('Categoria é obrigatória'),
  active: z.boolean().default(true),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  initialData?: Service;
  onSubmit: (data: ServiceFormData) => Promise<void>;
  onCancel: () => void;
}

export function ServiceForm({ initialData, onSubmit, onCancel }: ServiceFormProps) {
  const { categories, fetchCategories } = useServices();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: initialData || {
      active: true,
      duration: '00:30',
      price: 0
    },
  });

  // Reset form when initialData changes
  React.useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ServiceFormData) => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      setFormError(null);
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting service form:', error);
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar serviço');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {formError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{formError}</h3>
            </div>
          </div>
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="service-name" className="form-label">
          Nome do Serviço
        </label>
        <input
          type="text"
          id="service-name"
          {...register('name')}
          className="form-input"
        />
        {errors.name && (
          <p className="form-error">{errors.name.message}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="service-category" className="form-label">
          Categoria
        </label>
        <select
          id="service-category"
          {...register('category_id')}
          className="form-select"
        >
          <option value="">Selecione uma categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.category_id && (
          <p className="form-error">{errors.category_id.message}</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="service-description" className="form-label">
          Descrição
        </label>
        <textarea
          id="service-description"
          {...register('description')}
          rows={3}
          className="form-textarea"
        />
        {errors.description && (
          <p className="form-error">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="service-duration" className="form-label">
            Duração (HH:MM)
          </label>
          <input
            type="text"
            id="service-duration"
            {...register('duration')}
            placeholder="00:30"
            className="form-input"
          />
          {errors.duration && (
            <p className="form-error">{errors.duration.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="service-price" className="form-label">
            Preço
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">R$</span>
            </div>
            <input
              type="number"
              step="0.01"
              id="service-price"
              {...register('price', { valueAsNumber: true })}
              className="form-input pl-12"
            />
          </div>
          {errors.price && (
            <p className="form-error">{errors.price.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="service-active"
          {...register('active')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="service-active" className="ml-2 block text-sm text-gray-900">
          Serviço ativo
        </label>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}