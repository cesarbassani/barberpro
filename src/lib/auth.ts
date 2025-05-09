import { create } from 'zustand';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import toast from 'react-hot-toast';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,

  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user data');

      await get().loadProfile();
      toast.success('Login realizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user data');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: data.user.id,
          full_name: fullName,
          role: 'client',
        }]);

      if (profileError) throw profileError;
      toast.success('Conta criada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conta';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, profile: null });
      toast.success('Logout realizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao sair';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loadProfile: async () => {
    try {
      set({ isLoading: true, error: null });
      const { data: { user } } = await supabase.auth.getUser();
      set({ user });

      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        set({ profile });
      } else {
        set({ profile: null });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      set({ error: 'Error loading profile' });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Initialize auth state
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    useAuth.getState().loadProfile();
  } else {
    useAuth.setState({ user: null, profile: null, isLoading: false });
  }
});