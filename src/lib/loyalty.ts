import { create } from 'zustand';
import toast from 'react-hot-toast';
import { supabase } from './supabase';
import type { LoyaltyPlan, LoyaltySubscription } from '../types/database';

interface LoyaltyState {
  plans: LoyaltyPlan[] | null;
  subscriptions: LoyaltySubscription[] | null;
  isLoading: boolean;
  error: string | null;
  fetchPlans: () => Promise<void>;
  createPlan: (plan: Omit<LoyaltyPlan, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePlan: (id: string, plan: Partial<LoyaltyPlan>) => Promise<void>;
  togglePlanStatus: (id: string) => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  createSubscription: (subscription: Omit<LoyaltySubscription, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateSubscription: (id: string, subscription: Partial<LoyaltySubscription>) => Promise<void>;
  cancelSubscription: (id: string) => Promise<void>;
  addServiceToPlan: (planId: string, serviceId: string, usesPerMonth: number) => Promise<void>;
  removeServiceFromPlan: (planId: string, serviceId: string) => Promise<void>;
  getActiveSubscriptionForClient: (clientId: string) => Promise<{ 
    subscription: LoyaltySubscription & { 
      plan: LoyaltyPlan;
      plan_services: Array<{ service_id: string; uses_per_month: number }>;
    } 
  } | null>;
  checkServiceCoverage: (clientId: string, serviceId: string) => Promise<{
    isCovered: boolean;
    usesLeft: number;
    usedCount: number;
    totalAllowed: number;
  }>;
  useServiceFromPlan: (subscriptionId: string, serviceId: string, transactionId: string) => Promise<void>;
  getLoyaltyReport: (clientId: string) => Promise<any>;
}

export const useLoyalty = create<LoyaltyState>((set, get) => ({
  plans: null,
  subscriptions: null,
  isLoading: false,
  error: null,

  fetchPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('loyalty_plans')
        .select(`
          *,
          loyalty_plan_services (
            id,
            service_id,
            uses_per_month,
            service:services(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ plans: data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar planos';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  createPlan: async (plan) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('loyalty_plans')
        .insert(plan);

      if (error) throw error;
      await get().fetchPlans();
      toast.success('Plano criado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar plano';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePlan: async (id, plan) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('loyalty_plans')
        .update(plan)
        .eq('id', id);

      if (error) throw error;
      await get().fetchPlans();
      toast.success('Plano atualizado com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar plano';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  togglePlanStatus: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const plan = get().plans?.find(p => p.id === id);
      if (!plan) throw new Error('Plano não encontrado');

      const { error } = await supabase
        .from('loyalty_plans')
        .update({ active: !plan.active })
        .eq('id', id);

      if (error) throw error;
      await get().fetchPlans();
      toast.success(`Plano ${plan.active ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao alterar status do plano';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSubscriptions: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('loyalty_subscriptions')
        .select(`
          *,
          client:clients(*),
          plan:loyalty_plans(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ subscriptions: data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar assinaturas';
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isLoading: false });
    }
  },

  createSubscription: async (subscription) => {
    set({ isLoading: true, error: null });
    try {
      // Filter out the send_to_asaas field which doesn't exist in the database
      const { send_to_asaas, ...dataForDb } = subscription as any;
      
      const { error } = await supabase
        .from('loyalty_subscriptions')
        .insert(dataForDb);

      if (error) throw error;
      await get().fetchSubscriptions();
      toast.success('Assinatura criada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar assinatura';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateSubscription: async (id, subscription) => {
    set({ isLoading: true, error: null });
    try {
      // Filter out the send_to_asaas field which doesn't exist in the database
      const { send_to_asaas, ...dataForDb } = subscription as any;
      
      const { error } = await supabase
        .from('loyalty_subscriptions')
        .update(dataForDb)
        .eq('id', id);

      if (error) throw error;
      await get().fetchSubscriptions();
      toast.success('Assinatura atualizada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar assinatura';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  cancelSubscription: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('loyalty_subscriptions')
        .update({ active: false, end_date: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().fetchSubscriptions();
      toast.success('Assinatura cancelada com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar assinatura';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  addServiceToPlan: async (planId: string, serviceId: string, usesPerMonth: number) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('loyalty_plan_services')
        .insert({
          plan_id: planId,
          service_id: serviceId,
          uses_per_month: usesPerMonth
        });

      if (error) throw error;
      await get().fetchPlans();
      toast.success('Serviço adicionado ao plano com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar serviço ao plano';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  removeServiceFromPlan: async (planId: string, serviceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('loyalty_plan_services')
        .delete()
        .eq('plan_id', planId)
        .eq('service_id', serviceId);

      if (error) throw error;
      await get().fetchPlans();
      toast.success('Serviço removido do plano com sucesso!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover serviço do plano';
      set({ error: errorMessage });
      toast.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Get active subscription for a client with plan details
  getActiveSubscriptionForClient: async (clientId: string) => {
    try {
      // Get active subscription - using limit(1) instead of single() to avoid errors when no subscription is found
      const { data: subscriptions, error } = await supabase
        .from('loyalty_subscriptions')
        .select(`
          *,
          plan:loyalty_plans(*)
        `)
        .eq('client_id', clientId)
        .eq('active', true)
        .limit(1);

      if (error) throw error;

      // Check if we have any subscriptions
      if (!subscriptions || subscriptions.length === 0) {
        return null;
      }

      const subscription = subscriptions[0];

      // Get services included in the plan
      const { data: planServices, error: planServicesError } = await supabase
        .from('loyalty_plan_services')
        .select('service_id, uses_per_month')
        .eq('plan_id', subscription.plan.id);

      if (planServicesError) throw planServicesError;

      return { 
        subscription: {
          ...subscription,
          plan_services: planServices || []
        }
      };
    } catch (err) {
      console.error('Error getting active subscription:', err);
      return null;
    }
  },
  
  // Check if a service is covered by client's active subscription
  checkServiceCoverage: async (clientId: string, serviceId: string) => {
    try {
      const subscriptionData = await get().getActiveSubscriptionForClient(clientId);
      
      if (!subscriptionData) {
        return { 
          isCovered: false, 
          usesLeft: 0, 
          usedCount: 0,
          totalAllowed: 0 
        };
      }

      const { subscription } = subscriptionData;
      
      // Check if service is included in plan
      const planService = subscription.plan_services.find(ps => ps.service_id === serviceId);
      
      if (!planService) {
        return { 
          isCovered: false, 
          usesLeft: 0, 
          usedCount: 0,
          totalAllowed: 0 
        };
      }

      // Get current month usage
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      
      const { count, error } = await supabase
        .from('loyalty_service_usage')
        .select('id', { count: 'exact' })
        .eq('subscription_id', subscription.id)
        .eq('service_id', serviceId)
        .gte('used_at', startOfMonth.toISOString())
        .lte('used_at', endOfMonth.toISOString());

      if (error) throw error;
      
      const usedCount = count || 0;
      const usesLeft = Math.max(0, planService.uses_per_month - usedCount);
      
      return {
        isCovered: usesLeft > 0,
        usesLeft,
        usedCount,
        totalAllowed: planService.uses_per_month
      };
    } catch (err) {
      console.error('Error checking service coverage:', err);
      return { 
        isCovered: false, 
        usesLeft: 0, 
        usedCount: 0,
        totalAllowed: 0 
      };
    }
  },
  
  // Record service usage
  useServiceFromPlan: async (subscriptionId: string, serviceId: string, transactionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('loyalty_service_usage')
        .insert({
          subscription_id: subscriptionId,
          service_id: serviceId,
          transaction_id: transactionId,
          used_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log('Service usage recorded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar uso do serviço';
      set({ error: errorMessage });
      console.error(errorMessage);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // Get loyalty report for a client
  getLoyaltyReport: async (clientId: string) => {
    try {
      // Get active subscription
      const subscriptionData = await get().getActiveSubscriptionForClient(clientId);
      
      if (!subscriptionData) {
        return { 
          hasSubscription: false,
          report: null
        };
      }

      const { subscription } = subscriptionData;
      
      // Get current month usage
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      
      // Get usage for each service in the plan
      const report = [];
      
      for (const planService of subscription.plan_services) {
        const { count, error } = await supabase
          .from('loyalty_service_usage')
          .select('id', { count: 'exact' })
          .eq('subscription_id', subscription.id)
          .eq('service_id', planService.service_id)
          .gte('used_at', startOfMonth.toISOString())
          .lte('used_at', endOfMonth.toISOString());
          
        if (error) throw error;
        
        // Get service details
        const { data: serviceData, error: serviceError } = await supabase
          .from('services')
          .select('name, price')
          .eq('id', planService.service_id)
          .single();
          
        if (serviceError && serviceError.code !== 'PGRST116') throw serviceError;
        
        report.push({
          service_id: planService.service_id,
          service_name: serviceData?.name || 'Serviço desconhecido',
          service_price: serviceData?.price || 0,
          allowed_uses: planService.uses_per_month,
          used_count: count || 0,
          uses_left: Math.max(0, planService.uses_per_month - (count || 0)),
          usage_percentage: ((count || 0) / planService.uses_per_month) * 100
        });
      }
      
      return {
        hasSubscription: true,
        subscription,
        report
      };
    } catch (err) {
      console.error('Error generating loyalty report:', err);
      return { 
        hasSubscription: false,
        error: err instanceof Error ? err.message : 'Erro ao gerar relatório',
        report: null
      };
    }
  }
}));