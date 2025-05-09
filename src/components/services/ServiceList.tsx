import React, { useState } from 'react';
import { Scissors, Edit2, ToggleLeft, ToggleRight, Tag, Plus } from 'lucide-react';
import { useServices } from '../../lib/services';
import { ServiceForm } from './ServiceForm';
import type { Service } from '../../types/database';

export function ServiceList() {
  const { services, isLoading, error, fetchServices, createService, updateService, toggleServiceStatus } = useServices();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleCreateService = async (data: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
    await createService(data);
    setIsFormOpen(false);
  };

  const handleUpdateService = async (data: Partial<Service>) => {
    if (editingService) {
      await updateService(editingService.id, data);
      setEditingService(null);
    }
  };

  if (isLoading && !isFormOpen && !editingService) {
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

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const categoryName = service.category?.name || 'Sem categoria';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Serviços</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          title="Cadastrar novo serviço"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2 inline-block" />
          Novo Serviço
        </button>
      </div>

      {(isFormOpen || editingService) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingService ? 'Editar Serviço' : 'Novo Serviço'}
            </h3>
            <ServiceForm
              initialData={editingService || undefined}
              onSubmit={editingService ? handleUpdateService : handleCreateService}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingService(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {Object.entries(servicesByCategory).map(([categoryName, categoryServices]) => (
          <div key={categoryName} className="border-b border-gray-200 last:border-b-0">
            <div className="bg-gray-50 px-4 py-3 flex items-center">
              <Tag className="h-5 w-5 text-primary-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">{categoryName}</h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {categoryServices.map((service) => (
                <li key={service.id}>
                  <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                    <div className="flex items-center">
                      <Scissors className="h-5 w-5 text-primary-600" />
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">{service.name}</h3>
                        <p className="text-sm text-gray-500">{service.description}</p>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span>Duração: {service.duration}</span>
                          <span className="mx-2">•</span>
                          <span>R$ {service.price.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setEditingService(service)}
                        title="Editar este serviço"
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => toggleServiceStatus(service.id)}
                        title={service.active ? "Desativar serviço" : "Ativar serviço"}
                        className={service.active ? 'text-green-600' : 'text-gray-400'}
                      >
                        {service.active ? (
                          <ToggleRight className="h-6 w-6" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {categoryServices.length === 0 && (
                <li className="px-4 py-6 text-center text-gray-500">
                  Nenhum serviço nesta categoria
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}