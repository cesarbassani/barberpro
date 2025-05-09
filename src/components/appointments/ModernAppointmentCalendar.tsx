import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, addMinutes } from 'date-fns';
import { useAppointments, getBusinessHours, getStatusColor, formatStatus } from '../../lib/appointments';
import { useProfiles } from '../../lib/profiles';
import { useServices } from '../../lib/services';
import { useAuth } from '../../lib/auth';
import { useBlockedTimes, type BlockedTime } from '../../lib/blockedTimes';
import { 
  Calendar, 
  Users, 
  User, 
  Clock, 
  Scissors, 
  Plus, 
  Loader2, 
  Filter, 
  RefreshCw,
  ZoomIn, 
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Calendar as CalendarIcon, 
  ListFilter,
  HelpCircle,
  CalendarX,
  CalendarClock,
  CalendarOff
} from 'lucide-react';
import { AppointmentForm } from './AppointmentForm';
import { BlockedTimeForm } from './BlockedTimeForm';
import toast from 'react-hot-toast';
import type { Appointment } from '../../types/database';

interface BarberResource {
  id: string;
  title: string;
  businessHours: {
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
  };
  eventBackgroundColor?: string;
}

const barberColors: Record<string, string> = {
  default: '#3B82F6',  // Blue
  color1: '#EF4444',   // Red
  color2: '#10B981',   // Green
  color3: '#8B5CF6',   // Purple
  color4: '#F59E0B',   // Amber
  color5: '#06B6D4',   // Cyan
};

// Map weekday strings to numbers (0=Sunday, 1=Monday, etc.)
const weekdayMap: Record<string, number> = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

export function ModernAppointmentCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarView, setCalendarView] = useState<string>('timeGridDay');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [resources, setResources] = useState<BarberResource[]>([]);
  const [slotDuration, setSlotDuration] = useState('00:30:00');
  const [isBlockedTimeFormOpen, setIsBlockedTimeFormOpen] = useState(false);
  
  const { 
    appointments, 
    isLoading, 
    error, 
    fetchAppointments, 
    createAppointment, 
    updateAppointment, 
    cancelAppointment,
    moveAppointment 
  } = useAppointments();
  
  const { barbers, fetchBarbers } = useProfiles();
  const { services, fetchServices } = useServices();
  const { profile } = useAuth();
  const { 
    blockedTimes, 
    businessHours,
    fetchBlockedTimes, 
    fetchBlockedTimesByRange,
    fetchBusinessHours,
    createBlockedTime
  } = useBlockedTimes();

  useEffect(() => {
    const currentDate = new Date();
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const loadData = async () => {
      await Promise.all([
        fetchAppointments(start, end),
        fetchBarbers(),
        fetchServices(),
        fetchBusinessHours(),
        fetchBlockedTimesByRange(start, end)
      ]);
    };
    
    loadData();
  }, [fetchAppointments, fetchBarbers, fetchServices, fetchBusinessHours, fetchBlockedTimesByRange]);

  useEffect(() => {
    if (profile?.role === 'barber') {
      setSelectedBarber(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (barbers.length > 0 && businessHours) {
      // Convert business hours weekdays to numbers for FullCalendar
      const weekdays = businessHours.weekdays.map(day => weekdayMap[day]);
      
      // Generate resources from barbers with color assignments
      const barberResources = barbers.map((barber, index) => ({
        id: barber.id,
        title: barber.full_name,
        businessHours: {
          daysOfWeek: weekdays,
          startTime: businessHours.openingTime,
          endTime: businessHours.closingTime
        },
        eventBackgroundColor: Object.values(barberColors)[index % Object.values(barberColors).length]
      }));
      
      setResources(barberResources);
    }
  }, [barbers, businessHours]);

  // Filter appointments based on selected barber
  const filteredAppointments = selectedBarber 
    ? appointments.filter(apt => apt.barber_id === selectedBarber)
    : appointments;

  // Convert appointments to FullCalendar event format
  const events = [
    // Appointments
    ...filteredAppointments.map(appointment => {
      const barber = barbers.find(b => b.id === appointment.barber_id);
      const barberIndex = barbers.findIndex(b => b.id === appointment.barber_id);
      const colorKey = barberIndex !== -1 ? `color${(barberIndex % 5) + 1}` : 'default';
      
      return {
        id: appointment.id,
        resourceId: barber?.id,
        title: `${appointment.client?.full_name} - ${appointment.service?.name}`,
        start: appointment.start_time,
        end: appointment.end_time,
        backgroundColor: getStatusColor(appointment.status),
        borderColor: getStatusColor(appointment.status),
        textColor: '#000000',
        extendedProps: {
          type: 'appointment',
          appointment: appointment,
        }
      };
    }),
    // Blocked Times
    ...blockedTimes
      .filter(block => !selectedBarber || block.barber_id === selectedBarber)
      .map(block => ({
        id: `block-${block.id}`,
        resourceId: block.barber_id,
        title: block.title,
        start: block.start_time,
        end: block.end_time,
        backgroundColor: '#F87171', // Red
        borderColor: '#EF4444',
        textColor: '#FFFFFF',
        allDay: block.is_all_day,
        extendedProps: {
          type: 'blocked',
          block: block,
        }
      }))
  ];

  const handleCreateAppointment = async (data: any) => {
    try {
      const service = services.find(s => s.id === data.service_id);
      if (!service) throw new Error('Serviço não encontrado');

      const startTime = new Date(data.start_time);
      if (isNaN(startTime.getTime())) {
        throw new Error('Data de início inválida');
      }

      // Parse duration from service
      const durationParts = service.duration.split(':');
      const hours = parseInt(durationParts[0], 10) || 0;
      const minutes = parseInt(durationParts[1], 10) || 0;
      
      // Calculate end time
      const endTime = addMinutes(startTime, hours * 60 + minutes);

      const newAppointment = await createAppointment({
        ...data,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'scheduled',
      });

      if (newAppointment) {
        toast.success("Agendamento criado com sucesso!");
        
        if (calendarRef.current) {
          // Refresh calendar
          calendarRef.current.getApi().refetchEvents();
        }
      }

      setIsFormOpen(false);
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error('Erro ao criar agendamento');
      throw error;
    }
  };
  
  const handleCreateBlockedTime = async (data: any) => {
    try {
      await createBlockedTime({
        barber_id: data.barber_id,
        title: data.title,
        description: data.description,
        is_all_day: data.is_all_day,
        start_time: data.start_time,
        end_time: data.end_time,
      });
      
      toast.success("Horário bloqueado com sucesso!");
      
      if (calendarRef.current) {
        // Refresh calendar
        calendarRef.current.getApi().refetchEvents();
      }
      
      setIsBlockedTimeFormOpen(false);
    } catch (error) {
      console.error('Error creating blocked time:', error);
      toast.error('Erro ao bloquear horário');
      throw error;
    }
  };
  
  const handleEventClick = (info: any) => {
    const eventType = info.event.extendedProps.type;
    
    if (eventType === 'appointment') {
      setSelectedAppointment(info.event.extendedProps.appointment);
      setIsDetailModalOpen(true);
    } else if (eventType === 'blocked') {
      // Handle blocked time click (maybe show details or edit form)
      toast.info(`Horário bloqueado: ${info.event.title}`);
    }
  };
  
  const handleDateClick = (info: any) => {
    // If a barber is not selected yet, inform the user
    if (!selectedBarber && profile?.role !== 'barber') {
      toast.error('Selecione um barbeiro antes de criar um agendamento');
      return;
    }
    
    // Set the selected date and open the form
    setSelectedDate(info.date);
    setIsFormOpen(true);
  };
  
  const handleEventChange = async (info: any) => {
    try {
      const eventType = info.event.extendedProps.type;
      
      if (eventType === 'appointment') {
        const appointmentId = info.event.id;
        const newStart = info.event.start;
        const newEnd = info.event.end;
        
        await moveAppointment(appointmentId, newStart, newEnd);
      } else if (eventType === 'blocked') {
        // Handle blocked time movement
        toast.info("A edição de bloqueios deve ser feita através do formulário dedicado.");
        info.revert(); // Revert the drag as we don't support direct editing
      }
    } catch (error) {
      console.error('Error moving event:', error);
      info.revert(); // Revert the drag if there's an error
      toast.error('Erro ao mover evento');
    }
  };
  
  const handleConfirmAppointment = async (id: string) => {
    try {
      await updateAppointment(id, { status: 'confirmed' });
      setIsDetailModalOpen(false);
      toast.success('Agendamento confirmado com sucesso!');
    } catch (error) {
      console.error('Error confirming appointment:', error);
      toast.error('Erro ao confirmar agendamento');
    }
  };
  
  const handleCompleteAppointment = async (id: string) => {
    try {
      await updateAppointment(id, { status: 'completed' });
      setIsDetailModalOpen(false);
      toast.success('Agendamento concluído com sucesso!');
    } catch (error) {
      console.error('Error completing appointment:', error);
      toast.error('Erro ao concluir agendamento');
    }
  };
  
  const handleCancelAppointment = async (id: string) => {
    try {
      await cancelAppointment(id);
      setIsDetailModalOpen(false);
      toast.success('Agendamento cancelado com sucesso!');
    } catch (error) {
      console.error('Error canceling appointment:', error);
      toast.error('Erro ao cancelar agendamento');
    }
  };
  
  const handleZoomIn = () => {
    if (slotDuration === '00:30:00') setSlotDuration('00:15:00');
    if (slotDuration === '01:00:00') setSlotDuration('00:30:00');
  };
  
  const handleZoomOut = () => {
    if (slotDuration === '00:15:00') setSlotDuration('00:30:00');
    if (slotDuration === '00:30:00') setSlotDuration('01:00:00');
  };
  
  const handleRefresh = () => {
    const currentDate = calendarRef.current?.getApi().getDate();
    if (currentDate) {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      Promise.all([
        fetchAppointments(start, end),
        fetchBlockedTimesByRange(start, end)
      ]);
    }
  };
  
  const handleViewChange = (newView: string) => {
    setCalendarView(newView);
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(newView);
    }
  };

  const handleAddBlockedTime = () => {
    if (!selectedBarber && profile?.role !== 'barber') {
      toast.error('Selecione um barbeiro antes de bloquear um horário');
      return;
    }
    
    setIsBlockedTimeFormOpen(true);
  };

  if (isLoading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
          <p className="text-gray-600">Carregando agendamentos...</p>
        </div>
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

  // Get business hours configuration for FullCalendar
  const fullCalendarBusinessHours = businessHours ? {
    daysOfWeek: businessHours.weekdays.map(day => weekdayMap[day]),
    startTime: businessHours.openingTime,
    endTime: businessHours.closingTime
  } : getBusinessHours();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:justify-between md:items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Calendar className="h-6 w-6 mr-2 text-primary-600" />
          Agenda
        </h2>
        
        <div className="flex flex-wrap gap-2">
          <div className="tooltip">
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </button>
            <span className="tooltiptext">
              Crie um novo agendamento para um cliente
            </span>
          </div>
          
          <div className="tooltip">
            <button
              onClick={handleAddBlockedTime}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              <CalendarX className="h-4 w-4 mr-2" />
              Bloquear Horário
            </button>
            <span className="tooltiptext">
              Bloqueie um horário para evitar agendamentos
            </span>
          </div>
          
          <div className="tooltip">
            <button
              onClick={handleRefresh}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </button>
            <span className="tooltiptext">
              Atualiza a visualização dos agendamentos
            </span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Mini Calendar */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-primary-600" />
              Navegação
            </h3>
            
            <div className="flex space-x-2 mb-4">
              <div className="tooltip">
                <button 
                  onClick={() => {
                    if (calendarRef.current) {
                      calendarRef.current.getApi().prev();
                      setSelectedDate(calendarRef.current.getApi().getDate());
                    }
                  }}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <span className="tooltiptext">
                  Ver período anterior
                </span>
              </div>
              
              <div className="tooltip">
                <button
                  onClick={() => {
                    if (calendarRef.current) {
                      calendarRef.current.getApi().next();
                      setSelectedDate(calendarRef.current.getApi().getDate());
                    }
                  }}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
                <span className="tooltiptext">
                  Ver próximo período
                </span>
              </div>
              
              <div className="tooltip">
                <button
                  onClick={() => {
                    if (calendarRef.current) {
                      calendarRef.current.getApi().today();
                      setSelectedDate(calendarRef.current.getApi().getDate());
                    }
                  }}
                  className="flex-grow flex items-center justify-center px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  Hoje
                </button>
                <span className="tooltiptext">
                  Ir para o dia atual
                </span>
              </div>
            </div>
            
            {/* View Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="tooltip">
                <button
                  onClick={() => handleViewChange('timeGridDay')}
                  className={`flex-1 px-3 py-1 text-sm font-medium rounded-md ${
                    calendarView === 'timeGridDay' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Dia
                </button>
                <span className="tooltiptext">
                  Visualizar agenda do dia
                </span>
              </div>
              <div className="tooltip">
                <button
                  onClick={() => handleViewChange('timeGridWeek')}
                  className={`flex-1 px-3 py-1 text-sm font-medium rounded-md ${
                    calendarView === 'timeGridWeek' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Semana
                </button>
                <span className="tooltiptext">
                  Visualizar agenda da semana
                </span>
              </div>
              <div className="tooltip">
                <button
                  onClick={() => handleViewChange('dayGridMonth')}
                  className={`flex-1 px-3 py-1 text-sm font-medium rounded-md ${
                    calendarView === 'dayGridMonth' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  Mês
                </button>
                <span className="tooltiptext">
                  Visualizar agenda mensal
                </span>
              </div>
            </div>
            
            {/* Filter Section */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <ListFilter className="h-4 w-4 mr-1 text-primary-600" />
                Filtrar por Barbeiro
              </h4>
              
              <div className="tooltip">
                <select
                  value={selectedBarber || ''}
                  onChange={(e) => setSelectedBarber(e.target.value || null)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  disabled={profile?.role === 'barber'}
                >
                  <option value="">Todos os barbeiros</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.full_name}
                    </option>
                  ))}
                </select>
                <span className="tooltiptext">
                  Selecione um barbeiro para filtrar os agendamentos
                </span>
              </div>
            </div>
            
            {/* Zoom Controls */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <ZoomIn className="h-4 w-4 mr-1 text-primary-600" />
                Zoom
              </h4>
              <div className="flex space-x-2">
                <div className="tooltip">
                  <button
                    onClick={handleZoomIn}
                    className="flex-1 flex items-center justify-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    disabled={slotDuration === '00:15:00'}
                  >
                    <ZoomIn className="h-4 w-4 mr-1" />
                    Aproximar
                  </button>
                  <span className="tooltiptext">
                    Aumentar o zoom da agenda para ver mais detalhes
                  </span>
                </div>
                <div className="tooltip">
                  <button
                    onClick={handleZoomOut}
                    className="flex-1 flex items-center justify-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    disabled={slotDuration === '01:00:00'}
                  >
                    <ZoomOut className="h-4 w-4 mr-1" />
                    Afastar
                  </button>
                  <span className="tooltiptext">
                    Diminuir o zoom da agenda para ver mais horários
                  </span>
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Status dos Agendamentos</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-300 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Agendado</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Confirmado</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Concluído</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Cancelado</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Horário Bloqueado</span>
                </div>
              </div>
            </div>
            
            {profile?.role === 'admin' && barbers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Cores dos Barbeiros</h4>
                <div className="space-y-2">
                  {barbers.map((barber, index) => (
                    <div key={barber.id} className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-2" 
                        style={{ backgroundColor: Object.values(barberColors)[index % Object.values(barberColors).length] }}
                      ></div>
                      <span className="text-sm text-gray-600">{barber.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={calendarView}
              headerToolbar={false}
              locale="pt-br"
              allDaySlot={true}
              allDayText="Dia Inteiro"
              slotDuration={slotDuration}
              slotMinTime={businessHours?.openingTime || "08:00:00"}
              slotMaxTime={businessHours?.closingTime || "20:00:00"}
              eventDisplay="block"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false
              }}
              businessHours={fullCalendarBusinessHours}
              events={events}
              selectable={true}
              selectMirror={true}
              editable={true}
              droppable={true}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventChange={handleEventChange}
              height="auto"
              aspectRatio={1.8}
              dayMaxEvents={true}
            />
          </div>
        </div>
      </div>
      
      {/* New Appointment Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Novo Agendamento
            </h3>
            <AppointmentForm
              onSubmit={handleCreateAppointment}
              onCancel={() => setIsFormOpen(false)}
              selectedDate={selectedDate}
              initialData={profile?.role === 'barber' ? { barber_id: profile.id } : selectedBarber ? { barber_id: selectedBarber } : undefined}
            />
          </div>
        </div>
      )}
      
      {/* Blocked Time Form Modal */}
      {isBlockedTimeFormOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <CalendarX className="h-5 w-5 mr-2 text-red-500" />
              Bloquear Horário
            </h3>
            <BlockedTimeForm
              onSubmit={handleCreateBlockedTime}
              onCancel={() => setIsBlockedTimeFormOpen(false)}
              selectedDate={selectedDate}
            />
          </div>
        </div>
      )}
      
      {/* Appointment Detail Modal */}
      {isDetailModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Detalhes do Agendamento
              </h3>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Fechar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <User className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Cliente</p>
                  <p className="text-sm text-gray-600">{selectedAppointment.client?.full_name}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Scissors className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Barbeiro</p>
                  <p className="text-sm text-gray-600">{selectedAppointment.barber?.full_name}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Serviço</p>
                  <p className="text-sm text-gray-600">{selectedAppointment.service?.name}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Horário</p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(selectedAppointment.start_time), 'dd/MM/yyyy HH:mm')} - {format(new Date(selectedAppointment.end_time), 'HH:mm')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className={`h-5 w-5 rounded-full mt-0.5 mr-2`} style={{ backgroundColor: getStatusColor(selectedAppointment.status) }}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Status</p>
                  <p className="text-sm text-gray-600">{formatStatus(selectedAppointment.status)}</p>
                </div>
              </div>
              
              {selectedAppointment.notes && (
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-gray-400 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Observações</p>
                    <p className="text-sm text-gray-600">{selectedAppointment.notes}</p>
                  </div>
                </div>
              )}
              
              {(profile?.role === 'admin' || profile?.role === 'barber') && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {selectedAppointment.status === 'scheduled' && (
                      <div className="tooltip">
                        <button
                          onClick={() => handleConfirmAppointment(selectedAppointment.id)}
                          className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                        >
                          Confirmar
                        </button>
                        <span className="tooltiptext">
                          Confirmar agendamento com o cliente
                        </span>
                      </div>
                    )}
                    
                    {(selectedAppointment.status === 'scheduled' || selectedAppointment.status === 'confirmed') && (
                      <div className="tooltip">
                        <button
                          onClick={() => handleCompleteAppointment(selectedAppointment.id)}
                          className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Concluir
                        </button>
                        <span className="tooltiptext">
                          Marcar agendamento como concluído
                        </span>
                      </div>
                    )}
                    
                    {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                      <div className="tooltip">
                        <button
                          onClick={() => handleCancelAppointment(selectedAppointment.id)}
                          className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                        >
                          Cancelar
                        </button>
                        <span className="tooltiptext">
                          Cancelar agendamento
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}