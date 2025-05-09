import React, { useState } from 'react';
import { useServices } from '../../lib/services';
import { useLoyalty } from '../../lib/loyalty';
import { Plus, Trash2 } from 'lucide-react';
import type { LoyaltyPlan, Service } from '../../types/database';

interface LoyaltyPlanServiceFormProps {
  plan: LoyaltyPlan;
  onClose: () => void;
}

export function LoyaltyPlanServiceForm({ plan, onClose }: LoyaltyPlanServiceFormProps) {
  const { services, fetchServices } = useServices();
  const { addServiceToPlan, removeServiceFromPlan } = useLoyalty();
  const [selectedService, setSelectedService] = useState<string>('');
  const [usesPerMonth, setUsesPerMonth] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleAddService = async () => {
    if (!selectedService) return;

    setIsSubmitting(true);
    try {
      await addServiceToPlan(plan.id, selectedService, usesPerMonth);
      setSelectedService('');
      setUsesPerMonth(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    setIsSubmitting(true);
    try {
      await removeServiceFromPlan(plan.id, serviceId);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get services already in the plan
  const planServices = (plan as any).loyalty_plan_services || [];
  const availableServices = services.filter(
    service => !planServices.some((ps: any) => ps.service_id === service.id)
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="service-select" className="block text-sm font-medium text-gray-700">
            Adicionar Serviço
          </label>
          <div className="mt-1 grid grid-cols-2 gap-4">
            <select
              id="service-select"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Selecione um serviço</option>
              {availableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>

            <div>
              <label htmlFor="uses-per-month" className="block text-sm font-medium text-gray-700">
                Usos por Mês
              </label>
              <input
                type="number"
                id="uses-per-month"
                min="1"
                value={usesPerMonth}
                onChange={(e) => setUsesPerMonth(parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleAddService}
          disabled={!selectedService || isSubmitting}
          className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-medium text-gray-900">Serviços Inclusos</h4>
        <ul className="mt-4 divide-y divide-gray-200">
          {planServices?.map((ps: any) => (
            <li key={ps.id} className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {ps.service?.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {ps.uses_per_month}x por mês
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveService(ps.service_id)}
                  disabled={isSubmitting}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
          {!planServices?.length && (
            <li className="py-4 text-center text-gray-500">
              Nenhum serviço incluso neste plano
            </li>
          )}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}