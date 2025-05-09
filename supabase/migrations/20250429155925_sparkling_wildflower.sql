/*
  # Sistema de Gerenciamento de Caixa
  
  1. New Tables
    - `cash_registers` - Controle de abertura e fechamento de caixa
    - `cash_register_transactions` - Movimentações detalhadas do caixa
    
  2. Changes
    - Adiciona controle de abertura/fechamento
    - Adiciona categorização de entradas/saídas
    - Suporte a sangrias e suprimentos
    - Controle de saldos e conferência
    
  3. Security
    - Maintain proper access control
    - Ensure data integrity
*/

-- Tipo para operações do caixa
CREATE TYPE cash_operation_type AS ENUM ('open', 'close', 'sale', 'payment', 'withdrawal', 'deposit');

-- Tipo para categorias de transação
CREATE TYPE transaction_category AS ENUM ('sale', 'payment', 'withdrawal', 'deposit', 'adjustment');

-- Tabela de caixas
CREATE TABLE cash_registers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opening_employee_id uuid REFERENCES profiles(id) NOT NULL,
  closing_employee_id uuid REFERENCES profiles(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  initial_amount decimal(10,2) NOT NULL DEFAULT 0,
  final_amount decimal(10,2),
  expected_amount decimal(10,2),
  difference_amount decimal(10,2),
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  next_day_amount decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tabela de transações do caixa
CREATE TABLE cash_register_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_register_id uuid REFERENCES cash_registers(id) NOT NULL,
  employee_id uuid REFERENCES profiles(id) NOT NULL,
  amount decimal(10,2) NOT NULL,
  operation_type cash_operation_type NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  description text,
  reference_id uuid, -- Pode ser ID de transação, pedido, etc.
  category transaction_category NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para caixas
CREATE POLICY "Admin and barbers can read cash registers"
  ON cash_registers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

CREATE POLICY "Admin and barbers can insert cash registers"
  ON cash_registers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

CREATE POLICY "Admin and barbers can update cash registers"
  ON cash_registers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

-- Políticas para transações do caixa
CREATE POLICY "Admin and barbers can read cash register transactions"
  ON cash_register_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

CREATE POLICY "Admin and barbers can insert cash register transactions"
  ON cash_register_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

-- Função para verificar se há caixa aberto
CREATE OR REPLACE FUNCTION is_cash_register_open()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  open_register_count integer;
BEGIN
  SELECT COUNT(*) 
  INTO open_register_count
  FROM cash_registers
  WHERE status = 'open';
  
  RETURN open_register_count > 0;
END;
$$;

-- Função para obter o caixa atualmente aberto
CREATE OR REPLACE FUNCTION get_current_cash_register()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  register_id uuid;
BEGIN
  SELECT id 
  INTO register_id
  FROM cash_registers
  WHERE status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;
  
  RETURN register_id;
END;
$$;

-- Função para calcular o saldo atual do caixa
CREATE OR REPLACE FUNCTION calculate_cash_register_balance(register_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  initial_amount decimal(10,2);
  transactions_sum decimal(10,2);
  balance decimal(10,2);
BEGIN
  -- Obter valor inicial
  SELECT cr.initial_amount
  INTO initial_amount
  FROM cash_registers cr
  WHERE cr.id = register_id;
  
  -- Calcular soma das transações
  SELECT COALESCE(SUM(
    CASE 
      WHEN crt.operation_type IN ('sale', 'deposit') THEN crt.amount
      WHEN crt.operation_type IN ('payment', 'withdrawal') THEN -crt.amount
      ELSE 0
    END
  ), 0)
  INTO transactions_sum
  FROM cash_register_transactions crt
  WHERE crt.cash_register_id = register_id;
  
  -- Calcular saldo
  balance := initial_amount + transactions_sum;
  
  RETURN balance;
END;
$$;

-- Índices
CREATE INDEX idx_cash_registers_status ON cash_registers(status);
CREATE INDEX idx_cash_registers_opening_employee_id ON cash_registers(opening_employee_id);
CREATE INDEX idx_cash_register_transactions_cash_register_id ON cash_register_transactions(cash_register_id);
CREATE INDEX idx_cash_register_transactions_operation_type ON cash_register_transactions(operation_type);
CREATE INDEX idx_cash_register_transactions_created_at ON cash_register_transactions(created_at);