import React, { useState } from 'react';
import { useProfiles } from '../../lib/profiles';
import { Users, Edit2, UserPlus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Profile } from '../../types/database';
import { createUser, updateUser, deleteUser, checkEmailExists } from '../../lib/users';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

const userSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  full_name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  role: z.enum(['client', 'barber', 'admin']),
  phone: z.string().optional(),
  service_commission_rate: z.number().min(0).max(100).optional(),
  product_commission_rate: z.number().min(0).max(100).optional(),
});

const editUserSchema = z.object({
  full_name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  role: z.enum(['client', 'barber', 'admin']),
  phone: z.string().optional(),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres').optional(),
  service_commission_rate: z.number().min(0).max(100).optional(),
  product_commission_rate: z.number().min(0).max(100).optional(),
});

type UserFormData = z.infer<typeof userSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

export function UserManagement() {
  const { profiles, isLoading, error, fetchProfiles } = useProfiles();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const { user } = useAuth();

  React.useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(isFormOpen ? userSchema : editUserSchema),
    defaultValues: editingUser || undefined,
  });

  const selectedRole = watch('role');
  const showCommissionFields = selectedRole === 'barber';

  const handleCreateUser = async (data: UserFormData) => {
    // Prevent multiple submissions
    if (isSubmittingForm) return;
    
    try {
      setFormError(null);
      setIsSubmittingForm(true);
      
      // Check if the current user has admin role
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (!currentUserProfile || currentUserProfile.role !== 'admin') {
        throw new Error('Apenas administradores podem criar novos usuários');
      }

      // Check if user with email already exists using edge function
      const emailExists = await checkEmailExists(data.email);
      if (emailExists) {
        throw new Error('Um usuário com este email já está registrado');
      }

      // Use serverless function or edge function to create user to bypass RLS
      await createUser(data);
      setIsFormOpen(false);
      reset();
      fetchProfiles();
    } catch (err) {
      console.error('Error creating user:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleUpdateUser = async (data: EditUserFormData) => {
    if (editingUser) {
      // Prevent multiple submissions
      if (isSubmittingForm) return;
      
      try {
        setFormError(null);
        setIsSubmittingForm(true);
        
        // Check if the current user has admin role
        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user?.id)
          .single();

        if (!currentUserProfile || currentUserProfile.role !== 'admin') {
          throw new Error('Apenas administradores podem atualizar usuários');
        }

        // Use updateUser function which should handle permissions
        await updateUser(editingUser.id, data);
        setEditingUser(null);
        reset();
        fetchProfiles();
      } catch (err) {
        console.error('Error updating user:', err);
        setFormError(err instanceof Error ? err.message : 'Failed to update user');
      } finally {
        setIsSubmittingForm(false);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setFormError(null);
      
      // Check if the current user has admin role
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (!currentUserProfile || currentUserProfile.role !== 'admin') {
        throw new Error('Apenas administradores podem excluir usuários');
      }

      // Use deleteUser function which should handle permissions
      await deleteUser(userId);
      setIsConfirmingDelete(null);
      fetchProfiles();
    } catch (err) {
      console.error('Error deleting user:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Usuário
        </button>
      </div>

      {(isFormOpen || editingUser) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            {formError && (
              <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmit(editingUser ? handleUpdateUser : handleCreateUser)} className="space-y-6">
              {!editingUser && (
                <>
                  <div>
                    <label htmlFor="user-email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      id="user-email"
                      {...register('email')}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="user-password" className="block text-sm font-medium text-gray-700">
                      Senha
                    </label>
                    <input
                      type="password"
                      id="user-password"
                      {...register('password')}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>
                </>
              )}

              {editingUser && (
                <div>
                  <label htmlFor="user-password-edit" className="block text-sm font-medium text-gray-700">
                    Nova Senha (opcional)
                  </label>
                  <input
                    type="password"
                    id="user-password-edit"
                    {...register('password')}
                    placeholder="Deixe em branco para manter a senha atual"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="user-full-name" className="block text-sm font-medium text-gray-700">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="user-full-name"
                  {...register('full_name')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-gray-700">
                  Função
                </label>
                <select
                  id="user-role"
                  {...register('role')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="client">Cliente</option>
                  <option value="barber">Barbeiro</option>
                  <option value="admin">Administrador</option>
                </select>
                {errors.role && (
                  <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="user-phone" className="block text-sm font-medium text-gray-700">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="user-phone"
                  {...register('phone')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              {showCommissionFields && (
                <>
                  <div>
                    <label htmlFor="service-commission" className="block text-sm font-medium text-gray-700">
                      Comissão de Serviços (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      id="service-commission"
                      {...register('service_commission_rate', { valueAsNumber: true })}
                      defaultValue={50}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                    {errors.service_commission_rate && (
                      <p className="mt-1 text-sm text-red-600">{errors.service_commission_rate.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="product-commission" className="block text-sm font-medium text-gray-700">
                      Comissão de Produtos (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      id="product-commission"
                      {...register('product_commission_rate', { valueAsNumber: true })}
                      defaultValue={10}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                    {errors.product_commission_rate && (
                      <p className="mt-1 text-sm text-red-600">{errors.product_commission_rate.message}</p>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingUser(null);
                    reset();
                    setFormError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isSubmittingForm}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting || isSubmittingForm ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConfirmingDelete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar Exclusão
            </h3>
            {formError && (
              <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
                {formError}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsConfirmingDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteUser(isConfirmingDelete)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-primary-600" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{profile.full_name}</h3>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="capitalize">
                        {profile.role === 'admin' ? 'Administrador' : 
                         profile.role === 'barber' ? 'Barbeiro' : 'Cliente'}
                      </span>
                      {profile.phone && (
                        <>
                          <span className="mx-2">•</span>
                          <span>{profile.phone}</span>
                        </>
                      )}
                      {profile.role === 'barber' && (
                        <>
                          <span className="mx-2">•</span>
                          <span>
                            Comissão: {profile.service_commission_rate}% serviços, {profile.product_commission_rate}% produtos
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setEditingUser(profile)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(profile.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}