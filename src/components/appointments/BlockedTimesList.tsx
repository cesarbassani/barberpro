import React, { useState, useEffect } from 'react';
import { useBlockedTimes, type BlockedTime } from '../../lib/blockedTimes';
import { useAuth } from '../../lib/auth';
import { Calendar, User, Clock, Trash2, Edit, CalendarX, Filter, Search } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BlockedTimeForm } from './BlockedTimeForm';

export function BlockedTimesList() {
  const { blockedTimes, isLoading, error, fetchBlockedTimes, deleteBlockedTime } = useBlockedTimes();
  const { profile } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BlockedTime | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    // If user is barber, only fetch their blocked times
    if (profile?.role === 'barber') {
      fetchBlockedTimes(profile.id);
    } else {
      fetchBlockedTimes();
    }
  }, [fetchBlockedTimes, profile]);

  const handleDeleteBlock = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este bloqueio?')) {
      await deleteBlockedTime(id);
    }
  };

  const handleEditBlock = (block: BlockedTime) => {
    setEditingBlock(block);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: any) => {
    // This will be handled by the parent component
    console.log('Block submitted:', data);
    setIsFormOpen(false);
    setEditingBlock(null);
  };

  // Filter blocked times based on selected filter
  const filteredBlockedTimes = blockedTimes.filter(block => {
    const startDate = new Date(block.start_time);
    
    // Apply date filter
    if (selectedFilter === 'today' && !isToday(startDate)) return false;
    if (selectedFilter === 'tomorrow' && !isTomorrow(startDate)) return false;
    if (selectedFilter === 'thisWeek' && !isThisWeek(startDate, { weekStartsOn: 1 })) return false;
    if (selectedFilter === 'thisMonth' && !isThisMonth(startDate)) return false;
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        block.title.toLowerCase().includes(query) ||
        (block.description && block.description.toLowerCase().includes(query)) ||
        (block.barber?.full_name.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  // Format date for display
  const formatBlockedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    
    if (isToday(date)) {
      return `Hoje, ${format(date, 'HH:mm')}`;
    } else if (isTomorrow(date)) {
      return `Amanhã, ${format(date, 'HH:mm')}`;
    } else {
      return format(date, "dd 'de' MMMM, HH:mm", { locale: ptBR });
    }
  };

  if (isLoading && blockedTimes.length === 0) {
    return (
      <div className="flex justify-center items-center h-32">
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
      {/* Filters and Search */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar bloqueios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        
        <div className="flex-shrink-0">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as any)}
            className="h-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option value="all">Todos os bloqueios</option>
            <option value="today">Hoje</option>
            <option value="tomorrow">Amanhã</option>
            <option value="thisWeek">Esta semana</option>
            <option value="thisMonth">Este mês</option>
          </select>
        </div>
      </div>

      {/* Blocked times list */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredBlockedTimes.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarX className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum bloqueio encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery 
                ? 'Tente outra busca ou remova os filtros aplicados.' 
                : 'Ainda não há horários bloqueados para este período.'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => setIsFormOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Bloquear Horário
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredBlockedTimes.map((block) => (
              <li key={block.id} className={`px-4 py-4 sm:px-6 hover:bg-gray-50 
                ${isToday(new Date(block.start_time)) ? 'bg-yellow-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CalendarX className="h-5 w-5 text-red-500 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{block.title}</h3>
                      {block.description && (
                        <p className="text-sm text-gray-500">{block.description}</p>
                      )}
                      <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                        {profile?.role === 'admin' && (
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            <p>{block.barber?.full_name}</p>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          <p>
                            {block.is_all_day ? 'Dia inteiro' : (
                              <>
                                {formatBlockedDate(block.start_time)} até {format(new Date(block.end_time), "HH:mm")}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditBlock(block)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Editar bloqueio"
                    >
                      <Edit className="h-5 w-5" />
                      <span className="sr-only">Editar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Remover bloqueio"
                    >
                      <Trash2 className="h-5 w-5" />
                      <span className="sr-only">Excluir</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingBlock ? 'Editar Bloqueio' : 'Novo Bloqueio'}
            </h3>
            <BlockedTimeForm
              initialData={editingBlock || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingBlock(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}