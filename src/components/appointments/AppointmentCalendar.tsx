import React from 'react';
import { useAuth } from '../../lib/auth';
import { ModernAppointmentCalendar } from './ModernAppointmentCalendar';

export function AppointmentCalendar() {
  const { profile } = useAuth();
  
  return (
    <ModernAppointmentCalendar />
  );
}