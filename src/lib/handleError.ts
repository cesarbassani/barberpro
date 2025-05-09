export function handleError(error: unknown) {
  console.error('Error processing request:', error);
  
  // Determine appropriate status code based on error type
  let status = 500;
  if (error instanceof Error) {
    if (error.message.includes('não autorizado') || error.message.includes('unauthorized')) {
      status = 403;
    } else if (error.message.includes('não encontrado') || error.message.includes('not found')) {
      status = 404;
    } else if (error.message.includes('inválido') || error.message.includes('obrigatório')) {
      status = 400;
    }
  }

  return new Response(
    JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}