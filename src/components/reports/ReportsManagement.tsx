import React, { useState } from 'react';
import { BarChart, FileText, Users, Calendar, CreditCard, Download, Filter } from 'lucide-react';
import { CommissionReports } from './CommissionReports';
import { OrderManagementReports } from './OrderManagementReports';
import { CashRegisterReports } from './CashRegisterReports';

type ReportTab = 'commissions' | 'orders' | 'cash';

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('commissions');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <BarChart className="h-6 w-6 mr-2 text-primary-600" />
          Gestão de Relatórios
        </h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('commissions')}
            className={`${
              activeTab === 'commissions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Users className="h-5 w-5 mr-2" />
            Comissões
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`${
              activeTab === 'orders'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <FileText className="h-5 w-5 mr-2" />
            Comandas
          </button>

          <button
            onClick={() => setActiveTab('cash')}
            className={`${
              activeTab === 'cash'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Caixa
          </button>
        </nav>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'commissions' && <CommissionReports />}
      {activeTab === 'orders' && <OrderManagementReports />}
      {activeTab === 'cash' && <CashRegisterReports />}
    </div>
  );
}