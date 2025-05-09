import React, { useState } from 'react';
import { useLoyalty } from '../../lib/loyalty';
import { Crown, Calendar, XCircle, Plus, Clock, Edit2, Link } from 'lucide-react';
import { LoyaltySubscriptionForm } from './LoyaltySubscriptionForm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LoyaltySubscription } from '../../types/database';
import { createAsaasSubscription, createAsaasCustomer } from '../../lib/asaas';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export function LoyaltySubscriptionList() {
  const { subscriptions = [], isLoading, error, fetchSubscriptions, createSubscription, updateSubscription, cancelSubscription } = useLoyalty();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<LoyaltySubscription | null>(null);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState<string | null>(null);

  React.useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleCreateSubscription = async (data: Omit<LoyaltySubscription, 'id' | 'created_at' | 'updated_at'>) => {
    await createSubscription(data);
    setIsFormOpen(false);
  };

  const handleUpdateSubscription = async (data: Partial<LoyaltySubscription>) => {
    if (editingSubscription) {
      await updateSubscription(editingSubscription.id, data);
      setEditingSubscription(null);
    }
  };

  const handleGeneratePaymentLink = async (subscription: LoyaltySubscription) => {
    try {
      setIsGeneratingPayment(subscription.id);

      // Validate required data
      if (!subscription.client) {
        throw new Error('Cliente não encontrado');
      }

      if (!subscription.client.cpf) {
        throw new Error('Cliente não possui CPF cadastrado');
      }

      if (!subscription.client.email && !subscription.client.phone) {
        throw new Error('Cliente precisa ter email ou telefone cadastrado');
      }

      if (!subscription.plan) {
        throw new Error('Plano não encontrado');
      }

      // If client doesn't have an Asaas customer ID, create one
      let asaasCustomerId = subscription.client.asaas_customer_id;
      if (!asaasCustomerId) {
        try {
          const asaasCustomer = await createAsaasCustomer({
            name: subscription.client.full_name,
            cpfCnpj: subscription.client.cpf,
            email: subscription.client.email || '',
            phone: subscription.client.phone || '',
          });
          asaasCustomerId = asaasCustomer.id;

          // Update client with Asaas ID
          const { error: updateError } = await supabase
            .from('clients')
            .update({ asaas_customer_id: asaasCustomerId })
            .eq('id', subscription.client.id);

          if (updateError) {
            throw updateError;
          }
        } catch (error) {
          console.error('Error creating Asaas customer:', error);
          throw new Error('Erro ao criar cadastro no Asaas. Por favor, verifique as configurações do Asaas e tente novamente.');
        }
      }

      // Create Asaas subscription
      const asaasSubscription = await createAsaasSubscription({
        customer: asaasCustomerId,
        value: subscription.plan.monthly_price,
        nextDueDate: format(new Date(), 'yyyy-MM-dd'),
        description: `Assinatura do plano ${subscription.plan.name}`,
        billingType: subscription.payment_method || 'BOLETO',
      });

      // Update subscription with Asaas ID
      await updateSubscription(subscription.id, {
        asaas_subscription_id: asaasSubscription.id,
      });

      // Show success message
      const paymentMethod = subscription.payment_method === 'BOLETO' 
        ? 'boleto' 
        : subscription.payment_method === 'CREDIT_CARD'
        ? 'cartão de crédito'
        : 'PIX';

      const contactMethod = subscription.client.email && subscription.client.phone
        ? 'email e WhatsApp'
        : subscription.client.email
        ? 'email'
        : 'WhatsApp';

      toast.success(
        `Link de pagamento gerado com sucesso! O cliente receberá as instruções por ${contactMethod} para pagar via ${paymentMethod}.`
      );

      // Refresh subscriptions list
      await fetchSubscriptions();
    } catch (error) {
      console.error('Error generating payment link:', error);
      toast.error(`Erro ao gerar link de pagamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsGeneratingPayment(null);
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
        <h2 className="text-2xl font-bold text-gray-900">Assinaturas</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          title="Criar nova assinatura"
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Assinatura
        </button>
      </div>

      {(isFormOpen || editingSubscription) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingSubscription ? 'Editar Assinatura' : 'Nova Assinatura'}
            </h3>
            <LoyaltySubscriptionForm
              initialData={editingSubscription || undefined}
              onSubmit={editingSubscription ? handleUpdateSubscription : handleCreateSubscription}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingSubscription(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {subscriptions?.map((subscription) => (
            <li key={subscription.id}>
              <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                <div className="flex items-center">
                  <Crown className="h-5 w-5 text-primary-600" />
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {subscription.client?.full_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Plano: {subscription.plan?.name}
                    </p>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>
                        Início: {format(new Date(subscription.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                      {subscription.end_date ? (
                        <>
                          <span className="mx-2">•</span>
                          <span>
                            Término: {format(new Date(subscription.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="mx-2">•</span>
                          <span className="flex items-center text-primary-600">
                            <Clock className="h-4 w-4 mr-1" />
                            Assinatura recorrente
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center space-x-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          subscription.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {subscription.active ? 'Ativa' : 'Inativa'}
                      </span>
                      {subscription.payment_method && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {subscription.payment_method === 'BOLETO' 
                            ? 'Boleto' 
                            : subscription.payment_method === 'CREDIT_CARD'
                            ? 'Cartão de Crédito'
                            : 'PIX'}
                        </span>
                      )}
                      {subscription.asaas_subscription_id && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Asaas ID: {subscription.asaas_subscription_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {!subscription.asaas_subscription_id && (
                    <button
                      onClick={() => handleGeneratePaymentLink(subscription)}
                      disabled={isGeneratingPayment === subscription.id}
                      title="Gerar link de pagamento"
                      className="text-primary-600 hover:text-primary-900 disabled:opacity-50"
                    >
                      <Link className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingSubscription(subscription)}
                    title="Editar assinatura"
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  {subscription.active && (
                    <button
                      onClick={() => cancelSubscription(subscription.id)}
                      title="Cancelar assinatura"
                      className="text-red-600 hover:text-red-900"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {(!subscriptions || subscriptions.length === 0) && (
            <li className="px-4 py-6 text-center text-gray-500">
              Nenhuma assinatura encontrada
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}