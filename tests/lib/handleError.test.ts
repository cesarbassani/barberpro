import { expect, test } from 'vitest';
import { handleError } from '../../src/lib/handleError';

test('handleError with Error instance', async () => {
  const response = handleError(new Error('Mensagem de erro'));
  const json = await response.json();

  expect(response.status).toBe(500);
  expect(response.headers.get('Content-Type')).toBe('application/json');
  expect(json).toEqual({
    success: false,
    message: 'Mensagem de erro'
  });
});

test('handleError with undefined', async () => {
  const response = handleError(undefined);
  const json = await response.json();

  expect(response.status).toBe(500);
  expect(response.headers.get('Content-Type')).toBe('application/json');
  expect(json).toEqual({
    success: false,
    message: 'Erro interno do servidor'
  });
});

test('handleError with empty object', async () => {
  const response = handleError({});
  const json = await response.json();

  expect(response.status).toBe(500);
  expect(response.headers.get('Content-Type')).toBe('application/json');
  expect(json).toEqual({
    success: false,
    message: 'Erro interno do servidor'
  });
});

test('handleError with unauthorized error', async () => {
  const response = handleError(new Error('Usuário não autorizado'));
  const json = await response.json();

  expect(response.status).toBe(403);
  expect(json).toEqual({
    success: false,
    message: 'Usuário não autorizado'
  });
});

test('handleError with not found error', async () => {
  const response = handleError(new Error('Recurso não encontrado'));
  const json = await response.json();

  expect(response.status).toBe(404);
  expect(json).toEqual({
    success: false,
    message: 'Recurso não encontrado'
  });
});

test('handleError with invalid input error', async () => {
  const response = handleError(new Error('Dados inválidos'));
  const json = await response.json();

  expect(response.status).toBe(400);
  expect(json).toEqual({
    success: false,
    message: 'Dados inválidos'
  });
});