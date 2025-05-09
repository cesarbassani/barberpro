import { create } from 'zustand';
import { supabase } from './supabase';
import type { Client } from '../types/database';
import toast from 'react-hot-toast';
import { useProfiles } from './profiles';

interface ClientsState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  fetchClients: () => Promise<void>;
  createClient: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<Client>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
}

export const useClients = create<ClientsState>((set, get) => ({
  clients: [],
  isLoading: false,
  error: null,

  fetchClients: async () => {
    // Use the paginated fetch function from useProfiles
    const { fetchClients } = useProfiles.getState();
    await fetchClients();
    const { clients } = useProfiles.getState();
    set({ clients });
  },

  createClient: async (client) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([client])
        .select()
        .single();

      if (error) throw error;
      
      // Refresh clients list
      const { fetchClients } = useProfiles.getState();
      await fetchClients();
      
      toast.success('Cliente criado com sucesso!');
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar cliente';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateClient: async (id, client) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('clients')
        .update(client)
        .eq('id', id);

      if (error) throw error;
      
      // Refresh clients list
      const { fetchClients } = useProfiles.getState();
      await fetchClients();
      
      toast.success('Cliente atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar cliente';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteClient: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Refresh clients list
      const { fetchClients } = useProfiles.getState();
      await fetchClients();
      
      toast.success('Cliente excluído com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir cliente';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
}));