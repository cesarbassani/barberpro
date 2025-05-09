import React, { useState, useEffect } from 'react';
import { useClients } from '../../lib/clients';
import { useProfiles } from '../../lib/profiles';
import { Users, Edit2, Phone, Mail, Trash2, Search, Plus, FilterX, ChevronLeft, ChevronRight } from 'lucide-react';
import { ClientForm } from './ClientForm';
import type { Client } from '../../types/database';

export function ClientList() {
  const { deleteClient } = useClients();
  const { clients, totalClients, isLoading, error, fetchClientsPage } = useProfiles();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Calculate total pages
  const totalPages = Math.ceil(totalClients / pageSize);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch clients with pagination
  useEffect(() => {
    fetchClientsPage(currentPage, pageSize, debouncedSearch);
  }, [fetchClientsPage, currentPage, pageSize, debouncedSearch]);

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id);
      setIsConfirmingDelete(null);
      // Refresh the current page
      fetchClientsPage(currentPage, pageSize, debouncedSearch);
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleClientFormSuccess = () => {
    // Refresh the current page after adding/editing a client
    fetchClientsPage(currentPage, pageSize, debouncedSearch);
  };

  if (isLoading && clients.length === 0) {
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
        <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          title="Cadastrar novo cliente"
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar cliente por nome, telefone, email ou CPF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 py-2 block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
        {searchQuery && (
          <button
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setSearchQuery('')}
          >
            <FilterX className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {(isFormOpen || editingClient) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <ClientForm
              initialData={editingClient || undefined}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingClient(null);
              }}
              onSuccess={handleClientFormSuccess}
            />
          </div>
        </div>
      )}

      {isConfirmingDelete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar Exclusão
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsConfirmingDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(isConfirmingDelete)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              {debouncedSearch ? `Resultados da busca (${totalClients})` : `Todos os Clientes (${totalClients})`}
            </h3>
          </div>
        </div>
        
        <ul className="divide-y divide-gray-200">
          {clients.map((client) => (
            <li key={client.id} className="hover:bg-gray-50 transition-colors">
              <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-primary-600" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{client.full_name}</h3>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {client.phone && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="h-4 w-4 mr-1" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Mail className="h-4 w-4 mr-1" />
                          <span>{client.email}</span>
                        </div>
                      )}
                    </div>
                    {client.cpf && (
                      <p className="text-sm text-gray-500 mt-1">
                        CPF: {client.cpf}
                      </p>
                    )}
                    {client.birth_date && (
                      <p className="text-sm text-gray-500">
                        Nascimento: {new Date(client.birth_date).toLocaleDateString()}
                      </p>
                    )}
                    {client.notes && (
                      <p className="text-sm text-gray-500 mt-1 italic">
                        "{client.notes}"
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setEditingClient(client)}
                    title="Editar este cliente"
                    className="p-2 rounded-full hover:bg-gray-200 text-primary-600 hover:text-primary-900"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(client.id)}
                    title="Excluir este cliente"
                    className="p-2 rounded-full hover:bg-gray-200 text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {clients.length === 0 && !isLoading && (
            <li className="px-4 py-6 text-center text-gray-500">
              {debouncedSearch ? 'Nenhum cliente encontrado para esta busca' : 'Nenhum cliente cadastrado'}
            </li>
          )}
        </ul>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> a <span className="font-medium">{Math.min(currentPage * pageSize, totalClients)}</span> de{' '}
                  <span className="font-medium">{totalClients}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Anterior</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  
                  {/* First Page */}
                  {currentPage > 3 && (
                    <button
                      onClick={() => handlePageChange(1)}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      1
                    </button>
                  )}
                  
                  {/* Ellipsis for many pages */}
                  {currentPage > 4 && (
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      ...
                    </span>
                  )}
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const pageNum = Math.max(1, currentPage - 2) + i;
                    if (pageNum <= totalPages && (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border ${
                            pageNum === currentPage 
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600' 
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          } text-sm font-medium`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Ellipsis for many pages */}
                  {totalPages > currentPage + 3 && (
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      ...
                    </span>
                  )}
                  
                  {/* Last Page */}
                  {totalPages > currentPage + 2 && (
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {totalPages}
                    </button>
                  )}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Próxima</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}