export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'client' | 'barber' | 'admin';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'refunded';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix';
export type OrderStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type AsaasPaymentMethod = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'CASH';
export type CashOperationType = 'open' | 'close' | 'sale' | 'payment' | 'withdrawal' | 'deposit';
export type TransactionCategory = 'sale' | 'payment' | 'withdrawal' | 'deposit' | 'adjustment';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  email: string | null;
  service_commission_rate: number | null;
  product_commission_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  email: string | null;
  cpf: string | null;
  notes: string | null;
  visit_count: number | null;
  last_visit_date: string | null;
  asaas_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  type: 'service' | 'product' | 'both';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  price: number;
  category_id: string | null;
  category?: Category | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  min_stock_alert: number;
  category_id: string | null;
  category?: Category | null;
  active: boolean;
  sku?: string | null;
  cost_price?: number | null;
  last_restock_date?: string | null;
  reorder_point?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  barber_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  barber?: Profile;
  service?: Service;
}

export interface Transaction {
  id: string;
  client_id: string;
  barber_id: string | null;
  appointment_id: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total_amount: number;
  commission_amount: number | null;
  status: OrderStatus;
  is_monthly_billing: boolean;
  cash_register_closing_date: string | null;
  is_cash_register_closed: boolean;
  created_at: string;
  updated_at: string;
  client?: Client;
  barber?: Profile;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  service_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_loyalty_service?: boolean;
  subscription_id?: string | null;
  professional_id?: string | null;
  created_at: string;
}

export interface LoyaltyPoints {
  id: string;
  client_id: string;
  transaction_id: string;
  points_earned: number;
  points_redeemed: number;
  created_at: string;
}

export interface LoyaltyPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  product_discount_percentage: number;
  service_discount_percentage: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPlanService {
  id: string;
  plan_id: string;
  service_id: string;
  uses_per_month: number;
  created_at: string;
  updated_at: string;
  service?: Service;
}

export interface LoyaltySubscription {
  id: string;
  client_id: string;
  plan_id: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  is_recurring: boolean;
  asaas_subscription_id: string | null;
  payment_method: AsaasPaymentMethod | null;
  created_at: string;
  updated_at: string;
  plan?: LoyaltyPlan;
  client?: Client;
}

export interface LoyaltyServiceUsage {
  id: string;
  subscription_id: string;
  service_id: string;
  used_at: string;
  transaction_id: string;
  service?: Service;
}

export interface CashRegister {
  id: string;
  opening_employee_id: string;
  closing_employee_id?: string;
  opened_at: string;
  closed_at?: string;
  initial_amount: number;
  final_amount?: number;
  expected_amount?: number;
  difference_amount?: number;
  notes?: string;
  status: 'open' | 'closed';
  next_day_amount: number;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  cash_register_id: string;
  employee_id: string;
  amount: number;
  operation_type: CashOperationType;
  payment_method: PaymentMethod;
  description?: string;
  reference_id?: string;
  category: TransactionCategory;
  created_at: string;
}

export interface Settings {
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}