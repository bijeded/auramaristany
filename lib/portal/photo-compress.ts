"use client";
import { computeResizedDimensions, MAX_PHOTO_DIMENSION } from "./photo-validation";

/**
 * Reduce la imagen a `maxDimension` (lado mayor) y recomprime a JPEG.
 * Por defecto usa MAX_PHOTO_DIMENSION; el avatar pasa un máximo menor (p. ej. 800).
 * Devuelve un File listo para subir. Si algo falla, devuelve el original.
 */
export async function compressImage(
  file: File,
  maxDimension: number = MAX_PHOTO_DIMENSION
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = computeResizedDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
