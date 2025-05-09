import React, { useState, useEffect, useRef } from 'react';
import { useProfiles } from '../../lib/profiles';
import { Search, X, User, Phone, Mail, Calendar, Clock, PlusCircle, Loader2 } from 'lucide-react';
import type { Client } from '../../types/database';
import { ClientForm } from '../clients/ClientForm';

interface ClientSearchFieldProps {
  value?: string;
  onChange: (clientId: string) => void;
  onClientCreate?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export function ClientSearchField({
  value,
  onChange,
  onClientCreate,
  disabled = false,
  required = false,
  error,
}: ClientSearchFieldProps) {
  const { searchClients, fetchClients } = useProfiles();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isNewClientFormOpen, setIsNewClientFormOpen] = useState(false);
  
  // Load client data when the field is focused
  const loadClientData = async (query: string = '') => {
    setIsSearching(true);
    try {
      const results = await searchClients(query);
      console.log("Search results:", results.length, "clients found");
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching clients:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // When value changes, find the selected client
  useEffect(() => {
    if (value) {
      console.log("Value changed to:", value);
      const fetchClientDetails = async () => {
        try {
          // Find client in search results or fetch directly
          const clientInResults = searchResults.find(c => c.id === value);
          if (clientInResults) {
            setSelectedClient(clientInResults);
          } else {
            // Search specifically for this client
            const results = await searchClients(value);
            const client = results.find(c => c.id === value);
            if (client) {
              setSelectedClient(client);
            } else {
              console.log("Client not found in search results");
              setSelectedClient(null);
            }
          }
        } catch (error) {
          console.error('Error fetching client details:', error);
        }
      };
      
      fetchClientDetails();
    } else {
      console.log("Value is empty, clearing selected client");
      setSelectedClient(null);
    }
  }, [value, searchResults, searchClients]);

  // Load initial data or when search query changes
  useEffect(() => {
    if (isOpen) {
      const debounceTimer = setTimeout(() => {
        loadClientData(searchQuery);
      }, 300);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchFocus = () => {
    setIsOpen(true);
    // Load initial results when focused
    if (!searchResults.length && !isSearching) {
      loadClientData(searchQuery);
    }
  };

  const handleSelectClient = (client: Client) => {
    console.log("Selecting client:", client.id, client.full_name);
    onChange(client.id);
    setSelectedClient(client);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    console.log("Clearing selected client");
    onChange('');
    setSelectedClient(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCreateClient = () => {
    if (onClientCreate) {
      onClientCreate();
    } else {
      setIsNewClientFormOpen(true);
    }
    setIsOpen(false);
  };

  const handleClientCreated = () => {
    setIsNewClientFormOpen(false);
    // Reload client data after creating a new client
    fetchClients();
    loadClientData();
  };

  // Format date to be more user-friendly
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return null;
      
      // Format: dd/mm/yyyy
      return new Intl.DateTimeFormat('pt-BR').format(date);
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="relative" ref={searchRef}>
      {!selectedClient ? (
        // Search input
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar cliente por nome, telefone, email ou CPF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleSearchFocus}
            disabled={disabled}
            className={`h-10 pl-12 pr-4 py-2 block w-full rounded-md border ${
              error 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
            } shadow-sm focus:outline-none sm:text-sm ${
              disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
            }`}
          />
          {required && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-red-500">*</span>
            </div>
          )}
        </div>
      ) : (
        // Selected client display
        <div className={`flex items-center justify-between rounded-md border px-3 py-2 h-10 ${
          error 
            ? 'border-red-300' 
            : 'border-gray-300'
        } shadow-sm`}>
          <div className="flex items-center">
            <User className="h-5 w-5 text-primary-500 mr-2" />
            <div>
              <p className="text-sm font-medium truncate max-w-[200px]">{selectedClient.full_name}</p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Search results dropdown */}
      {isOpen && !selectedClient && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-300 max-h-80 overflow-auto"
        >
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              <p className="mt-2 text-sm">Buscando clientes...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <ul className="py-1 divide-y divide-gray-100">
              {searchResults.map(client => (
                <li 
                  key={client.id} 
                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectClient(client)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{client.full_name}</span>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-1">
                      {client.phone && (
                        <span className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {client.email}
                        </span>
                      )}
                      {client.cpf && (
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {client.cpf}
                        </span>
                      )}
                      {client.last_visit_date && (
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Última visita: {formatDate(client.last_visit_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <div className="flex flex-col items-center">
                <p className="text-sm">Nenhum cliente encontrado</p>
                <button 
                  type="button"
                  onClick={handleCreateClient}
                  className="mt-2 inline-flex items-center text-primary-600 hover:text-primary-800 text-sm"
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Cadastrar novo cliente
                </button>
              </div>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCreateClient}
                className="w-full text-left text-primary-600 hover:text-primary-800 text-sm flex items-center"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Cadastrar novo cliente
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* New client form modal */}
      {isNewClientFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Novo Cliente
            </h3>
            <ClientForm
              onCancel={() => setIsNewClientFormOpen(false)}
              onSuccess={handleClientCreated}
            />
          </div>
        </div>
      )}
    </div>
  );
}