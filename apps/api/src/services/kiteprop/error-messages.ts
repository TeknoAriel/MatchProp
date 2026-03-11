/**
 * Mensajes claros para el usuario según status HTTP de Kiteprop.
 */
export function kitepropUserMessage(httpStatus: number | undefined, snippet: string): string {
  if (httpStatus === undefined) return snippet || 'Error de conexión';
  if (httpStatus === 401 || httpStatus === 403) return 'Auth incorrecta (API key / header)';
  if (httpStatus === 404) return 'URL o path incorrecto';
  if (httpStatus === 422) return 'Payload inválido (faltan campos)';
  if (httpStatus >= 500) return 'Error servidor Kiteprop (reintentos aplicados)';
  if (httpStatus >= 200 && httpStatus < 300) return 'OK';
  return snippet || `HTTP ${httpStatus}`;
}
