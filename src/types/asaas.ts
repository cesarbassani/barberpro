// Asaas API Response Types
export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  mobilePhone: string;
  cpfCnpj: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
  city: string;
  state: string;
  country: string;
  foreignCustomer: boolean;
  notificationDisabled: boolean;
  additionalEmails: string;
  municipalInscription: string;
  stateInscription: string;
  observations: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  deleted: boolean;
}

export interface AsaasWebhookEvent {
  event: string;
  payment: {
    id: string;
    subscription: string;
    status: 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH';
  };
}