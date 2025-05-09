import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProducts } from '../../lib/products';
import { useInventory, type AdjustmentReasonCode } from '../../lib/inventory';
import { ArrowLeft, Plus, Minus, AlertTriangle, Truck, Package, Info, History, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Schema for stock adjustments
const adjustmentSchema = z.object({
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero'),
  reason_code: z.enum(['damaged', 'expired', 'lost', 'found', 'correction', 'other']),
  notes: z.string().min(3, 'Adicione uma observação (mínimo 3 caracteres)'),
});

// Schema for purchase (stock add)
const purchaseSchema = z.object({
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero'),
  cost_price: z.number().min(0, 'Custo deve ser maior ou igual a zero'),
  batch_number: z.string().min(1, 'Número do lote é obrigatório'),
  expiration_date: z.string().optional(),
  manufacturing_date: z.string().optional(),
  purchase_date: z.string().transform(str => str || format(new Date(), 'yyyy-MM-dd')),
  notes: z.string().optional(),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;
type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface ProductStockManagementProps {
  productId: string;
  onClose: () => void;
}

export function ProductStockManagement({ productId, onClose }: ProductStockManagementProps) {
  const { products, fetchProducts } = useProducts();
  const { 
    createAdjustment, 
    recordTransaction, 
    fetchTransactions, 
    transactions,
    error: inventoryError,
    createBatch
  } = useInventory();
  
  const [activeForm, setActiveForm] = useState<'purchase' | 'adjustment' | null>(null);
  const [isAddingStock, setIsAddingStock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    
    try {
      await fetchProducts();
      await fetchTransactions(productId, 10);
      setLoadError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 
        'Erro ao carregar dados. Verifique sua conexão com a internet e tente novamente.';
      setLoadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts, fetchTransactions, productId]);

  useEffect(() => {
    loadData();
  }, [loadData, retryCount]);

  // Handle inventory errors by retrying automatically
  useEffect(() => {
    if (inventoryError) {
      const timeoutId = setTimeout(() => {
        // Auto-retry up to 3 times with increasing delays
        if (retryCount < 3) {
          console.log(`Auto-retrying data load (attempt ${retryCount + 1})`);
          setRetryCount(prev => prev + 1);
        } else {
          setLoadError(inventoryError);
        }
      }, 2000 * Math.pow(2, retryCount));
      
      return () => clearTimeout(timeoutId);
    }
  }, [inventoryError, retryCount]);

  const product = products.find(p => p.id === productId);

  const {
    register: registerAdjustment,
    handleSubmit: handleSubmitAdjustment,
    formState: { errors: adjustmentErrors },
    reset: resetAdjustment
  } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      quantity: 1,
      reason_code: 'correction',
      notes: '',
    }
  });

  const {
    register: registerPurchase,
    handleSubmit: handleSubmitPurchase,
    formState: { errors: purchaseErrors },
    reset: resetPurchase,
    setValue: setPurchaseValue
  } = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      quantity: 1,
      cost_price: product?.cost_price || product?.price ? product.price * 0.6 : 0,
      batch_number: `BATCH-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      notes: 'Compra de estoque',
    }
  });

  // Set form defaults when product changes
  useEffect(() => {
    if (product) {
      setPurchaseValue('cost_price', product.cost_price || product.price * 0.6);
    }
  }, [product, setPurchaseValue]);

  const handleAdjustment = async (data: AdjustmentFormData) => {
    if (!product) return;
    
    setIsSubmitting(true);
    try {
      // If removing stock, make quantity negative
      const adjustmentQuantity = isAddingStock ? data.quantity : -data.quantity;
      
      // Check if we have enough stock for removal
      if (adjustmentQuantity < 0 && Math.abs(adjustmentQuantity) > product.stock_quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock_quantity}`);
      }
      
      await createAdjustment(
        productId,
        adjustmentQuantity,
        data.reason_code as AdjustmentReasonCode,
        data.notes
      );
      
      resetAdjustment();
      setActiveForm(null);
      await fetchProducts();
      await fetchTransactions(productId, 10);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao ajustar estoque';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurchase = async (data: PurchaseFormData) => {
    if (!product) return;
    
    setIsSubmitting(true);
    try {
      // Create batch first
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
      
      // Update product cost price if needed
      if (data.cost_price && (!product.cost_price || product.cost_price !== data.cost_price)) {
        await useProducts.getState().updateProduct(productId, { cost_price: data.cost_price });
      }
      
      resetPurchase();
      setActiveForm(null);
      await fetchProducts();
      await fetchTransactions(productId, 10);
    } catch (error) {
      console.error('Error recording purchase:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar compra';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonCodeLabel = (code: string): string => {
    const labels: Record<string, string> = {
      'damaged': 'Danificado',
      'expired': 'Expirado',
      'lost': 'Perdido',
      'found': 'Encontrado',
      'correction': 'Correção de inventário',
      'other': 'Outro'
    };
    return labels[code] || code;
  };
  
  const getTransactionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'purchase': 'Compra',
      'sale': 'Venda',
      'adjustment': 'Ajuste',
      'return': 'Devolução',
      'transfer': 'Transferência',
      'loss': 'Perda'
    };
    return labels[type] || type;
  };

  const handleRetry = () => {
    setRetryCount(0); // Reset retry count
    loadData();
    toast.success('Tentando reconectar ao banco de dados...');
  };

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
            Gerenciamento de Estoque{product ? `: ${product.name}` : ''}
          </h2>
        </div>
        <div>
          <button
            onClick={() => {
              resetPurchase();
              setActiveForm('purchase');
            }}
            className="flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            <Truck className="h-4 w-4 mr-2" />
            Registrar Compra
          </button>
        </div>
      </div>

      {/* Loading or Error State */}
      {isLoading && (
        <div className="p-6 flex justify-center items-center">
          <div className="animate-spin mr-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-gray-600">Carregando dados...</span>
        </div>
      )}

      {loadError && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erro de conexão</h3>
                <p className="mt-1 text-sm text-red-700">{loadError}</p>
                <button 
                  onClick={handleRetry}
                  className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Info */}
      {!isLoading && !loadError && product && (
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-4 border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-gray-500">Produto</div>
              <div className="mt-1 text-2xl font-semibold">{product.name}</div>
              <div className="mt-2 text-sm text-gray-500">SKU: {product.sku || 'N/A'}</div>
              <div className="mt-1 text-sm text-gray-500">
                Categoria: {product.category?.name || 'Sem categoria'}
              </div>
            </div>

            <div className="bg-white p-4 border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-gray-500">Estoque Atual</div>
              <div className="mt-1 text-2xl font-semibold">{product.stock_quantity} unid.</div>
              <div className={`mt-2 text-sm ${product.stock_quantity <= product.min_stock_alert ? 'text-red-600 font-medium' : 'text-gray-500'} flex items-center`}>
                {product.stock_quantity <= product.min_stock_alert && (
                  <AlertTriangle className="h-4 w-4 mr-1 text-red-600" />
                )}
                Alerta mínimo: {product.min_stock_alert}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Ponto de reposição: {product.reorder_point || product.min_stock_alert * 2}
              </div>
            </div>

            <div className="bg-white p-4 border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-gray-500">Última Compra</div>
              <div className="mt-1 text-2xl font-semibold">
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

      {/* Forms */}
      {!isLoading && !loadError && (
        <div className="p-6">
          {activeForm === 'adjustment' && (
            <div className="bg-gray-50 border rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {isAddingStock ? 'Adicionar Estoque' : 'Reduzir Estoque'}
              </h3>
              <form onSubmit={handleSubmitAdjustment(handleAdjustment)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      {...registerAdjustment('quantity', { valueAsNumber: true })}
                      className="form-input"
                    />
                    {adjustmentErrors.quantity && (
                      <p className="mt-1 text-sm text-red-600">{adjustmentErrors.quantity.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                    <select
                      {...registerAdjustment('reason_code')}
                      className="form-select"
                    >
                      {isAddingStock ? (
                        <>
                          <option value="found">Encontrado em inventário</option>
                          <option value="correction">Correção de inventário</option>
                          <option value="other">Outro</option>
                        </>
                      ) : (
                        <>
                          <option value="damaged">Produto danificado</option>
                          <option value="expired">Produto expirado</option>
                          <option value="lost">Produto perdido</option>
                          <option value="correction">Correção de inventário</option>
                          <option value="other">Outro</option>
                        </>
                      )}
                    </select>
                    {adjustmentErrors.reason_code && (
                      <p className="mt-1 text-sm text-red-600">{adjustmentErrors.reason_code.message}</p>
                    )}
                  </div>
                  
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      {...registerAdjustment('notes')}
                      rows={2}
                      className="form-textarea"
                      placeholder="Detalhes sobre o ajuste de estoque..."
                    />
                    {adjustmentErrors.notes && (
                      <p className="mt-1 text-sm text-red-600">{adjustmentErrors.notes.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveForm(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isAddingStock ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    } disabled:opacity-50`}
                  >
                    {isSubmitting ? 'Processando...' : isAddingStock ? 'Adicionar Estoque' : 'Reduzir Estoque'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeForm === 'purchase' && (
            <div className="bg-gray-50 border rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Registrar Compra de Estoque</h3>
              <form onSubmit={handleSubmitPurchase(handlePurchase)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      {...registerPurchase('quantity', { valueAsNumber: true })}
                      className="form-input"
                    />
                    {purchaseErrors.quantity && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.quantity.message}</p>
                    )}
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
                        {...registerPurchase('cost_price', { valueAsNumber: true })}
                        className="form-input pl-12"
                      />
                    </div>
                    {purchaseErrors.cost_price && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.cost_price.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Lote</label>
                    <input
                      type="text"
                      {...registerPurchase('batch_number')}
                      className="form-input"
                    />
                    {purchaseErrors.batch_number && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.batch_number.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Fabricação</label>
                    <input
                      type="date"
                      {...registerPurchase('manufacturing_date')}
                      className="form-input"
                    />
                    {purchaseErrors.manufacturing_date && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.manufacturing_date.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Validade</label>
                    <input
                      type="date"
                      {...registerPurchase('expiration_date')}
                      className="form-input"
                    />
                    {purchaseErrors.expiration_date && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.expiration_date.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data da Compra</label>
                    <input
                      type="date"
                      {...registerPurchase('purchase_date')}
                      className="form-input"
                      defaultValue={format(new Date(), 'yyyy-MM-dd')}
                    />
                    {purchaseErrors.purchase_date && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.purchase_date.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      {...registerPurchase('notes')}
                      rows={2}
                      className="form-textarea"
                      placeholder="Informações sobre a compra, fornecedor, etc..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveForm(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processando...' : 'Registrar Compra'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Quick action buttons when no form is active */}
          {!activeForm && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => {
                  resetAdjustment();
                  setIsAddingStock(true);
                  setActiveForm('adjustment');
                }}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Estoque
              </button>
              
              <button
                onClick={() => {
                  resetAdjustment();
                  setIsAddingStock(false);
                  setActiveForm('adjustment');
                }}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                disabled={!product || product.stock_quantity <= 0}
              >
                <Minus className="h-4 w-4 mr-2" />
                Reduzir Estoque
              </button>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Transações Recentes</h3>
              {!isLoading && (
                <button 
                  onClick={handleRetry} 
                  className="inline-flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Atualizar
                </button>
              )}
            </div>
            
            {!isLoading && transactions.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-md flex items-center justify-center">
                <Info className="h-5 w-5 text-gray-400 mr-2" />
                <p className="text-gray-600">Nenhuma transação encontrada para este produto.</p>
              </div>
            ) : !isLoading && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantidade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Anterior
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estoque Atual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.filter(t => t.product_id === productId).map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.transaction_type === 'purchase' || transaction.transaction_type === 'return'
                              ? 'bg-green-100 text-green-800'
                              : transaction.transaction_type === 'sale'
                              ? 'bg-blue-100 text-blue-800'
                              : transaction.transaction_type === 'adjustment' && transaction.quantity > 0
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {getTransactionTypeLabel(transaction.transaction_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.previous_quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.new_quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {transaction.notes || '—'}
                        </td>
                      </tr>
                    ))}
                    {transactions.filter(t => t.product_id === productId).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          Nenhuma transação para este produto
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}