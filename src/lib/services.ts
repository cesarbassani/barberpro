import { create } from 'zustand';
import { supabase, checkSupabaseConnection, withRetry } from './supabase';
import type { Service } from '../types/database';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  description: string | null;
  type: string;
  active: boolean;
}

interface ServicesState {
  services: Service[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  fetchServices: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createService: (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  toggleServiceStatus: (id: string) => Promise<void>;
}

export const useServices = create<ServicesState>((set, get) => ({
  services: [],
  categories: [],
  isLoading: false,
  error: null,

  fetchServices: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection status with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('services')
          .select(`
            *,
            category:categories(*)
          `)
          .order('name');
      }, 3, 1000); // Reduced to 3 retries with initial delay of 1s
      
      if (error) throw error;
      set({ services: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar serviços';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('Error fetching services:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    
    const maxRetries = 3;
    const initialDelay = 1000;
    const maxDelay = 5000;
    let attempt = 0;
    
    const fetchWithTimeout = async () => {
      const timeout = 10000; // 10 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        // Check browser online status first
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
        }

        const response = await supabase
          .from('categories')
          .select('*')
          .in('type', ['service', 'both'])
          .order('name');

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    while (attempt < maxRetries) {
      try {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const { data, error } = await fetchWithTimeout();
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          throw new Error('Nenhuma categoria encontrada');
        }

        set({ categories: data, error: null });
        return;

      } catch (err) {
        attempt++;
        
        if (attempt === maxRetries) {
          const errorMessage = err instanceof Error 
            ? err.message 
            : 'Erro ao carregar categorias após várias tentativas. Tente novamente mais tarde.';
          
          set({ error: errorMessage });
          toast.error(errorMessage);
          console.error('Error fetching categories (final attempt):', err);
          
          // Keep existing categories if we have them
          if (get().categories.length === 0) {
            set({ categories: [] });
          }
        } else {
          console.warn(`Attempt ${attempt} failed, retrying...`);
        }
      }
    }

    set({ isLoading: false });
  },

  createService: async (service) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection status with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { error } = await withRetry(async () => {
        return await supabase
          .from('services')
          .insert([service])
          .select()
          .single();
      }, 3, 1000); // Reduced to 3 retries with initial delay of 1s
      
      if (error) throw error;
      await get().fetchServices();
      toast.success('Serviço criado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar serviço';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateService: async (id, service) => {
    set({ isLoading: true, error: null });
    try {
      // Check browser online status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Você está offline. Verifique sua conexão com a internet e tente novamente.');
      }

      // Check connection status with improved error handling
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente mais tarde.');
      }

      const { error } = await withRetry(async () => {
        return await supabase
          .from('services')
          .update(service)
          .eq('id', id)
          .select()
          .single();
      }, 3, 1000); // Reduced to 3 retries with initial delay of 1s
      
      if (error) throw error;
      await get().fetchServices();
      toast.success('Serviço atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar serviço';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  toggleServiceStatus: async (id) => {
    const service = get().services.find(s => s.id === id);
    if (!service) return;

    await get().updateService(id, { active: !service.active });
  },
}));