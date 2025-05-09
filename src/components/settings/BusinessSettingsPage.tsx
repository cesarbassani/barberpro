import React, { useState } from 'react';
import { BlockedTimesList } from '../appointments/BlockedTimesList';
import { BusinessHoursSettings } from '../appointments/BusinessHoursSettings';
import { 
  CalendarClock, 
  Building, 
  Settings, 
  DollarSign, 
  Sliders,
  CalendarOff,
  Info,
  Map,
  Phone,
  Mail,
  FileText,
  Clock,
  Users,
  Percent,
  CreditCard,
  SlidersHorizontal,
  Bell,
  LockKeyhole
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { CompanyInfoSettings } from './sections/CompanyInfoSettings';
import { OperationalSettings } from './sections/OperationalSettings';
import { FinancialSettings } from './sections/FinancialSettings';
import { CustomizationSettings } from './sections/CustomizationSettings';

type SettingsSection = 'businessHours' | 'blockedTimes' | 'companyInfo' | 'operational' | 'financial' | 'customization';

export function BusinessSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('businessHours');
  const { profile } = useAuth();

  // Check if user is admin
  const isAdmin = profile?.role === 'admin';

  // Define all sections with their access control
  const sections = [
    {
      id: 'businessHours' as const,
      name: 'Horários de Funcionamento',
      icon: <CalendarClock className="h-5 w-5 mr-2" />,
      allowed: true, // All users can view this
      adminOnly: false // But only admins can edit (handled in the component)
    },
    {
      id: 'blockedTimes' as const,
      name: 'Horários Bloqueados',
      icon: <CalendarOff className="h-5 w-5 mr-2" />,
      allowed: true,
      adminOnly: false
    },
    {
      id: 'companyInfo' as const,
      name: 'Informações da Empresa',
      icon: <Building className="h-5 w-5 mr-2" />,
      allowed: isAdmin,
      adminOnly: true
    },
    {
      id: 'operational' as const,
      name: 'Configurações Operacionais',
      icon: <Settings className="h-5 w-5 mr-2" />,
      allowed: isAdmin,
      adminOnly: true
    },
    {
      id: 'financial' as const,
      name: 'Parâmetros Financeiros',
      icon: <DollarSign className="h-5 w-5 mr-2" />,
      allowed: isAdmin,
      adminOnly: true
    },
    {
      id: 'customization' as const,
      name: 'Personalizações do Sistema',
      icon: <Sliders className="h-5 w-5 mr-2" />,
      allowed: isAdmin,
      adminOnly: true
    }
  ];

  // Filter out sections the user doesn't have access to
  const allowedSections = sections.filter(section => section.allowed);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Configurações Empresariais</h2>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap border-b border-gray-200">
        {allowedSections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`${
              activeSection === section.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center mr-8 mb-2 sm:mb-0`}
          >
            {section.icon}
            {section.name}
          </button>
        ))}
      </div>

      {/* Content based on active section */}
      <div>
        {activeSection === 'businessHours' && (
          <div>
            {isAdmin ? (
              <BusinessHoursSettings />
            ) : (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CalendarClock className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Apenas administradores podem alterar os horários de funcionamento da barbearia.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'blockedTimes' && (
          <div className="bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-6">
              <CalendarOff className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">Gerenciamento de Horários Bloqueados</h3>
            </div>
            
            <BlockedTimesList />
          </div>
        )}

        {activeSection === 'companyInfo' && isAdmin && (
          <CompanyInfoSettings />
        )}

        {activeSection === 'operational' && isAdmin && (
          <OperationalSettings />
        )}

        {activeSection === 'financial' && isAdmin && (
          <FinancialSettings />
        )}

        {activeSection === 'customization' && isAdmin && (
          <CustomizationSettings />
        )}
      </div>
    </div>
  );
}