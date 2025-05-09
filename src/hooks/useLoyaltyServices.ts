import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useLoyaltyServices() {
  const [loyaltyServices, setLoyaltyServices] = useState<any[]>([]);
  const [usageReport, setUsageReport] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all loyalty plans and their services
  const loadLoyaltyServices = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('loyalty_plan_services')
        .select(`
          id, 
          uses_per_month,
          loyalty_plan: plan_id (
            id, 
            name, 
            description, 
            monthly_price
          ),
          service: service_id (
            id, 
            name, 
            price, 
            duration
          )
        `)
        .order('id');
      
      if (error) throw error;
      setLoyaltyServices(data || []);
    } catch (err) {
      setError('Erro ao carregar serviços de planos de fidelidade');
      console.error('Error loading loyalty services:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate usage report for a specific client
  const generateUsageReport = async (clientId: string, startDate?: Date, endDate?: Date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Format dates for query
      const startDateStr = startDate 
        ? startDate.toISOString() 
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        
      const endDateStr = endDate 
        ? endDate.toISOString()
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();
      
      // Get client's active subscription
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('loyalty_subscriptions')
        .select(`
          id,
          plan_id,
          plan:loyalty_plans(
            name,
            monthly_price
          ),
          start_date,
          end_date,
          active
        `)
        .eq('client_id', clientId)
        .eq('active', true)
        .limit(1);
      
      if (subscriptionError) throw subscriptionError;
      
      if (!subscriptions || subscriptions.length === 0) {
        setUsageReport([]);
        return;
      }
      
      const subscription = subscriptions[0];
      
      // Get services allowed in the plan
      const { data: planServices, error: planServicesError } = await supabase
        .from('loyalty_plan_services')
        .select(`
          service_id,
          uses_per_month,
          service:services(
            name,
            price
          )
        `)
        .eq('plan_id', subscription.plan_id);
      
      if (planServicesError) throw planServicesError;
      
      // Get actual usage
      const { data: usages, error: usageError } = await supabase
        .from('loyalty_service_usage')
        .select(`
          service_id,
          used_at,
          service:services(name)
        `)
        .eq('subscription_id', subscription.id)
        .gte('used_at', startDateStr)
        .lte('used_at', endDateStr);
      
      if (usageError) throw usageError;
      
      // Generate report
      const report = (planServices || []).map(planService => {
        const serviceUsages = (usages || [])
          .filter(usage => usage.service_id === planService.service_id);
        
        return {
          service_id: planService.service_id,
          service_name: planService.service?.name,
          service_price: planService.service?.price,
          allowed_uses: planService.uses_per_month,
          used: serviceUsages.length,
          remaining: planService.uses_per_month - serviceUsages.length,
          usage_percentage: (serviceUsages.length / planService.uses_per_month) * 100,
          last_used: serviceUsages.length > 0 
            ? new Date(Math.max(...serviceUsages.map(u => new Date(u.used_at).getTime())))
            : null
        };
      });
      
      setUsageReport(report);
    } catch (err) {
      setError('Erro ao gerar relatório de uso');
      console.error('Error generating usage report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadLoyaltyServices();
  }, []);

  return {
    loyaltyServices,
    usageReport,
    isLoading,
    error,
    loadLoyaltyServices,
    generateUsageReport,
  };
}