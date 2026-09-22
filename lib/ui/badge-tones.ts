/**
 * D8 — los tonos de TODA insignia (etiqueta corta sobre una pastilla teñida),
 * en admin y en portal.
 *
 * Cada sitio escribía su propio par `{bg, color}` a mano, y cuatro de los cinco
 * pares no llegaban al 4.5:1 de texto normal: el verde de "Activa" daba 2.40:1.
 * Ahora el tono se elige aquí y el valor vive en `app/globals.css`; aquí sólo
 * hay referencias `var()`, nunca un color. `__tests__/badge-contrast.test.ts`
 * resuelve cada par contra esos tokens y falla, con el nombre del tono, si una
 * edición futura baja alguno del mínimo.
 *
 * Los tokens base (--exito, --error, --ambar, --lavanda) no se tocan: también
 * pintan íconos, rellenos y gráficas. El texto usa su variante `-text`.
 */
export type BadgeTone = { bg: string; color: string };

export const BADGE_TONE = {
  success: { bg: "var(--exito-tint)", color: "var(--exito-text)" },
  lavender: { bg: "var(--lavanda-soft)", color: "var(--lavanda-text)" },
  danger: { bg: "var(--error-tint)", color: "var(--error-text)" },
  warning: { bg: "var(--ambar-tint)", color: "var(--ambar-text)" },
  neutral: { bg: "var(--gris-claro)", color: "var(--gris-texto)" },
} as const satisfies Record<string, BadgeTone>;
