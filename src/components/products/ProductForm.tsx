import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProducts } from '../../lib/products';
import type { Product } from '../../types/database';

const productSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  price: z.number().min(0, 'Preço deve ser maior que zero'),
  cost_price: z.number().min(0, 'Custo deve ser maior ou igual a zero').optional(),
  stock_quantity: z.number().min(0, 'Quantidade deve ser maior ou igual a zero'),
  min_stock_alert: z.number().min(1, 'Alerta mínimo deve ser maior que zero'),
  reorder_point: z.number().min(1, 'Ponto de reposição deve ser maior que zero').optional(),
  category_id: z.string().uuid('Categoria é obrigatória'),
  sku: z.string().optional(),
  active: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({ initialData, onSubmit, onCancel }: ProductFormProps) {
  const { categories, fetchCategories } = useProducts();
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
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      active: true,
      min_stock_alert: 5,
      reorder_point: 10,
      stock_quantity: 0,
      price: 0,
      cost_price: 0
    },
  });

  // Reset form when initialData changes
  React.useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ProductFormData) => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      setFormError(null);
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting product form:', error);
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar produto');
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
        <label htmlFor="product-name" className="form-label">
          Nome do Produto
        </label>
        <input
          type="text"
          id="product-name"
          {...register('name')}
          className="form-input"
        />
        {errors.name && (
          <p className="form-error">{errors.name.message}</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="product-sku" className="form-label">
            SKU (Código)
          </label>
          <input
            type="text"
            id="product-sku"
            {...register('sku')}
            className="form-input"
            placeholder="Código único do produto"
          />
        </div>

        <div className="form-group">
          <label htmlFor="product-category" className="form-label">
            Categoria
          </label>
          <select
            id="product-category"
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
      </div>

      <div className="form-group">
        <label htmlFor="product-description" className="form-label">
          Descrição
        </label>
        <textarea
          id="product-description"
          {...register('description')}
          rows={3}
          className="form-textarea"
        />
        {errors.description && (
          <p className="form-error">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="product-price" className="form-label">
            Preço de Venda
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">R$</span>
            </div>
            <input
              type="number"
              step="0.01"
              id="product-price"
              {...register('price', { valueAsNumber: true })}
              className="form-input pl-12"
              min={0}
            />
          </div>
          {errors.price && (
            <p className="form-error">{errors.price.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="product-cost" className="form-label">
            Preço de Custo
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">R$</span>
            </div>
            <input
              type="number"
              step="0.01"
              id="product-cost"
              {...register('cost_price', { valueAsNumber: true })}
              className="form-input pl-12"
              min={0}
            />
          </div>
          {errors.cost_price && (
            <p className="form-error">{errors.cost_price.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-group">
          <label htmlFor="product-stock" className="form-label">
            Quantidade em Estoque
          </label>
          <input
            type="number"
            id="product-stock"
            {...register('stock_quantity', { valueAsNumber: true })}
            className="form-input"
            min={0}
          />
          {errors.stock_quantity && (
            <p className="form-error">{errors.stock_quantity.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="product-alert" className="form-label">
            Alerta de Estoque Mínimo
          </label>
          <input
            type="number"
            id="product-alert"
            {...register('min_stock_alert', { valueAsNumber: true })}
            className="form-input"
            min={1}
          />
          {errors.min_stock_alert && (
            <p className="form-error">{errors.min_stock_alert.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="product-reorder" className="form-label">
            Ponto de Reposição
          </label>
          <input
            type="number"
            id="product-reorder"
            {...register('reorder_point', { valueAsNumber: true })}
            className="form-input"
            min={1}
          />
          {errors.reorder_point && (
            <p className="form-error">{errors.reorder_point.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Quantidade que dispara pedidos de reposição
          </p>
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="product-active"
          {...register('active')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="product-active" className="ml-2 block text-sm text-gray-900">
          Produto ativo
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