// Validación pura de subida de avatar (sin DOM/DB) → testeable.

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface AvatarUploadCheck {
  size: number;
  type: string;
}

export type AvatarValidation = { ok: true } | { ok: false; error: string };

export function validateAvatarUpload({ size, type }: AvatarUploadCheck): AvatarValidation {
  if (!ALLOWED_AVATAR_TYPES.includes(type)) {
    return { ok: false, error: "Formato no permitido. Usa JPG, PNG o WEBP." };
  }
  if (size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "La imagen supera el límite de 5 MB." };
  }
  return { ok: true };
}

export function avatarExtFor(type: string): "png" | "webp" | "jpg" {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}
