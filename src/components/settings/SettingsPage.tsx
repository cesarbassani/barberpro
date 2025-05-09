import React, { useState } from 'react';
import { Settings, Webhook, CreditCard, TabletSmartphone, CalendarClock, Bug } from 'lucide-react';
import { AsaasSettings } from './AsaasSettings';
import { N8nIntegrationPage } from './N8nIntegrationPage';
import { BusinessSettingsPage } from './BusinessSettingsPage';
import { ProductServiceDebugPanel } from '../products/ProductServiceDebugPanel';

type Tab = 'geral' | 'asaas' | 'n8n' | 'horarios' | 'debug';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('geral')}
            className={`${
              activeTab === 'geral'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Settings className="h-5 w-5 mr-2" />
            Geral
          </button>
          
          <button
            onClick={() => setActiveTab('horarios')}
            className={`${
              activeTab === 'horarios'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <CalendarClock className="h-5 w-5 mr-2" />
            Horários
          </button>
          
          <button
            onClick={() => setActiveTab('asaas')}
            className={`${
              activeTab === 'asaas'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Asaas
          </button>
          
          <button
            onClick={() => setActiveTab('n8n')}
            className={`${
              activeTab === 'n8n'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Webhook className="h-5 w-5 mr-2" />
            Integração n8n
          </button>
          
          <button
            onClick={() => setActiveTab('debug')}
            className={`${
              activeTab === 'debug'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Bug className="h-5 w-5 mr-2" />
            Debug
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'geral' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Settings className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Configurações Gerais</h2>
          </div>
          
          <p className="text-gray-500">
            Configurações gerais do sistema serão implementadas em breve.
          </p>
        </div>
      )}
      
      {activeTab === 'horarios' && (
        <BusinessSettingsPage />
      )}
      
      {activeTab === 'asaas' && (
        <AsaasSettings />
      )}
      
      {activeTab === 'n8n' && (
        <N8nIntegrationPage />
      )}
      
      {activeTab === 'debug' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Bug className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Ferramentas de Debug</h2>
          </div>
          
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Debug de Produtos e Serviços</h3>
              <p className="text-gray-600 mb-4">
                Esta ferramenta permite monitorar e diagnosticar problemas relacionados aos módulos de produtos e serviços.
                Você pode verificar logs de operações, testar funcionalidades e identificar possíveis problemas.
              </p>
              <button
                onClick={() => setShowDebug(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Bug className="h-4 w-4 mr-2" />
                Abrir Painel de Debug
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showDebug && <ProductServiceDebugPanel onClose={() => setShowDebug(false)} />}
    </div>
  );
}