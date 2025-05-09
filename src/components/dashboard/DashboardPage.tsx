import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useAppointments } from '../../lib/appointments';
import { useOrders } from '../../lib/orders';
import { useProfiles } from '../../lib/profiles';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, TrendingUp, Users, Clock, Star, AlertTriangle, RefreshCw, WifiOff, CalendarRange, CalendarCheck, Eye, EyeOff } from 'lucide-react';

type PeriodType = 'daily' | 'weekly' | 'monthly';

export function DashboardPage() {
  const { profile } = useAuth();
  const { appointments, fetchAppointments, error: appointmentsError, connectionStatus } = useAppointments();
  const { orders, fetchOrders, error: ordersError } = useOrders();
  const { barbers, fetchBarbers, error: barbersError } = useProfiles();
  const [isLoading, setIsLoading] = React.useState(true);
  const [retryCount, setRetryCount] = React.useState(0);
  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastLoadAttempt, setLastLoadAttempt] = React.useState(0);
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [showCommissions, setShowCommissions] = useState(true);

  // Listen for online/offline events
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = React.useCallback(async () => {
    // Prevent continuous retries within a short time period
    const now = Date.now();
    if (now - lastLoadAttempt < 5000) { // 5-second throttle
      return;
    }
    
    setLastLoadAttempt(now);
    setIsLoading(true);
    
    try {
      // Check if browser is online first
      if (!isOnline) {
        console.log('Device is offline, skipping data fetch');
        setIsLoading(false);
        return;
      }

      let start: Date, end: Date;
      
      // Set date range based on period type
      if (periodType === 'daily') {
        start = startOfDay(new Date());
        end = endOfDay(new Date());
      } else if (periodType === 'weekly') {
        start = startOfWeek(new Date(), { locale: ptBR });
        end = endOfWeek(new Date(), { locale: ptBR });
      } else { // monthly
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
      }
      
      await Promise.all([
        fetchAppointments(start, end),
        fetchOrders(),
        fetchBarbers()
      ]);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setIsLoading(false);
    }
  }, [fetchAppointments, fetchOrders, fetchBarbers, isOnline, lastLoadAttempt, periodType]);

  React.useEffect(() => {
    loadData();
    
    // Set up an interval to retry if connection fails, but limited to 5 attempts
    let intervalId: number;
    if ((connectionStatus === 'disconnected' || !isOnline) && retryCount < 5) {
      intervalId = window.setInterval(() => {
        setRetryCount(prev => prev + 1);
        console.log(`Retry attempt ${retryCount + 1}/5`);
        loadData();
      }, 10000); // Retry every 10 seconds, up to 5 times
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loadData, connectionStatus, retryCount, isOnline]);

  const handleRetry = () => {
    setRetryCount(0);
    loadData();
  };

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriodType(newPeriod);
  };

  // Handle offline state
  if (!isOnline) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
          <WifiOff className="h-16 w-16 text-amber-500" />
          <h2 className="text-2xl font-bold text-gray-900">Sem Conexão</h2>
          <p className="text-gray-600 max-w-md">
            Seu dispositivo está offline. Conecte-se à internet para acessar os dados do sistema.
          </p>
          <button
            onClick={handleRetry}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Handle connection errors
  if (connectionStatus === 'disconnected' && !isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
          <AlertTriangle className="h-16 w-16 text-amber-500" />
          <h2 className="text-2xl font-bold text-gray-900">Problema de Conexão</h2>
          <p className="text-gray-600 max-w-md">
            Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.
          </p>
          <button
            onClick={handleRetry}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Display specific errors if any
  const error = appointmentsError || ordersError || barbersError;
  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900">Erro ao Carregar Dados</h2>
          <p className="text-gray-600 max-w-md">
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Calculate daily stats with appropriate date ranges based on period type
  const getPeriodDateRange = () => {
    let start: Date, end: Date;
    
    if (periodType === 'daily') {
      start = startOfDay(new Date());
      end = endOfDay(new Date());
    } else if (periodType === 'weekly') {
      start = startOfWeek(new Date(), { locale: ptBR });
      end = endOfWeek(new Date(), { locale: ptBR });
    } else { // monthly
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
    }
    
    return { start, end };
  };

  // Period label for display
  const getPeriodLabel = () => {
    if (periodType === 'daily') {
      return 'Hoje';
    } else if (periodType === 'weekly') {
      return 'Esta Semana';
    } else {
      return 'Este Mês';
    }
  };

  const { start, end } = getPeriodDateRange();

  const periodOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    return orderDate >= start && orderDate <= end;
  });

  const dailyStats = barbers.map(barber => {
    const barberOrders = periodOrders.filter(o => o.barber_id === barber.id && o.status === 'completed');

    const totalServices = barberOrders.reduce((sum, order) => 
      sum + order.items.filter(item => item.service_id).length, 0);

    const totalProducts = barberOrders.reduce((sum, order) => 
      sum + order.items.filter(item => item.product_id).length, 0);

    const totalCommission = barberOrders.reduce((sum, order) => 
      sum + Number(order.commission_amount || 0), 0);

    return {
      barber,
      totalServices,
      totalProducts,
      totalOrders: barberOrders.length,
      totalCommission,
      averageItemsPerOrder: barberOrders.length > 0 
        ? (totalServices + totalProducts) / barberOrders.length 
        : 0
    };
  }).sort((a, b) => b.totalCommission - a.totalCommission);

  // Calculate total commissions for all barbers in the period
  const totalCommissions = dailyStats.reduce((sum, stat) => sum + stat.totalCommission, 0);

  // Filter appointments based on role and period
  const relevantAppointments = appointments.filter(a => {
    const appointmentDate = new Date(a.start_time);
    const isInPeriod = appointmentDate >= start && appointmentDate <= end;
    
    return profile?.role === 'admin' 
      ? isInPeriod 
      : isInPeriod && a.barber_id === profile?.id;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {profile?.role === 'admin' ? 'Dashboard Administrativo' : 'Meu Dashboard'}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePeriodChange('daily')}
            className={`px-2 py-1 text-sm rounded-md ${
              periodType === 'daily' 
                ? 'bg-primary-100 text-primary-800' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 inline mr-1" />
            Diário
          </button>
          <button
            onClick={() => handlePeriodChange('weekly')}
            className={`px-2 py-1 text-sm rounded-md ${
              periodType === 'weekly' 
                ? 'bg-primary-100 text-primary-800' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CalendarRange className="h-3.5 w-3.5 inline mr-1" />
            Semanal
          </button>
          <button
            onClick={() => handlePeriodChange('monthly')}
            className={`px-2 py-1 text-sm rounded-md ${
              periodType === 'monthly' 
                ? 'bg-primary-100 text-primary-800' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CalendarCheck className="h-3.5 w-3.5 inline mr-1" />
            Mensal
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Agendamentos {getPeriodLabel()}</p>
              <p className="text-2xl font-semibold text-gray-900">{relevantAppointments.length}</p>
            </div>
          </div>
        </div>

        {profile?.role === 'admin' ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Barbeiros Ativos</p>
                <p className="text-2xl font-semibold text-gray-900">{barbers.length}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Serviços Realizados</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dailyStats.find(s => s.barber.id === profile?.id)?.totalServices || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Produtos Vendidos</p>
              <p className="text-2xl font-semibold text-gray-900">
                {dailyStats
                  .find(s => profile?.role === 'admin' || s.barber.id === profile?.id)
                  ?.totalProducts || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Clientes Atendidos</p>
              <p className="text-2xl font-semibold text-gray-900">
                {dailyStats
                  .find(s => profile?.role === 'admin' || s.barber.id === profile?.id)
                  ?.totalOrders || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking */}
        {profile?.role === 'admin' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Ranking {periodType === 'daily' ? 'do Dia' : periodType === 'weekly' ? 'da Semana' : 'do Mês'}
                </h3>
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setShowCommissions(!showCommissions)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                    title={showCommissions ? "Ocultar valores" : "Mostrar valores"}
                  >
                    {showCommissions ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                  {showCommissions && (
                    <div className="text-sm font-medium text-green-700 flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Total: R$ {totalCommissions.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {dailyStats.map((stat, index) => (
                  <div key={stat.barber.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                          <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{stat.barber.full_name}</p>
                          <div className="flex items-center mt-1">
                            <span className="text-xs text-gray-500 mr-3">{stat.totalServices} serviços</span>
                            {stat.totalProducts > 0 && <span className="text-xs text-gray-500">{stat.totalProducts} produtos</span>}
                          </div>
                        </div>
                      </div>
                      {showCommissions && (
                        <div className="text-sm font-semibold text-green-600">
                          R$ {stat.totalCommission.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="ml-12">
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary-600 bg-primary-200">
                              Progresso
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold inline-block text-primary-600">
                              {Math.round((stat.totalCommission / (totalCommissions || 1)) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-200">
                          <div
                            style={{ width: `${(stat.totalCommission / (Math.max(...dailyStats.map(s => s.totalCommission), 1))) * 100}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {dailyStats.length === 0 && (
                  <p className="text-center text-gray-500">Nenhum atendimento {periodType === 'daily' ? 'hoje' : periodType === 'weekly' ? 'esta semana' : 'este mês'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appointments */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {profile?.role === 'admin' ? 'Próximos Atendimentos' : 'Minha Agenda de Hoje'}
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {relevantAppointments
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map(appointment => (
                  <div key={appointment.id} className="flex items-center">
                    <div className="flex-shrink-0">
                      <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {appointment.client?.full_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(appointment.start_time), 'dd/MM HH:mm')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          {appointment.service?.name}
                        </p>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            appointment.status === 'scheduled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : appointment.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {appointment.status === 'scheduled'
                            ? 'Agendado'
                            : appointment.status === 'confirmed'
                            ? 'Confirmado'
                            : appointment.status === 'completed'
                            ? 'Concluído'
                            : 'Cancelado'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              {relevantAppointments.length === 0 && (
                <p className="text-center text-gray-500">
                  Nenhum agendamento para {periodType === 'daily' ? 'hoje' : periodType === 'weekly' ? 'esta semana' : 'este mês'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barber Commission Section */}
      {profile?.role === 'barber' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Minhas Comissões</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{periodType === 'daily' ? 'Hoje' : periodType === 'weekly' ? 'Esta Semana' : 'Este Mês'}</p>
                    <p className="text-xl font-semibold text-gray-900">
                      R$ {dailyStats.find(s => s.barber.id === profile.id)?.totalCommission.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Comissão Serviços</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {profile.service_commission_rate}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Comissão Produtos</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {profile.product_commission_rate}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Evolução de Comissões</h4>
                <p className="text-xs text-gray-500">Meta: R$ 1.000,00 por mês</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min((dailyStats.find(s => s.barber.id === profile.id)?.totalCommission || 0) / 10, 100)}%` }}>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}