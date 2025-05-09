import { create } from 'zustand';
import { supabase, checkSupabaseConnection, withRetry } from './supabase';
import type { Product } from '../types/database';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  description: string | null;
  type: string;
  active: boolean;
}

interface ProductsState {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  toggleProductStatus: (id: string) => Promise<void>;
}

export const useProducts = create<ProductsState>((set, get) => ({
  products: [],
  categories: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
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
          .from('products')
          .select(`
            *,
            category:categories(*)
          `)
          .order('name');
      }, 3, 1000); // Reduced to 3 retries with initial delay of 1s
      
      if (error) throw error;
      set({ products: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar produtos';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('Error fetching products:', err);
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
          .in('type', ['product', 'both'])
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

  createProduct: async (product) => {
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
          .from('products')
          .insert([product])
          .select()
          .single();
      }, 3, 1000); // Reduced to 3 retries with initial delay of 1s
      
      if (error) throw error;
      await get().fetchProducts();
      toast.success('Produto criado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar produto';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateProduct: async (id, product) => {
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
          .from('products')
          .update(product)
          .eq('id', id)
          .select()
          .single();
      }, 3, 1000); // Reduced to 3 retries with initial delay of 1s
      
      if (error) throw error;
      await get().fetchProducts();
      toast.success('Produto atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar produto';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  toggleProductStatus: async (id) => {
    const product = get().products.find(p => p.id === id);
    if (!product) return;

    await get().updateProduct(id, { active: !product.active });
  },
}));