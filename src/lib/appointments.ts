import { create } from 'zustand';
import { supabase, checkSupabaseConnection, withRetry } from './supabase';
import type { Appointment } from '../types/database';
import { format, startOfDay, endOfDay, addMinutes, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { pt } from 'date-fns/locale';
import { useBlockedTimes } from './blockedTimes';

interface AppointmentsState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'checking';
  fetchAppointments: (startDate: Date, endDate: Date) => Promise<void>;
  createAppointment: (appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => Promise<Appointment | null>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  moveAppointment: (id: string, newStart: Date, newEnd: Date) => Promise<void>;
}

export const useAppointments = create<AppointmentsState>((set, get) => ({
  appointments: [],
  isLoading: false,
  error: null,
  connectionStatus: 'checking',

  checkConnection: async () => {
    set({ connectionStatus: 'checking' });
    
    // First check if browser is online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.error('Browser is offline');
      set({ connectionStatus: 'disconnected' });
      return false;
    }
    
    const isConnected = await checkSupabaseConnection();
    set({ connectionStatus: isConnected ? 'connected' : 'disconnected' });
    return isConnected;
  },

  fetchAppointments: async (startDate: Date, endDate: Date) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection first
      const isConnected = await get().checkConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      // Use withRetry to attempt the operation multiple times if it fails
      const { data, error } = await withRetry(() => supabase
        .from('appointments')
        .select(`
          *,
          client:clients(*),
          barber:profiles!barber_id(*),
          service:services(*)
        `)
        .gte('start_time', format(startOfDay(startDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
        .lte('start_time', format(endOfDay(endDate), "yyyy-MM-dd'T'HH:mm:ssXXX"))
        .order('start_time'), 
        3,  // max retries
        1000 // initial delay
      );

      if (error) throw error;
      set({ appointments: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar agendamentos';
      set({ error: errorMessage });
      console.error('Error fetching appointments:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createAppointment: async (appointment) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection first
      const isConnected = await get().checkConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      // Ensure dates are in ISO format
      const data = {
        ...appointment,
        start_time: new Date(appointment.start_time).toISOString(),
        end_time: new Date(appointment.end_time).toISOString(),
      };

      // Check if the time slot is available (not blocked)
      const { isTimeBlocked } = useBlockedTimes.getState();
      if (isTimeBlocked(data.barber_id, new Date(data.start_time), new Date(data.end_time))) {
        throw new Error('Este horário está bloqueado. Por favor, escolha outro horário.');
      }

      // Check for existing appointments at the same time for the same barber
      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('barber_id', data.barber_id)
        .neq('status', 'cancelled')
        .lt('start_time', data.end_time)
        .gt('end_time', data.start_time);

      if (checkError) throw checkError;

      if (existingAppointments && existingAppointments.length > 0) {
        throw new Error('Já existe um agendamento neste horário para este barbeiro.');
      }

      // Check for overlapping appointments for the same client
      const { data: clientAppointments, error: clientCheckError } = await supabase
        .from('appointments')
        .select('id')
        .eq('client_id', data.client_id)
        .neq('status', 'cancelled')
        .lt('start_time', data.end_time)
        .gt('end_time', data.start_time);

      if (clientCheckError) throw clientCheckError;

      if (clientAppointments && clientAppointments.length > 0) {
        throw new Error('Cliente já possui um agendamento neste horário.');
      }

      const { data: newAppointment, error } = await withRetry(() => supabase
        .from('appointments')
        .insert([data])
        .select(`
          *,
          client:clients(*),
          barber:profiles!barber_id(*),
          service:services(*)
        `)
        .single());

      if (error) throw error;

      // Fetch appointments for the day of the new appointment
      const appointmentDate = new Date(appointment.start_time);
      await get().fetchAppointments(appointmentDate, appointmentDate);
      
      return newAppointment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar agendamento';
      set({ error: errorMessage });
      console.error('Error creating appointment:', err);
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateAppointment: async (id, appointment) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection first
      const isConnected = await get().checkConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      // Ensure dates are in ISO format if provided
      const data = {
        ...appointment,
        start_time: appointment.start_time ? new Date(appointment.start_time).toISOString() : undefined,
        end_time: appointment.end_time ? new Date(appointment.end_time).toISOString() : undefined,
      };

      // If updating times, check for conflicts
      if (data.start_time && data.end_time) {
        // Check for existing appointments at the same time for the same barber
        const { data: existingAppointments, error: checkError } = await supabase
          .from('appointments')
          .select('id')
          .eq('barber_id', data.barber_id || appointment.barber_id)
          .neq('id', id) // Exclude current appointment
          .neq('status', 'cancelled')
          .lt('start_time', data.end_time)
          .gt('end_time', data.start_time);

        if (checkError) throw checkError;

        if (existingAppointments && existingAppointments.length > 0) {
          throw new Error('Já existe um agendamento neste horário para este barbeiro.');
        }

        // Check if the time slot is available (not blocked)
        const { isTimeBlocked } = useBlockedTimes.getState();
        if (isTimeBlocked(data.barber_id || appointment.barber_id, new Date(data.start_time), new Date(data.end_time))) {
          throw new Error('Este horário está bloqueado. Por favor, escolha outro horário.');
        }
      }

      const { error } = await withRetry(() => supabase
        .from('appointments')
        .update(data)
        .eq('id', id));

      if (error) throw error;

      // Fetch appointments for the day of the updated appointment
      const appointmentDate = appointment.start_time ? new Date(appointment.start_time) : new Date();
      await get().fetchAppointments(appointmentDate, appointmentDate);
      
      toast.success('Agendamento atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar agendamento';
      set({ error: errorMessage });
      console.error('Error updating appointment:', err);
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelAppointment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection first
      const isConnected = await get().checkConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      const { error } = await withRetry(() => supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id));

      if (error) throw error;

      // Fetch current appointments
      await get().fetchAppointments(new Date(), new Date());
      
      toast.success('Agendamento cancelado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar agendamento';
      set({ error: errorMessage });
      console.error('Error canceling appointment:', err);
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  
  moveAppointment: async (id, newStart, newEnd) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection first
      const isConnected = await get().checkConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }

      // Get the appointment to find the barber_id
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('barber_id, client_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Check if the new time is blocked
      const { isTimeBlocked } = useBlockedTimes.getState();
      if (isTimeBlocked(appointment.barber_id, newStart, newEnd)) {
        throw new Error('Este horário está bloqueado. Por favor, escolha outro horário.');
      }

      // Check for existing appointments at the same time for the same barber
      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('barber_id', appointment.barber_id)
        .neq('id', id) // Exclude current appointment
        .neq('status', 'cancelled')
        .lt('start_time', newEnd.toISOString())
        .gt('end_time', newStart.toISOString());

      if (checkError) throw checkError;

      if (existingAppointments && existingAppointments.length > 0) {
        throw new Error('Já existe um agendamento neste horário para este barbeiro.');
      }

      // Check for overlapping appointments for the same client
      const { data: clientAppointments, error: clientCheckError } = await supabase
        .from('appointments')
        .select('id')
        .eq('client_id', appointment.client_id)
        .neq('id', id) // Exclude current appointment
        .neq('status', 'cancelled')
        .lt('start_time', newEnd.toISOString())
        .gt('end_time', newStart.toISOString());

      if (clientCheckError) throw clientCheckError;

      if (clientAppointments && clientAppointments.length > 0) {
        throw new Error('Cliente já possui um agendamento neste horário.');
      }

      const { error } = await withRetry(() => supabase
        .from('appointments')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        })
        .eq('id', id));

      if (error) throw error;

      // Fetch appointments for the day of the updated appointment
      await get().fetchAppointments(startOfDay(newStart), endOfDay(newStart));
      
      toast.success('Agendamento reagendado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao mover agendamento';
      set({ error: errorMessage });
      console.error('Error moving appointment:', err);
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  }
}));

// Helper function to check if a time slot is available for the given barber
export const isTimeSlotAvailable = (
  barberId: string, 
  start: Date, 
  end: Date, 
  appointments: Appointment[],
  currentAppointmentId?: string
): boolean => {
  // First check if the time slot is blocked
  const { isTimeBlocked } = useBlockedTimes.getState();
  if (isTimeBlocked(barberId, start, end)) {
    return false;
  }
  
  // Filter appointments for the given barber
  const barberAppointments = appointments.filter(
    appt => appt.barber_id === barberId && appt.status !== 'cancelled'
  );

  // Check if any appointment overlaps with the given time slot
  return !barberAppointments.some(appt => {
    // Skip checking the current appointment (for edits)
    if (currentAppointmentId && appt.id === currentAppointmentId) {
      return false;
    }

    const apptStart = new Date(appt.start_time);
    const apptEnd = new Date(appt.end_time);

    // Check for overlap
    return (
      (start >= apptStart && start < apptEnd) ||
      (end > apptStart && end <= apptEnd) ||
      (start <= apptStart && end >= apptEnd)
    );
  });
};

// Helper function to get the next available time slot
export const getNextAvailableTimeSlot = (
  barberId: string,
  preferredStart: Date,
  duration: number, // in minutes
  appointments: Appointment[]
): Date => {
  let start = new Date(preferredStart);
  const end = new Date(start.getTime() + duration * 60000);

  // Check if the preferred time slot is available
  if (isTimeSlotAvailable(barberId, start, end, appointments)) {
    return start;
  }

  // If not, find the next available time slot
  let found = false;
  while (!found) {
    // Move to the next 15-min slot
    start = addMinutes(start, 15);
    const newEnd = new Date(start.getTime() + duration * 60000);
    
    found = isTimeSlotAvailable(barberId, start, newEnd, appointments);
    
    // Safety check to prevent infinite loop
    if (start.getHours() >= 22) {
      // If we've reached the end of the day, move to the next day
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 8, 0, 0);
    }
  }

  return start;
};

// Helper to generate business hours
export const getBusinessHours = () => {
  // Try to get business hours from the store
  const { businessHours } = useBlockedTimes.getState();
  
  if (businessHours) {
    const daysOfWeek = businessHours.weekdays.map(day => weekdayMap[day]);
    return {
      daysOfWeek,
      startTime: businessHours.openingTime,
      endTime: businessHours.closingTime,
    };
  }
  
  // Default fallback
  return {
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // 0=Sunday, 1=Monday, etc.
    startTime: '08:00',
    endTime: '20:00',
  };
};

// Map weekday strings to numbers (0=Sunday, 1=Monday, etc.)
const weekdayMap: Record<string, number> = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return '#FCD34D'; // Yellow
    case 'confirmed':
      return '#34D399'; // Green
    case 'completed':
      return '#60A5FA'; // Blue
    case 'cancelled':
      return '#F87171'; // Red
    default:
      return '#CBD5E1'; // Gray
  }
};

export const formatStatus = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'Agendado';
    case 'confirmed':
      return 'Confirmado';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
};