/*
  # Add Time Blocking Feature
  
  1. New Tables
    - `blocked_times` - Stores periods when barbers are unavailable
    - Block specific time periods in barber schedules
    - Allow both admin and barber-specific blocks
    
  2. Changes
    - Add business hours configuration to settings
    - Integrate with existing appointment system
    
  3. Security
    - RLS policies to ensure proper access control
    - Barbers can only manage their own blocks
    - Admins can manage all blocks
*/

-- Create blocked_times table
CREATE TABLE IF NOT EXISTS blocked_times (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  title text NOT NULL DEFAULT 'Horário Bloqueado',
  description text,
  is_all_day boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT time_order_check CHECK (start_time < end_time)
);

-- Add trigger for updated_at
CREATE TRIGGER update_blocked_times_updated_at
  BEFORE UPDATE ON blocked_times
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

-- Create policies for blocked_times
CREATE POLICY "Barbers can view their blocked times"
  ON blocked_times FOR SELECT
  USING (
    barber_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Barbers can manage their blocked times"
  ON blocked_times FOR INSERT
  TO authenticated
  WITH CHECK (
    barber_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Barbers can update their blocked times"
  ON blocked_times FOR UPDATE
  USING (
    barber_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Barbers can delete their blocked times"
  ON blocked_times FOR DELETE
  USING (
    barber_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_blocked_times_barber_id ON blocked_times(barber_id);
CREATE INDEX idx_blocked_times_start_time ON blocked_times(start_time);
CREATE INDEX idx_blocked_times_end_time ON blocked_times(end_time);

-- Insert default business hours settings if not exists
INSERT INTO settings (key, value)
VALUES (
  'business_hours', 
  jsonb_build_object(
    'weekdays', array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    'openingTime', '08:00',
    'closingTime', '20:00',
    'slotDuration', 30,
    'holidays', jsonb_build_array()
  )
) ON CONFLICT (key) DO NOTHING;

-- Function to check if a time slot is available (not blocked)
CREATE OR REPLACE FUNCTION is_time_available(
  p_barber_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  blocked_count integer;
BEGIN
  -- Check if time is blocked
  SELECT COUNT(*)
  INTO blocked_count
  FROM blocked_times
  WHERE barber_id = p_barber_id
  AND (
    (start_time <= p_end_time AND end_time >= p_start_time) OR
    (is_all_day = true AND DATE(start_time) = DATE(p_start_time))
  );
  
  RETURN blocked_count = 0;
END;
$$;