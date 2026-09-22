/**
 * Contraste WCAG 2.x entre dos colores, para que la regla de 4.5:1 se pueda
 * probar contra los tokens reales de `app/globals.css` y no contra una copia.
 *
 * Sólo lee lo que ese archivo usa: hex (#rgb, #rrggbb) y `rgba(r, g, b, a)`.
 * Cualquier otra cosa se rechaza con su nombre, porque una prueba que no supo
 * leer un color no debe aprobarlo en silencio.
 */

type RGB = [number, number, number];

function parseHex(color: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

function toHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Un color de fondo tal como se ve sobre el blanco en que se apoyan las
 * insignias: un `rgba` teñido se mezcla con el blanco; un hex queda igual.
 */
export function compositeOverWhite(color: string): string {
  const hex = parseHex(color);
  if (hex) return toHex(hex);
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(color.trim());
  if (!m) throw new Error(`Color que no se sabe leer: ${color}`);
  const alpha = Number(m[4]);
  const rgb = [m[1], m[2], m[3]].map((c) => 255 + (Number(c) - 255) * alpha) as RGB;
  return toHex(rgb);
}

function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) throw new Error(`Color que no se sabe leer: ${color}`);
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores opacos en hex; el orden no importa. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
