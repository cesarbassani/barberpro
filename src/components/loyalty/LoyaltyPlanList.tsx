import React, { useState } from 'react';
import { useLoyalty } from '../../lib/loyalty';
import { useServices } from '../../lib/services';
import { Crown, Edit2, ToggleLeft, ToggleRight, Plus, Trash2, Star } from 'lucide-react';
import { LoyaltyPlanForm } from './LoyaltyPlanForm';
import { LoyaltyPlanServiceForm } from './LoyaltyPlanServiceForm';
import type { LoyaltyPlan } from '../../types/database';

export function LoyaltyPlanList() {
  const { plans, isLoading, error, fetchPlans, createPlan, updatePlan, togglePlanStatus } = useLoyalty();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LoyaltyPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<LoyaltyPlan | null>(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);

  React.useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreatePlan = async (data: Omit<LoyaltyPlan, 'id' | 'created_at' | 'updated_at'>) => {
    await createPlan(data);
    setIsFormOpen(false);
  };

  const handleUpdatePlan = async (data: Partial<LoyaltyPlan>) => {
    if (editingPlan) {
      await updatePlan(editingPlan.id, data);
      setEditingPlan(null);
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
        <h2 className="text-2xl font-bold text-gray-900">Planos de Fidelidade</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          title="Criar novo plano"
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </button>
      </div>

      {(isFormOpen || editingPlan) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </h3>
            <LoyaltyPlanForm
              initialData={editingPlan || undefined}
              onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingPlan(null);
              }}
            />
          </div>
        </div>
      )}

      {isServiceFormOpen && selectedPlan && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Gerenciar Serviços do Plano
            </h3>
            <LoyaltyPlanServiceForm
              plan={selectedPlan}
              onClose={() => {
                setIsServiceFormOpen(false);
                setSelectedPlan(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {plans?.map((plan) => (
            <li key={plan.id}>
              <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                <div className="flex items-center">
                  <Crown className="h-5 w-5 text-primary-600" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500">{plan.description}</p>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span>R$ {plan.monthly_price.toFixed(2)}/mês</span>
                      <span className="mx-2">•</span>
                      <span>{plan.product_discount_percentage}% em produtos</span>
                      <span className="mx-2">•</span>
                      <span>{plan.service_discount_percentage}% em serviços</span>
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          setSelectedPlan(plan);
                          setIsServiceFormOpen(true);
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Gerenciar Serviços
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setEditingPlan(plan)}
                    title="Editar este plano"
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => togglePlanStatus(plan.id)}
                    title={plan.active ? "Desativar plano" : "Ativar plano"}
                    className={plan.active ? 'text-green-600' : 'text-gray-400'}
                  >
                    {plan.active ? (
                      <ToggleRight className="h-6 w-6" />
                    ) : (
                      <ToggleLeft className="h-6 w-6" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
          {!plans?.length && (
            <li className="px-4 py-6 text-center text-gray-500">
              Nenhum plano cadastrado
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}