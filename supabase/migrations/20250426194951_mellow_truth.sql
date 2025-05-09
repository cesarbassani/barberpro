-- Create loyalty plans table
CREATE TABLE loyalty_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  monthly_price decimal(10,2) NOT NULL,
  product_discount_percentage decimal(5,2) NOT NULL,
  service_discount_percentage decimal(5,2) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT loyalty_plans_name_key UNIQUE (name),
  CONSTRAINT product_discount_check CHECK (product_discount_percentage >= 0 AND product_discount_percentage <= 100),
  CONSTRAINT service_discount_check CHECK (service_discount_percentage >= 0 AND service_discount_percentage <= 100)
);

-- Create loyalty plan services table
CREATE TABLE loyalty_plan_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id uuid REFERENCES loyalty_plans(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  uses_per_month integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT loyalty_plan_services_unique UNIQUE (plan_id, service_id)
);

-- Create loyalty subscriptions table
CREATE TABLE loyalty_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES loyalty_plans(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create partial unique index for active subscriptions
CREATE UNIQUE INDEX loyalty_subscriptions_active_client_idx ON loyalty_subscriptions (client_id) WHERE active = true;

-- Create loyalty service usage table
CREATE TABLE loyalty_service_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id uuid REFERENCES loyalty_subscriptions(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE
);

-- Add triggers for updated_at
CREATE TRIGGER update_loyalty_plans_updated_at
    BEFORE UPDATE ON loyalty_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_plan_services_updated_at
    BEFORE UPDATE ON loyalty_plan_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_subscriptions_updated_at
    BEFORE UPDATE ON loyalty_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE loyalty_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_service_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for loyalty_plans
CREATE POLICY "Public read access for loyalty plans"
  ON loyalty_plans FOR SELECT
  USING (true);

CREATE POLICY "Admin manage loyalty plans"
  ON loyalty_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create policies for loyalty_plan_services
CREATE POLICY "Public read access for loyalty plan services"
  ON loyalty_plan_services FOR SELECT
  USING (true);

CREATE POLICY "Admin manage loyalty plan services"
  ON loyalty_plan_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create policies for loyalty_subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON loyalty_subscriptions FOR SELECT
  USING (
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

CREATE POLICY "Admin and barbers can manage subscriptions"
  ON loyalty_subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

-- Create policies for loyalty_service_usage
CREATE POLICY "Users can view own service usage"
  ON loyalty_service_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_subscriptions ls
      WHERE ls.id = loyalty_service_usage.subscription_id
      AND (
        ls.client_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.role = 'admin' OR profiles.role = 'barber')
        )
      )
    )
  );

CREATE POLICY "Admin and barbers can manage service usage"
  ON loyalty_service_usage FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'barber')
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_loyalty_subscriptions_client_id ON loyalty_subscriptions(client_id);
CREATE INDEX idx_loyalty_subscriptions_plan_id ON loyalty_subscriptions(plan_id);
CREATE INDEX idx_loyalty_service_usage_subscription_id ON loyalty_service_usage(subscription_id);
CREATE INDEX idx_loyalty_service_usage_service_id ON loyalty_service_usage(service_id);
CREATE INDEX idx_loyalty_plan_services_plan_id ON loyalty_plan_services(plan_id);
CREATE INDEX idx_loyalty_plan_services_service_id ON loyalty_plan_services(service_id);

-- Create function to check service usage
CREATE OR REPLACE FUNCTION check_service_usage(
  p_subscription_id uuid,
  p_service_id uuid,
  p_date timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_uses_allowed integer;
  v_uses_this_month integer;
BEGIN
  -- Get allowed uses per month
  SELECT uses_per_month INTO v_uses_allowed
  FROM loyalty_plan_services lps
  JOIN loyalty_subscriptions ls ON ls.plan_id = lps.plan_id
  WHERE ls.id = p_subscription_id
  AND lps.service_id = p_service_id;

  -- If service is not included in plan, return false
  IF v_uses_allowed IS NULL THEN
    RETURN false;
  END IF;

  -- Count uses this month
  SELECT COUNT(*) INTO v_uses_this_month
  FROM loyalty_service_usage lsu
  WHERE lsu.subscription_id = p_subscription_id
  AND lsu.service_id = p_service_id
  AND date_trunc('month', lsu.used_at) = date_trunc('month', p_date);

  -- Return true if uses are still available
  RETURN v_uses_this_month < v_uses_allowed;
END;
$$;