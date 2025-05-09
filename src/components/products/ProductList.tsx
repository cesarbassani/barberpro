import React, { useState } from 'react';
import { Package, Edit2, ToggleLeft, ToggleRight, Plus, AlertTriangle, Truck, FileText, History } from 'lucide-react';
import { useProducts } from '../../lib/products';
import { ProductForm } from './ProductForm';
import { ProductStockManagement } from './ProductStockManagement';
import { ProductBatchList } from './ProductBatchList';
import { InventoryTransactionHistory } from './InventoryTransactionHistory';
import type { Product } from '../../types/database';

export function ProductList() {
  const { 
    products,
    isLoading, 
    error, 
    fetchProducts,
    createProduct, 
    updateProduct, 
    toggleProductStatus
  } = useProducts();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'stock' | 'batches' | 'transactions'>('products');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreateProduct = async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    await createProduct(data);
    setIsFormOpen(false);
  };

  const handleUpdateProduct = async (data: Partial<Product>) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, data);
      setEditingProduct(null);
    }
  };

  const handleSelectProduct = (productId: string, tab: 'stock' | 'batches' | 'transactions') => {
    setSelectedProductId(productId);
    setActiveTab(tab);
  };

  if (isLoading && !isFormOpen && !editingProduct) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Produtos</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </button>
      </div>

      {(isFormOpen || editingProduct) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </h3>
            <ProductForm
              initialData={editingProduct || undefined}
              onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingProduct(null);
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-3 sm:px-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Lista de Produtos</h3>
          </div>
          {/* Product Groups by Category */}
          {Object.entries(groupProductsByCategory(products)).map(([categoryName, categoryProducts]) => (
            <div key={categoryName} className="border-b border-gray-200 last:border-b-0">
              <div className="bg-gray-50 px-4 py-3 flex items-center">
                <Package className="h-5 w-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">{categoryName}</h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {categoryProducts.map((product) => (
                  <li key={product.id}>
                    <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-primary-600" />
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                          <p className="text-sm text-gray-500">{product.description}</p>
                          <div className="mt-1 flex items-center text-sm text-gray-500">
                            <span>R$ {product.price.toFixed(2)}</span>
                            <span className="mx-2">•</span>
                            <span className={`flex items-center ${product.stock_quantity <= product.min_stock_alert ? 'text-red-600' : 'text-gray-600'}`}>
                              {product.stock_quantity <= product.min_stock_alert && (
                                <AlertTriangle className="h-4 w-4 mr-1 text-red-600" />
                              )}
                              Estoque: {product.stock_quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleSelectProduct(product.id, 'stock')}
                          title="Gerenciar estoque"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Truck className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleSelectProduct(product.id, 'batches')}
                          title="Gerenciar lotes"
                          className="text-purple-600 hover:text-purple-900"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleSelectProduct(product.id, 'transactions')}
                          title="Ver histórico de transações"
                          className="text-green-600 hover:text-green-900"
                        >
                          <History className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setEditingProduct(product)}
                          title="Editar este produto"
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => toggleProductStatus(product.id)}
                          title={product.active ? "Desativar produto" : "Ativar produto"}
                          className={product.active ? 'text-green-600' : 'text-gray-400'}
                        >
                          {product.active ? (
                            <ToggleRight className="h-6 w-6" />
                          ) : (
                            <ToggleLeft className="h-6 w-6" />
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
                {categoryProducts.length === 0 && (
                  <li className="px-4 py-6 text-center text-gray-500">
                    Nenhum produto nesta categoria
                  </li>
                )}
              </ul>
            </div>
          ))}
          {products.length === 0 && (
            <div className="p-6 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum produto cadastrado</h3>
              <p className="mt-2 text-gray-500">Comece adicionando um novo produto ao seu catálogo.</p>
              <button
                onClick={() => setIsFormOpen(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stock' && selectedProductId && (
        <ProductStockManagement productId={selectedProductId} onClose={() => setActiveTab('products')} />
      )}

      {activeTab === 'batches' && selectedProductId && (
        <ProductBatchList productId={selectedProductId} onClose={() => setActiveTab('products')} />
      )}

      {activeTab === 'transactions' && (
        <InventoryTransactionHistory productId={selectedProductId} />
      )}
    </div>
  );
}

// Helper function to group products by category
function groupProductsByCategory(products: Product[]) {
  return products.reduce((acc, product) => {
    const categoryName = product.category?.name || 'Sem categoria';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(product);
    return acc;
  }, {} as Record<string, Product[]>);
}