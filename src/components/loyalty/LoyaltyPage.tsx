import React, { useState } from 'react';
import { LoyaltyPlanList } from './LoyaltyPlanList';
import { LoyaltySubscriptionList } from './LoyaltySubscriptionList';
import { LoyaltyServiceUsageReport } from './LoyaltyServiceUsageReport';
import { Crown, Users, Bug, BarChart } from 'lucide-react';
import { AsaasDebugPanel } from './AsaasDebugPanel';
import { useAuth } from '../../lib/auth';

type Tab = 'plans' | 'subscriptions' | 'reports';

export function LoyaltyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const { profile } = useAuth();
  const [showDebug, setShowDebug] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="sm:hidden">
        <label htmlFor="tabs" className="sr-only">
          Selecione uma aba
        </label>
        <select
          id="tabs"
          name="tabs"
          className="block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as Tab)}
        >
          <option value="plans">Planos</option>
          <option value="subscriptions">Assinaturas</option>
          <option value="reports">Relatórios</option>
        </select>
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('plans')}
              className={`${
                activeTab === 'plans'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Crown className="h-5 w-5 mr-2" />
              Planos
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`${
                activeTab === 'subscriptions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Users className="h-5 w-5 mr-2" />
              Assinaturas
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`${
                activeTab === 'reports'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <BarChart className="h-5 w-5 mr-2" />
              Relatórios
            </button>
          </nav>
        </div>
      </div>

      <div>
        {activeTab === 'plans' ? (
          <LoyaltyPlanList />
        ) : activeTab === 'subscriptions' ? (
          <LoyaltySubscriptionList />
        ) : (
          <LoyaltyServiceUsageReport />
        )}
      </div>
      {profile?.role === 'admin' && (
        <>
          {showDebug ? (
            <AsaasDebugPanel onClose={() => setShowDebug(false)} />
          ) : (
            <button
              onClick={() => setShowDebug(true)}
              className="fixed bottom-4 right-4 bg-gray-900 text-white p-2 rounded-full shadow-lg hover:bg-gray-800 flex items-center space-x-2"
              title="Abrir painel de debug do Asaas"
            >
              <Bug className="h-6 w-6" />
            </button>
          )}
        </>
      )}
    </div>
  );
}