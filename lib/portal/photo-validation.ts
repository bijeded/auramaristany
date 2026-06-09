// Validación y dimensionado de fotos. Puro (sin DOM/DB) → testeable.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTOS = 30;
export const MAX_PHOTO_DIMENSION = 1280;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface PhotoUploadCheck {
  size: number;
  type: string;
  existingCount: number;
}

export type PhotoValidation = { ok: true } | { ok: false; error: string };

export function validatePhotoUpload({
  size,
  type,
  existingCount,
}: PhotoUploadCheck): PhotoValidation {
  if (!ALLOWED_PHOTO_TYPES.includes(type)) {
    return { ok: false, error: "Formato no permitido. Usa JPG, PNG o WEBP." };
  }
  if (size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "La imagen supera el límite de 5 MB." };
  }
  if (existingCount >= MAX_PHOTOS) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${MAX_PHOTOS} fotos. Borra alguna para subir más.`,
    };
  }
  return { ok: true };
}

export function computeResizedDimensions(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = width >= height ? max / width : max / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
