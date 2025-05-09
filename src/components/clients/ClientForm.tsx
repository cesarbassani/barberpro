import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useClients } from '../../lib/clients';
import type { Client } from '../../types/database';

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

const clientSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  cpf: z.string()
    .regex(cpfRegex, 'CPF inválido')
    .optional()
    .nullable()
    .transform(val => val ? val.replace(/\D/g, '') : null),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  initialData?: Client;
  onCancel: () => void;
  onSuccess?: () => void;
}

export function ClientForm({ initialData, onCancel, onSuccess }: ClientFormProps) {
  const { createClient, updateClient } = useClients();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          birth_date: initialData.birth_date
            ? new Date(initialData.birth_date).toISOString().split('T')[0]
            : undefined,
        }
      : undefined,
  });

  const onSubmit = async (data: ClientFormData) => {
    try {
      if (initialData) {
        await updateClient(initialData.id, data);
      } else {
        await createClient(data);
      }
      onCancel();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="client-full-name" className="block text-sm font-medium text-gray-700 mb-1">
          Nome Completo
        </label>
        <input
          type="text"
          id="client-full-name"
          {...register('full_name')}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.full_name && (
          <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-cpf" className="block text-sm font-medium text-gray-700 mb-1">
          CPF
        </label>
        <input
          type="text"
          id="client-cpf"
          {...register('cpf')}
          placeholder="000.000.000-00"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.cpf && (
          <p className="mt-1 text-sm text-red-600">{errors.cpf.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          id="client-email"
          {...register('email')}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-phone" className="block text-sm font-medium text-gray-700 mb-1">
          Telefone
        </label>
        <input
          type="tel"
          id="client-phone"
          {...register('phone')}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-birth-date" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Nascimento
        </label>
        <input
          type="date"
          id="client-birth-date"
          {...register('birth_date')}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {errors.birth_date && (
          <p className="mt-1 text-sm text-red-600">{errors.birth_date.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="client-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Observações
        </label>
        <textarea
          id="client-notes"
          {...register('notes')}
          rows={3}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          placeholder="Informações adicionais sobre o cliente..."
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  );
}