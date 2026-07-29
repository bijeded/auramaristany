/**
 * L2c — a dónde sigue una cliente que terminó su programa.
 *
 * CuarentaMás acaba en el mes 6 y su continuación es CuarentaMás Extra, que
 * sólo tiene dos peldaños: intermedio y avanzado. El CTA la lleva al que le
 * corresponde por el nivel en el que terminó, para que no tenga que volver al
 * sitio de Aura a buscarlo.
 *
 * Función pura: no consulta la base de datos.
 */

/** El peldaño más bajo que ofrece Extra. */
export const EXTRA_ENTRY_VARIANT_SLUG = "cuarenta-mas-extra-intermedio";

const EXTRA_SLUG_BY_LEVEL: Record<string, string> = {
  intermedio: "cuarenta-mas-extra-intermedio",
  avanzado: "cuarenta-mas-extra-avanzado",
};

/**
 * El checkout de Extra para el nivel en el que terminó.
 *
 * Ante cualquier duda —principiante, nivel desconocido, nada— cae al peldaño de
 * ENTRADA, nunca al avanzado: es un programa de fuerza para mujeres de 40+ y el
 * nivel es una propiedad de seguridad, no una preferencia.
 */
export function extraCheckoutSlugForLevel(level: string | null | undefined): string {
  if (!level) return EXTRA_ENTRY_VARIANT_SLUG;
  return EXTRA_SLUG_BY_LEVEL[level] ?? EXTRA_ENTRY_VARIANT_SLUG;
}
