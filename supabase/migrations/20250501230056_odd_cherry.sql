/*
  # Business Settings Tables and Structure
  
  1. Changes
    - Add JSON settings table structure if it doesn't exist
    - Improve schema for storing business configuration
    
  2. Security
    - Maintain proper access control
    - Ensure data integrity
*/

-- Make sure settings table exists
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings if they don't exist
INSERT INTO settings (key, value)
VALUES 
  ('business_hours', jsonb_build_object(
    'weekdays', array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    'openingTime', '08:00',
    'closingTime', '20:00',
    'slotDuration', 30,
    'holidays', jsonb_build_array()
  ))
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('company_info', jsonb_build_object(
    'companyName', 'BarberPro Ltda',
    'tradingName', 'BarberPro',
    'cnpj', '00.000.000/0000-00',
    'address', jsonb_build_object(
      'street', 'Rua Exemplo',
      'number', '123',
      'neighborhood', 'Centro',
      'city', 'São Paulo',
      'state', 'SP',
      'postalCode', '00000-000'
    ),
    'contact', jsonb_build_object(
      'phone', '(11) 0000-0000',
      'mobilePhone', '(11) 00000-0000',
      'email', 'contato@barberpro.com'
    ),
    'branding', jsonb_build_object(
      'primaryColor', '#0284c7',
      'secondaryColor', '#075985'
    )
  ))
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('operational_settings', jsonb_build_object(
    'scheduling', jsonb_build_object(
      'defaultAppointmentDuration', 30,
      'minAdvanceTimeMinutes', 30,
      'maxAdvanceDays', 30,
      'allowReschedule', true,
      'rescheduleMinTimeHours', 24,
      'allowCancellation', true,
      'cancellationMinTimeHours', 24,
      'bufferBetweenAppointmentsMinutes', 5
    ),
    'capacity', jsonb_build_object(
      'maxConcurrentClients', 5,
      'maxConcurrentAppointmentsPerBarber', 1,
      'maxDailyAppointmentsPerBarber', 10,
      'enableWaitlist', false,
      'overbookingAllowed', false,
      'overbookingLimit', 0
    ),
    'notifications', jsonb_build_object(
      'appointmentReminders', true,
      'reminderTimeHours', 24,
      'sendConfirmationEmails', true,
      'sendCancellationNotices', true,
      'notifyBarberOnNewAppointment', true
    )
  ))
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('financial_settings', jsonb_build_object(
    'paymentMethods', jsonb_build_object(
      'acceptCash', true,
      'acceptCreditCard', true,
      'acceptDebitCard', true,
      'acceptPix', true
    ),
    'taxes', jsonb_build_object(
      'taxRate', 0,
      'applyTaxToServices', false,
      'applyTaxToProducts', true,
      'includeTaxInPrice', true,
      'displayTaxSeparately', false
    ),
    'discounts', jsonb_build_object(
      'enableDiscounts', true,
      'maxDiscountPercentage', 10,
      'allowEmployeesToGiveDiscounts', false,
      'requireApprovalAbove', 5
    ),
    'commissions', jsonb_build_object(
      'defaultServiceCommission', 50,
      'defaultProductCommission', 10,
      'payCommissionsOnCancelled', false,
      'commissionCalculationPeriod', 'biweekly'
    ),
    'invoicing', jsonb_build_object(
      'enableAutomaticReceipts', true,
      'invoicePrefix', 'BP-',
      'invoiceStartNumber', 1001
    )
  ))
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('customization_settings', jsonb_build_object(
    'customFields', jsonb_build_array(),
    'reportTemplates', jsonb_build_array(
      jsonb_build_object(
        'name', 'Relatório de Vendas Diário',
        'description', 'Resumo de vendas do dia',
        'type', 'sales',
        'isEnabled', true
      ),
      jsonb_build_object(
        'name', 'Comissões dos Barbeiros',
        'description', 'Relatório de comissões por barbeiro',
        'type', 'commissions',
        'isEnabled', true
      )
    ),
    'notifications', jsonb_build_object(
      'lowStockAlert', true,
      'birthdayReminders', true,
      'appointmentConfirmation', true,
      'salesReports', true,
      'dailyClosingSummary', true
    ),
    'permissions', jsonb_build_object(
      'barberCanManageProducts', false,
      'barberCanViewReports', false,
      'barberCanViewAllAppointments', false,
      'barberCanManageOwnBlockedTimes', true,
      'clientCanCancelAppointment', true,
      'clientCanRescheduleAppointment', true
    ),
    'displaySettings', jsonb_build_object(
      'showClientPhoneInAppointments', true,
      'showBarberCommissionInReports', true,
      'roundPricesToNearest', '0.01',
      'dateFormat', 'DD/MM/YYYY',
      'timeFormat', '24h'
    )
  ))
ON CONFLICT (key) DO NOTHING;

-- Make sure the function to update updated_at timestamp exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or replace trigger for settings
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();