// TTL de las URLs firmadas de fotos de progreso. Bajado de 3600 → 600 (STG-2):
// las URLs quedan en el payload RSC/HTML; 10 min reduce la ventana de intercepción.
export const SIGNED_URL_TTL_SECONDS = 600;
