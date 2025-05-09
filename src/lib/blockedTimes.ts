import { create } from 'zustand';
import { supabase } from './supabase';
import toast from 'react-hot-toast';

export interface BlockedTime {
  id: string;
  barber_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string | null;
  is_all_day: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  barber?: {
    full_name: string;
  };
}

export interface BusinessHours {
  weekdays: string[];
  openingTime: string;
  closingTime: string;
  slotDuration: number;
  holidays: Array<{
    date: string;
    name: string;
  }>;
}

interface BlockedTimesState {
  blockedTimes: BlockedTime[];
  businessHours: BusinessHours | null;
  isLoading: boolean;
  error: string | null;
  fetchBlockedTimes: (barberId?: string) => Promise<void>;
  fetchBlockedTimesByRange: (startDate: Date, endDate: Date, barberId?: string) => Promise<void>;
  createBlockedTime: (blockedTime: Omit<BlockedTime, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'barber'>) => Promise<void>;
  updateBlockedTime: (id: string, blockedTime: Partial<Omit<BlockedTime, 'id' | 'created_at' | 'updated_at' | 'created_by'>>) => Promise<void>;
  deleteBlockedTime: (id: string) => Promise<void>;
  fetchBusinessHours: () => Promise<void>;
  updateBusinessHours: (data: BusinessHours) => Promise<void>;
  isTimeBlocked: (barberId: string, startTime: Date, endTime: Date) => boolean;
  isWithinBusinessHours: (date: Date, time: string) => boolean;
}

export const useBlockedTimes = create<BlockedTimesState>((set, get) => ({
  blockedTimes: [],
  businessHours: null,
  isLoading: false,
  error: null,

  // Fetch blocked times for a specific barber or all barbers if not specified
  fetchBlockedTimes: async (barberId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('blocked_times')
        .select(`
          *,
          barber:profiles!barber_id(full_name)
        `)
        .order('start_time', { ascending: true });

      // Add barberId filter if provided
      if (barberId) {
        query = query.eq('barber_id', barberId);
      }

      const { data, error } = await query;

      if (error) throw error;
      set({ blockedTimes: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar horários bloqueados';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch blocked times within a date range
  fetchBlockedTimesByRange: async (startDate: Date, endDate: Date, barberId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('blocked_times')
        .select(`
          *,
          barber:profiles!barber_id(full_name)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      // Add barberId filter if provided
      if (barberId) {
        query = query.eq('barber_id', barberId);
      }

      const { data, error } = await query;

      if (error) throw error;
      set({ blockedTimes: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar horários bloqueados';
      set({ error: errorMessage });
      console.error('Error fetching blocked times by range:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // Create a new blocked time
  createBlockedTime: async (blockedTime) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from('blocked_times').insert([blockedTime]);

      if (error) throw error;
      
      await get().fetchBlockedTimes(blockedTime.barber_id);
      toast.success('Horário bloqueado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao bloquear horário';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // Update an existing blocked time
  updateBlockedTime: async (id, blockedTime) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('blocked_times')
        .update(blockedTime)
        .eq('id', id);

      if (error) throw error;
      
      await get().fetchBlockedTimes();
      toast.success('Bloqueio atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar bloqueio';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // Delete a blocked time
  deleteBlockedTime: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('blocked_times')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update state by removing the deleted item
      const blockedTimes = get().blockedTimes.filter(bt => bt.id !== id);
      set({ blockedTimes });
      
      toast.success('Bloqueio removido com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover bloqueio';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch business hours from settings
  fetchBusinessHours: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'business_hours')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // If no business hours are set, create default ones
      if (!data) {
        const defaultBusinessHours: BusinessHours = {
          weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          openingTime: '08:00',
          closingTime: '20:00',
          slotDuration: 30,
          holidays: []
        };
        
        set({ businessHours: defaultBusinessHours });
        return;
      }
      
      set({ businessHours: data.value as BusinessHours });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar horário de funcionamento';
      set({ error: errorMessage });
      console.error('Error fetching business hours:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // Update business hours in settings
  updateBusinessHours: async (data: BusinessHours) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('settings')
        .upsert(
          { key: 'business_hours', value: data },
          { onConflict: 'key' }
        );

      if (error) throw error;
      
      set({ businessHours: data });
      toast.success('Horário de funcionamento atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar horário de funcionamento';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // Check if a time slot is blocked for a specific barber
  isTimeBlocked: (barberId, startTime, endTime) => {
    const { blockedTimes } = get();
    
    // Check if there's any overlap with blocked times
    return blockedTimes.some(blockedTime => {
      if (blockedTime.barber_id !== barberId) return false;
      
      const blockedStart = new Date(blockedTime.start_time);
      const blockedEnd = new Date(blockedTime.end_time);
      
      // Check for all-day blocks
      if (blockedTime.is_all_day) {
        const blockedDate = new Date(blockedStart);
        blockedDate.setHours(0, 0, 0, 0);
        
        const startDate = new Date(startTime);
        startDate.setHours(0, 0, 0, 0);
        
        return blockedDate.getTime() === startDate.getTime();
      }
      
      // Check for overlap
      return (
        (startTime >= blockedStart && startTime < blockedEnd) ||
        (endTime > blockedStart && endTime <= blockedEnd) ||
        (startTime <= blockedStart && endTime >= blockedEnd)
      );
    });
  },

  // Check if a time is within business hours
  isWithinBusinessHours: (date, time) => {
    const { businessHours } = get();
    if (!businessHours) return true; // Default to true if not configured
    
    // Check if the day is a business day
    const day = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
    if (!businessHours.weekdays.includes(day)) return false;
    
    // Check if the date is a holiday
    const dateString = date.toISOString().split('T')[0];
    const isHoliday = businessHours.holidays.some(holiday => holiday.date === dateString);
    if (isHoliday) return false;
    
    // Check if the time is within business hours
    const [hours, minutes] = time.split(':').map(Number);
    const [openingHours, openingMinutes] = businessHours.openingTime.split(':').map(Number);
    const [closingHours, closingMinutes] = businessHours.closingTime.split(':').map(Number);
    
    const totalMinutes = hours * 60 + minutes;
    const openingTotalMinutes = openingHours * 60 + openingMinutes;
    const closingTotalMinutes = closingHours * 60 + closingMinutes;
    
    return totalMinutes >= openingTotalMinutes && totalMinutes < closingTotalMinutes;
  }
}));