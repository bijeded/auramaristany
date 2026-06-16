// Mensaje genérico para acciones admin. Evita filtrar internals de Postgres/RLS
// (tablas, columnas, constraints) al cliente (INP-1). El error real va al log server-side.
export const ADMIN_GENERIC_ERROR = "No se pudo completar la operación. Intenta más tarde.";

export function logAndGeneric(context: string, error: unknown): string {
  console.error(`[${context}]`, error);
  return ADMIN_GENERIC_ERROR;
}
