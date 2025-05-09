import { create } from 'zustand';
import { supabase, checkSupabaseConnection, withRetry } from './supabase';
import type { Profile, Client } from '../types/database';
import toast from 'react-hot-toast';

interface ProfilesState {
  profiles: Profile[];
  barbers: Profile[];
  clients: Client[];
  totalClients: number;
  isLoading: boolean;
  error: string | null;
  fetchProfiles: () => Promise<void>;
  fetchBarbers: () => Promise<void>;
  fetchClients: (params?: { page?: number; pageSize?: number; search?: string }) => Promise<void>;
  fetchClientsPage: (page: number, pageSize: number, search?: string) => Promise<void>;
  searchClients: (query: string) => Promise<Client[]>;
  updateClient: (id: string, clientData: Partial<Client>) => Promise<void>;
}

export const useProfiles = create<ProfilesState>((set, get) => ({
  profiles: [],
  barbers: [],
  clients: [],
  totalClients: 0,
  isLoading: false,
  error: null,

  fetchProfiles: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }
      
      const { data, error } = await withRetry(() => supabase
        .from('profiles')
        .select('*')
        .order('full_name'));
      
      if (error) throw error;
      set({ profiles: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar perfis';
      set({ error: errorMessage });
      console.error('Error fetching profiles:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchBarbers: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }
      
      const { data, error } = await withRetry(() => supabase
        .from('profiles')
        .select('*')
        .eq('role', 'barber')
        .order('full_name'));
      
      if (error) throw error;
      set({ barbers: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar barbeiros';
      set({ error: errorMessage });
      console.error('Error fetching barbers:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchClients: async (params = {}) => {
    const { page = 1, pageSize = 20, search = '' } = params;
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }
      
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order('full_name');
      
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,cpf.ilike.%${search}%`);
      }
      
      // Add pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await withRetry(() => query);
      
      if (error) throw error;
      set({ 
        clients: data || [],
        totalClients: count || 0
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar clientes';
      set({ error: errorMessage });
      console.error('Error fetching clients:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchClientsPage: async (page, pageSize, search = '') => {
    await get().fetchClients({ page, pageSize, search });
  },

  searchClients: async (query) => {
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados');
      }
      
      // If query is empty, return recent clients
      if (!query.trim()) {
        const { data, error } = await withRetry(() => supabase
          .from('clients')
          .select('*')
          .order('last_visit_date', { ascending: false, nullsLast: true })
          .limit(20));
        
        if (error) throw error;
        return data || [];
      }
      
      // Search by query
      const { data, error } = await withRetry(() => supabase
        .from('clients')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,cpf.ilike.%${query}%`)
        .order('full_name')
        .limit(20));
      
      if (error) {
        console.error('Error in searchClients:', error);
        throw error;
      }
      
      console.log(`Searched for '${query}', found ${data?.length || 0} clients`);
      return data || [];
    } catch (err) {
      console.error('Error searching clients:', err);
      return [];
    }
  },

  updateClient: async (id, clientData) => {
    set({ isLoading: true, error: null });
    try {
      // Check connection
      if (!await checkSupabaseConnection()) {
        throw new Error('Não foi possível conectar ao banco de dados. Verifique sua conexão com a internet e tente novamente.');
      }
      
      const { error } = await withRetry(() => supabase
        .from('clients')
        .update(clientData)
        .eq('id', id));

      if (error) throw error;
      
      await get().fetchClients();
      toast.success('Cliente atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar cliente';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('Error updating client:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  }
}));