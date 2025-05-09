import React, { useState } from 'react';
import { Tag, Edit2, ToggleLeft, ToggleRight, Plus, Trash2 } from 'lucide-react';
import { useCategories } from '../../lib/categories';
import { CategoryForm } from './CategoryForm';
import { useProducts } from '../../lib/products';

interface Category {
  id: string;
  name: string;
  description: string | null;
  type: 'service' | 'product' | 'both';
  active: boolean;
}

export function CategoryList() {
  const { categories, isLoading, error, fetchCategories, createCategory, updateCategory, toggleCategoryStatus, deleteCategory } = useCategories();
  const { products, fetchProducts } = useProducts();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  React.useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const handleCreateCategory = async (data: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
    await createCategory(data);
    setIsFormOpen(false);
  };

  const handleUpdateCategory = async (data: Partial<Category>) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, data);
      setEditingCategory(null);
    }
  };

  const checkCategoryDependencies = (categoryId: string) => {
    const associatedProducts = products.filter(product => product.category_id === categoryId);
    return associatedProducts.length > 0 ? associatedProducts : null;
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const associatedProducts = checkCategoryDependencies(id);
      if (associatedProducts) {
        setDeleteError(`Não é possível excluir esta categoria pois existem ${associatedProducts.length} produto(s) associado(s). Por favor, remova ou reatribua os produtos antes de excluir a categoria.`);
        return;
      }

      await deleteCategory(id);
      setIsConfirmingDelete(null);
      setDeleteError(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      setDeleteError('Ocorreu um erro ao tentar excluir a categoria. Por favor, tente novamente.');
    }
  };

  if (isLoading) {
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
        <h2 className="text-2xl font-bold text-gray-900">Categorias</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          title="Criar nova categoria"
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </button>
      </div>

      {(isFormOpen || editingCategory) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>
            <CategoryForm
              initialData={editingCategory || undefined}
              onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingCategory(null);
              }}
            />
          </div>
        </div>
      )}

      {isConfirmingDelete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar Exclusão
            </h3>
            {deleteError ? (
              <>
                <p className="text-sm text-red-600 mb-4">{deleteError}</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setIsConfirmingDelete(null);
                      setDeleteError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsConfirmingDelete(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(isConfirmingDelete)}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {categories.map((category) => (
            <li key={category.id}>
              <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                <div className="flex items-center">
                  <Tag className="h-5 w-5 text-primary-600" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-500">{category.description}</p>
                    )}
                    <div className="mt-1 flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        category.type === 'service' 
                          ? 'bg-blue-100 text-blue-800'
                          : category.type === 'product'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {category.type === 'service' 
                          ? 'Serviços'
                          : category.type === 'product'
                          ? 'Produtos'
                          : 'Ambos'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setEditingCategory(category)}
                    title="Editar esta categoria"
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => toggleCategoryStatus(category.id)}
                    title={category.active ? "Desativar categoria" : "Ativar categoria"}
                    className={category.active ? 'text-green-600' : 'text-gray-400'}
                  >
                    {category.active ? (
                      <ToggleRight className="h-6 w-6" />
                    ) : (
                      <ToggleLeft className="h-6 w-6" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(category.id)}
                    title="Excluir esta categoria"
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="px-4 py-6 text-center text-gray-500">
              Nenhuma categoria cadastrada
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}