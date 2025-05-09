import React from 'react';
import { User, Users } from 'lucide-react';

interface ProfessionalSelectorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  barbers: Array<{
    id: string;
    full_name: string;
    service_commission_rate?: number;
    product_commission_rate?: number;
  }>;
  disabled?: boolean;
}

export function ProfessionalSelector({
  id,
  value,
  onChange,
  barbers,
  disabled = false
}: ProfessionalSelectorProps) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <User className="h-5 w-5 text-gray-400" />
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 block w-full pl-[35px] pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
      >
        <option value="">Selecionar profissional</option>
        {barbers.map((barber) => (
          <option key={barber.id} value={barber.id}>
            {barber.full_name} 
            {barber.service_commission_rate ? ` (${barber.service_commission_rate}% serv / ${barber.product_commission_rate || 0}% prod)` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}