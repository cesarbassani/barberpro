// Função de integração com n8n para agendamentos
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { format, parse, addMinutes, parseISO } from 'npm:date-fns@3.3.1';
import { ptBR } from 'npm:date-fns@3.3.1/locale';

// Constants and types
const FIFTEEN_MINUTES = 15 * 60 * 1000;

interface AppointmentRequest {
  acao: 'buscarAgenda' | 'criarAgendamento';
  data: string; // formato YYYY-MM-DD
  barbeiroId?: string;
  // Campos adicionais para criarAgendamento
  cliente?: {
    nome: string;
    telefone?: string;
    email?: string;
  };
  servicoId?: string;
  hora?: string; // formato HH:MM
}

// Headers CORS para permitir requisições externas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// Configurações do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Cliente do Supabase com service role para bypassar RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Cliente do Supabase com anon key para RLS
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função para registrar logs
async function registrarLog(
  acao: string,
  barbeiroId: string | undefined,
  cliente: any,
  status: 'success' | 'error',
  mensagem: string
) {
  try {
    await supabaseAdmin
      .from('n8n_logs')
      .insert({
        acao,
        barbeiro_id: barbeiroId,
        cliente: cliente ? JSON.stringify(cliente) : null,
        status,
        mensagem
      });
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
}

// Função para validar token da API
async function validarToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  
  try {
    // Buscar configurações do n8n
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'n8n_integration')
      .single();
    
    if (error) throw error;
    
    // Verificar se a integração está ativa e se o token é válido
    if (!settings?.value?.enabled) return false;
    if (settings?.value?.apiToken !== token) return false;
    
    return true;
  } catch (error) {
    console.error('Erro na validação do token:', error);
    return false;
  }
}

// Função para buscar agenda
async function buscarAgenda(data: string, barbeiroId?: string) {
  try {
    // Converter data para o formato correto
    const dataFormatada = format(parseISO(data), 'yyyy-MM-dd');
    const dataInicio = `${dataFormatada}T00:00:00`;
    const dataFim = `${dataFormatada}T23:59:59`;
    
    // Se o barbeiroId foi fornecido, buscar apenas a agenda deste barbeiro
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        barber_id,
        barber:profiles!barber_id(id, full_name),
        service_id,
        service:services(id, name, duration, price)
      `)
      .gte('start_time', dataInicio)
      .lte('start_time', dataFim)
      .neq('status', 'cancelled');
    
    if (barbeiroId) {
      query = query.eq('barber_id', barbeiroId);
    }
    
    const { data: appointments, error } = await query;
    
    if (error) throw error;
    
    // Buscar barbeiros ativos se não foi especificado um barbeiro
    let barbeiros = [];
    if (!barbeiroId) {
      const { data: barbers, error: barbersError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'barber');
      
      if (barbersError) throw barbersError;
      barbeiros = barbers || [];
    } else {
      // Se foi especificado um barbeiro, buscar apenas os dados dele
      const { data: barber, error: barberError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('id', barbeiroId)
        .single();
      
      if (barberError && barberError.code !== 'PGRST116') throw barberError;
      if (barber) barbeiros = [barber];
    }
    
    // Horários de funcionamento (8h às 20h)
    const inicioExpediente = 8;
    const fimExpediente = 20;
    const intervaloMinutos = 15; // Blocos de 15 minutos
    
    // Gerar horários disponíveis para cada barbeiro
    const resultado = barbeiros.map(barbeiro => {
      // Filtrar os agendamentos deste barbeiro
      const agendamentosBarbeiro = appointments?.filter(a => a.barber_id === barbeiro.id) || [];
      
      // Gerar todos os horários do dia
      const horarios = [];
      for (let hora = inicioExpediente; hora < fimExpediente; hora++) {
        for (let min = 0; min < 60; min += intervaloMinutos) {
          const horarioStr = `${hora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          
          // Verificar se este horário está disponível
          const horarioData = parseISO(`${data}T${horarioStr}:00`);
          
          // Verifica se algum agendamento ocupa este horário
          const ocupado = agendamentosBarbeiro.some(agendamento => {
            const inicio = new Date(agendamento.start_time);
            const fim = new Date(agendamento.end_time);
            return horarioData >= inicio && horarioData < fim;
          });
          
          horarios.push({
            hora: horarioStr,
            disponivel: !ocupado,
            timestamp: horarioData.toISOString()
          });
        }
      }
      
      return {
        barbeiro: {
          id: barbeiro.id,
          nome: barbeiro.full_name,
          email: barbeiro.email,
          telefone: barbeiro.phone
        },
        horarios
      };
    });
    
    return resultado;
  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    throw new Error(`Erro ao buscar agenda: ${error.message}`);
  }
}

// Função para criar agendamento
async function criarAgendamento(
  data: string, 
  hora: string,
  barbeiroId: string, 
  servicoId: string,
  cliente: { nome: string; telefone?: string; email?: string }
) {
  try {
    // Validar dados
    if (!data) throw new Error('Data é obrigatória');
    if (!hora) throw new Error('Hora é obrigatória');
    if (!barbeiroId) throw new Error('Barbeiro é obrigatório');
    if (!servicoId) throw new Error('Serviço é obrigatório');
    if (!cliente || !cliente.nome) throw new Error('Nome do cliente é obrigatório');
    
    // Buscar cliente existente ou criar um novo
    let clienteId;
    
    // Procurar cliente pelo telefone
    if (cliente.telefone) {
      const { data: clienteExistente, error: clienteError } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('phone', cliente.telefone)
        .maybeSingle();
      
      if (!clienteError && clienteExistente) {
        clienteId = clienteExistente.id;
      }
    }
    
    // Se não encontrou, procurar pelo email
    if (!clienteId && cliente.email) {
      const { data: clienteExistente, error: clienteError } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('email', cliente.email)
        .maybeSingle();
      
      if (!clienteError && clienteExistente) {
        clienteId = clienteExistente.id;
      }
    }
    
    // Se não encontrou, criar um novo cliente
    if (!clienteId) {
      const { data: novoCliente, error: clienteError } = await supabaseAdmin
        .from('clients')
        .insert({
          full_name: cliente.nome,
          phone: cliente.telefone || null,
          email: cliente.email || null
        })
        .select('id')
        .single();
      
      if (clienteError) throw clienteError;
      if (!novoCliente) throw new Error('Erro ao criar cliente');
      
      clienteId = novoCliente.id;
    }
    
    // Buscar informações do serviço
    const { data: servico, error: servicoError } = await supabaseAdmin
      .from('services')
      .select('duration')
      .eq('id', servicoId)
      .single();
    
    if (servicoError) throw servicoError;
    if (!servico) throw new Error('Serviço não encontrado');
    
    // Converter duration (string "HH:MM") em minutos
    const [horas, minutos] = servico.duration.split(':').map(Number);
    const duracaoMinutos = (horas * 60) + minutos;
    
    // Calcular horários
    const dataHoraInicio = parseISO(`${data}T${hora}`);
    const dataHoraFim = addMinutes(dataHoraInicio, duracaoMinutos);
    
    // Verificar disponibilidade
    const dataInicioStr = dataHoraInicio.toISOString();
    const dataFimStr = dataHoraFim.toISOString();
    
    const { data: conflitos, error: conflitoError } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('barber_id', barbeiroId)
      .neq('status', 'cancelled')
      .or(`start_time.lt.${dataFimStr},end_time.gt.${dataInicioStr}`);
    
    if (conflitoError) throw conflitoError;
    
    // Se houver conflitos, abortar
    if (conflitos && conflitos.length > 0) {
      throw new Error('Horário indisponível para este barbeiro');
    }
    
    // Criar agendamento
    const { data: novoAgendamento, error: agendamentoError } = await supabaseAdmin
      .from('appointments')
      .insert({
        client_id: clienteId,
        barber_id: barbeiroId,
        service_id: servicoId,
        start_time: dataInicioStr,
        end_time: dataFimStr,
        status: 'scheduled'
      })
      .select('id, start_time, end_time, status')
      .single();
    
    if (agendamentoError) throw agendamentoError;
    if (!novoAgendamento) throw new Error('Erro ao criar agendamento');
    
    // Retornar dados do agendamento
    return {
      id: novoAgendamento.id,
      dataHora: {
        inicio: novoAgendamento.start_time,
        fim: novoAgendamento.end_time
      },
      status: novoAgendamento.status
    };
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    throw new Error(`Erro ao criar agendamento: ${error.message}`);
  }
}

// Handler principal da função
Deno.serve(async (req: Request) => {
  // Atender requisição OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Extrair token de autorização
  const authHeader = req.headers.get('authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  try {
    // Verificar método da requisição
    if (req.method !== 'POST') {
      throw new Error('Método não permitido. Utilize POST.');
    }
    
    // Validar token
    const tokenValido = await validarToken(token);
    if (!tokenValido) {
      await registrarLog('autenticacao', undefined, null, 'error', 'Token inválido ou expirado');
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou expirado' }),
        { status: 401, headers: corsHeaders }
      );
    }
    
    // Processar corpo da requisição
    let body: AppointmentRequest;
    try {
      body = await req.json();
    } catch (error) {
      await registrarLog('parse_json', undefined, null, 'error', 'Erro ao processar JSON da requisição');
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validar ação
    if (!body.acao || !['buscarAgenda', 'criarAgendamento'].includes(body.acao)) {
      await registrarLog('validacao', undefined, null, 'error', 'Ação inválida ou não especificada');
      return new Response(
        JSON.stringify({ success: false, error: 'Ação inválida ou não especificada' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validar dados com base na ação
    if (body.acao === 'buscarAgenda') {
      if (!body.data) {
        await registrarLog('buscarAgenda', body.barbeiroId, null, 'error', 'Data não especificada');
        return new Response(
          JSON.stringify({ success: false, error: 'Data não especificada' }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      try {
        // Executar busca de agenda
        const agenda = await buscarAgenda(body.data, body.barbeiroId);
        
        // Registrar log de sucesso
        await registrarLog(
          'buscarAgenda', 
          body.barbeiroId, 
          null, 
          'success', 
          `Agenda consultada com sucesso para ${body.data}`
        );
        
        return new Response(
          JSON.stringify({ success: true, data: agenda }),
          { headers: corsHeaders }
        );
      } catch (error) {
        // Registrar log de erro
        await registrarLog(
          'buscarAgenda', 
          body.barbeiroId, 
          null, 
          'error', 
          `Erro: ${error.message}`
        );
        
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }
    } else if (body.acao === 'criarAgendamento') {
      // Validar campos obrigatórios para criação de agendamento
      if (!body.data || !body.hora || !body.barbeiroId || !body.servicoId || !body.cliente?.nome) {
        const camposFaltantes = [];
        if (!body.data) camposFaltantes.push('data');
        if (!body.hora) camposFaltantes.push('hora');
        if (!body.barbeiroId) camposFaltantes.push('barbeiroId');
        if (!body.servicoId) camposFaltantes.push('servicoId');
        if (!body.cliente?.nome) camposFaltantes.push('cliente.nome');
        
        const mensagemErro = `Campos obrigatórios não informados: ${camposFaltantes.join(', ')}`;
        
        await registrarLog(
          'criarAgendamento', 
          body.barbeiroId, 
          body.cliente, 
          'error', 
          mensagemErro
        );
        
        return new Response(
          JSON.stringify({ success: false, error: mensagemErro }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      try {
        // Criar agendamento
        const resultado = await criarAgendamento(
          body.data, 
          body.hora, 
          body.barbeiroId, 
          body.servicoId, 
          body.cliente
        );
        
        // Registrar log de sucesso
        await registrarLog(
          'criarAgendamento', 
          body.barbeiroId, 
          body.cliente, 
          'success', 
          `Agendamento criado com sucesso: ${resultado.id}`
        );
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: resultado 
          }),
          { headers: corsHeaders }
        );
      } catch (error) {
        // Registrar log de erro
        await registrarLog(
          'criarAgendamento', 
          body.barbeiroId, 
          body.cliente, 
          'error', 
          `Erro: ${error.message}`
        );
        
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }
    }
    
    // Caso chegue aqui, ação não foi processada
    return new Response(
      JSON.stringify({ success: false, error: 'Requisição inválida' }),
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    // Registrar log de erro não tratado
    await registrarLog(
      'erro_geral', 
      undefined, 
      null, 
      'error', 
      `Erro interno: ${error.message}`
    );
    
    return new Response(
      JSON.stringify({ success: false, error: `Erro interno do servidor: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
});