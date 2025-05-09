/*
  # Adicionar suporte para integração com n8n
  
  1. New Tables
    - `n8n_logs` - Armazena logs de todas as requisições recebidas do n8n
    
  2. Changes
    - Adiciona configuração para token de API e ativação da integração
    - Adiciona suporte para logging de todas as operações
    
  3. Security
    - Mantém políticas RLS para acesso adequado
    - Garante que apenas administradores possam gerenciar tokens
*/

-- Tabela de logs para n8n
CREATE TABLE n8n_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp timestamptz DEFAULT now(),
  acao text NOT NULL,
  barbeiro_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  cliente jsonb,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  mensagem text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE n8n_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Apenas Admins podem visualizar logs de n8n" ON n8n_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Apenas service_role pode inserir logs" ON n8n_logs
FOR INSERT TO service_role
WITH CHECK (true);

-- Índices para otimização
CREATE INDEX idx_n8n_logs_acao ON n8n_logs(acao);
CREATE INDEX idx_n8n_logs_status ON n8n_logs(status);
CREATE INDEX idx_n8n_logs_timestamp ON n8n_logs(timestamp);
CREATE INDEX idx_n8n_logs_barbeiro_id ON n8n_logs(barbeiro_id);

-- Inserir configuração padrão na tabela settings
INSERT INTO settings (key, value)
VALUES (
  'n8n_integration', 
  jsonb_build_object(
    'enabled', false,
    'apiToken', encode(gen_random_bytes(32), 'hex'),
    'webhookUrl', 'Gerada automaticamente quando instalada'
  )
) ON CONFLICT (key) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE n8n_logs IS 'Registros de todas as operações recebidas do n8n';
COMMENT ON COLUMN n8n_logs.acao IS 'Tipo de ação executada: buscarAgenda, criarAgendamento';
COMMENT ON COLUMN n8n_logs.barbeiro_id IS 'ID do barbeiro, se aplicável';
COMMENT ON COLUMN n8n_logs.cliente IS 'Dados do cliente em formato JSON, se aplicável';
COMMENT ON COLUMN n8n_logs.status IS 'Resultado da operação: success ou error';
COMMENT ON COLUMN n8n_logs.mensagem IS 'Descrição detalhada do resultado ou erro';