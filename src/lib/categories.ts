import { create } from 'zustand';
import { supabase } from './supabase';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  description: string | null;
  type: 'service' | 'product' | 'both';
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface CategoriesState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  findCategoryByName: (name: string, type: 'service' | 'product' | 'both') => Category | undefined;
  createCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  toggleCategoryStatus: (id: string) => Promise<void>;
}

export const useCategories = create<CategoriesState>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      set({ categories: data || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar categorias';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  findCategoryByName: (name: string, type: 'service' | 'product' | 'both') => {
    const normalizedName = name.toLowerCase().trim();
    return get().categories.find(category => 
      category.name.toLowerCase().trim() === normalizedName &&
      (category.type === type || category.type === 'both')
    );
  },

  createCategory: async (category) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .single();
      
      if (error) throw error;
      await get().fetchCategories();
      toast.success('Categoria criada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar categoria';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateCategory: async (id, category) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      await get().fetchCategories();
      toast.success('Categoria atualizada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar categoria';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchCategories();
      toast.success('Categoria excluída com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir categoria';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  toggleCategoryStatus: async (id) => {
    const category = get().categories.find(c => c.id === id);
    if (!category) return;

    await get().updateCategory(id, { active: !category.active });
  },
}));