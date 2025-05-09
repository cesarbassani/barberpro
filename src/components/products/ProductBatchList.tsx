import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProducts } from '../../lib/products';
import { useInventory, type ProductBatch } from '../../lib/inventory';
import { ArrowLeft, Plus, Edit2, Trash2, AlertTriangle, Package, Calendar, X, CheckCircle, WifiOff } from 'lucide-react';
import { format, isAfter, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

const batchSchema = z.object({
  batch_number: z.string().min(1, 'Número do lote é obrigatório'),
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero'),
  expiration_date: z.string().optional(),
  manufacturing_date: z.string().optional(),
  purchase_date: z.string().transform(str => str || format(new Date(), 'yyyy-MM-dd')),
  cost_price: z.number().min(0, 'Custo deve ser maior ou igual a zero'),
  notes: z.string().optional(),
});

type BatchFormData = z.infer<typeof batchSchema>;

interface ProductBatchListProps {
  productId: string;
  onClose: () => void;
}

export function ProductBatchList({ productId, onClose }: ProductBatchListProps) {
  const { products, fetchProducts } = useProducts();
  const { 
    batches,
    fetchBatches,
    createBatch,
    updateBatch,
    deleteBatch,
    isLoading
  } = useInventory();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'valid' | 'expired'>('all');

  const loadData = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      return;
    }

    try {
      await Promise.all([
        fetchProducts().catch(err => {
          console.error('Error fetching products:', err);
          toast.error('Erro ao carregar produtos. Verifique sua conexão e tente novamente.');
          throw err;
        }),
        fetchBatches(productId).catch(err => {
          console.error('Error fetching batches:', err);
          toast.error('Erro ao carregar lotes. Verifique sua conexão e tente novamente.');
          throw err;
        })
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [fetchProducts, fetchBatches, productId]);

  useEffect(() => {
    loadData();

    const handleOnline = () => {
      toast.success('Conexão restaurada! Recarregando dados...');
      loadData();
    };

    const handleOffline = () => {
      toast.error('Você está offline. Algumas funcionalidades podem não estar disponíveis.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  const product = products.find(p => p.id === productId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      batch_number: `BATCH-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      quantity: 1,
      cost_price: product?.cost_price || product?.price ? product.price * 0.6 : 0,
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  useEffect(() => {
    if (editingBatch) {
      setValue('batch_number', editingBatch.batch_number);
      setValue('quantity', editingBatch.quantity);
      setValue('expiration_date', editingBatch.expiration_date ? format(new Date(editingBatch.expiration_date), 'yyyy-MM-dd') : '');
      setValue('manufacturing_date', editingBatch.manufacturing_date ? format(new Date(editingBatch.manufacturing_date), 'yyyy-MM-dd') : '');
      setValue('purchase_date', editingBatch.purchase_date ? format(new Date(editingBatch.purchase_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setValue('cost_price', editingBatch.cost_price || 0);
      setValue('notes', editingBatch.notes || '');
    }
  }, [editingBatch, setValue]);

  useEffect(() => {
    if (product && !editingBatch) {
      setValue('cost_price', product.cost_price || product.price * 0.6);
    }
  }, [product, setValue, editingBatch]);

  const handleBatchSubmit = async (data: BatchFormData) => {
    if (!product) return;
    
    setIsSubmitting(true);
    try {
      if (editingBatch) {
        await updateBatch(editingBatch.id, {
          batch_number: data.batch_number,
          quantity: data.quantity,
          expiration_date: data.expiration_date || null,
          manufacturing_date: data.manufacturing_date || null,
          purchase_date: data.purchase_date || null,
          cost_price: data.cost_price,
          notes: data.notes || null
        });
      } else {
        await createBatch({
          product_id: productId,
          batch_number: data.batch_number,
          quantity: data.quantity,
          expiration_date: data.expiration_date || null,
          manufacturing_date: data.manufacturing_date || null,
          purchase_date: data.purchase_date || null,
          cost_price: data.cost_price,
          is_active: true,
          notes: data.notes || null
        });
      }
      
      setIsFormOpen(false);
      setEditingBatch(null);
      reset({
        batch_number: `BATCH-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        quantity: 1,
        cost_price: product.cost_price || product.price * 0.6,
        purchase_date: format(new Date(), 'yyyy-MM-dd'),
      });
      
      await fetchBatches(productId);
      await fetchProducts();
    } catch (error) {
      console.error('Error submitting batch:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lote? Esta ação é irreversível.')) {
      await deleteBatch(batchId);
      await fetchBatches(productId);
    }
  };

  const filteredBatches = batches
    .filter(batch => {
      if (dateFilter === 'all') return true;
      if (!batch.expiration_date) return dateFilter === 'valid';
      
      const isExpired = isAfter(new Date(), new Date(batch.expiration_date));
      return dateFilter === 'expired' ? isExpired : !isExpired;
    })
    .filter(batch => batch.product_id === productId);

  if (!navigator.onLine) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center flex-col gap-4">
          <WifiOff className="h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Você está offline</h3>
          <p className="text-gray-500 text-center">
            Verifique sua conexão com a internet e tente novamente.
            <br />
            Os dados serão carregados automaticamente quando a conexão for restaurada.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <button
            onClick={onClose}
            className="mr-4 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            Gerenciamento de Lotes{product ? `: ${product.name}` : ''}
          </h2>
        </div>
        <div>
          <button
            onClick={() => {
              setEditingBatch(null);
              setIsFormOpen(true);
            }}
            className="flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Lote
          </button>
        </div>
      </div>

      {/* Product Info */}
      {product && (
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-4 border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-gray-500">Produto</div>
              <div className="mt-1 text-xl font-semibold">{product.name}</div>
              <div className="mt-2 text-sm text-gray-500">SKU: {product.sku || 'N/A'}</div>
              <div className="mt-1 text-sm text-gray-500">
                Categoria: {product.category?.name || 'Sem categoria'}
              </div>
            </div>

            <div className="bg-white p-4 border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-gray-500">Estoque Atual</div>
              <div className="mt-1 text-xl font-semibold">{product.stock_quantity} unid.</div>
              <div className={`mt-2 text-sm ${product.stock_quantity <= product.min_stock_alert ? 'text-red-600 font-medium' : 'text-gray-500'} flex items-center`}>
                {product.stock_quantity <= product.min_stock_alert && (
                  <AlertTriangle className="h-4 w-4 mr-1 text-red-600" />
                )}
                Alerta mínimo: {product.min_stock_alert}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Lotes ativos: {batches.filter(b => b.is_active && b.product_id === productId).length}
              </div>
            </div>

            <div className="bg-white p-4 border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-gray-500">Última Compra</div>
              <div className="mt-1 text-xl font-semibold">
                {product.last_restock_date ? format(new Date(product.last_restock_date), 'dd/MM/yyyy') : 'Nunca'}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Preço de custo: R$ {(product.cost_price || product.price * 0.6).toFixed(2)}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Valor em estoque: R$ {(product.stock_quantity * (product.cost_price || product.price * 0.6)).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingBatch ? 'Editar Lote' : 'Adicionar Lote'}
              </h3>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingBatch(null);
                  reset();
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(handleBatchSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Lote</label>
                  <input
                    type="text"
                    {...register('batch_number')}
                    className="form-input"
                  />
                  {errors.batch_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.batch_number.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    {...register('quantity', { valueAsNumber: true })}
                    className="form-input"
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Fabricação</label>
                  <input
                    type="date"
                    {...register('manufacturing_date')}
                    className="form-input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Validade</label>
                  <input
                    type="date"
                    {...register('expiration_date')}
                    className="form-input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data da Compra</label>
                  <input
                    type="date"
                    {...register('purchase_date')}
                    className="form-input"
                    defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('cost_price', { valueAsNumber: true })}
                      className="form-input pl-12"
                    />
                  </div>
                  {errors.cost_price && (
                    <p className="mt-1 text-sm text-red-600">{errors.cost_price.message}</p>
                  )}
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    className="form-textarea"
                    placeholder="Informações sobre o lote, fornecedor, etc..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingBatch(null);
                    reset();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingBatch ? 'Atualizar Lote' : 'Adicionar Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batches List */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <h3 className="text-lg font-medium text-gray-900">Lotes do Produto</h3>
            <div className="ml-4 flex items-center space-x-1">
              <span className="text-sm text-gray-500">Mostrar:</span>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-2 py-1 text-sm rounded-md ${
                  dateFilter === 'all' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setDateFilter('valid')}
                className={`px-2 py-1 text-sm rounded-md ${
                  dateFilter === 'valid' ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Válidos
              </button>
              <button
                onClick={() => setDateFilter('expired')}
                className={`px-2 py-1 text-sm rounded-md ${
                  dateFilter === 'expired' ? 'bg-red-100 text-red-800' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Vencidos
              </button>
            </div>
          </div>
          <span className="text-sm text-gray-500">
            {filteredBatches.length} {filteredBatches.length === 1 ? 'lote encontrado' : 'lotes encontrados'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="bg-gray-50 p-8 text-center rounded-lg border border-gray-200">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum lote encontrado</h3>
            <p className="mt-2 text-gray-500">
              {dateFilter === 'all' 
                ? 'Não há lotes cadastrados para este produto.' 
                : dateFilter === 'valid'
                ? 'Não há lotes válidos para este produto.'
                : 'Não há lotes vencidos para este produto.'}
            </p>
            <button
              onClick={() => {
                setEditingBatch(null);
                setIsFormOpen(true);
              }}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Lote
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lote
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fabricação
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Validade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Custo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBatches.map((batch) => {
                  const isExpired = batch.expiration_date && isAfter(new Date(), new Date(batch.expiration_date));
                  const isNearingExpiry = batch.expiration_date && !isExpired && 
                    isAfter(new Date(batch.expiration_date), new Date()) &&
                    isAfter(addMonths(new Date(), 3), new Date(batch.expiration_date));
                  
                  return (
                    <tr key={batch.id} className={isExpired ? 'bg-red-50' : isNearingExpiry ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {batch.batch_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.manufacturing_date 
                          ? format(new Date(batch.manufacturing_date), 'dd/MM/yyyy')
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {batch.expiration_date ? (
                          <span className={`flex items-center ${isExpired ? 'text-red-600' : isNearingExpiry ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {isExpired && <AlertTriangle className="h-4 w-4 mr-1" />}
                            {format(new Date(batch.expiration_date), 'dd/MM/yyyy')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.cost_price 
                          ? `R$ ${batch.cost_price.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isExpired
                            ? 'bg-red-100 text-red-800'
                            : isNearingExpiry
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {isExpired
                            ? 'Vencido'
                            : isNearingExpiry
                            ? 'Próximo ao vencimento'
                            : 'Válido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingBatch(batch);
                            setIsFormOpen(true);
                          }}
                          className="text-primary-600 hover:text-primary-900 mr-3"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}