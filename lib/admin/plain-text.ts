/**
 * El lado LECTOR de `sanitizePlainText`.
 *
 * `sanitizePlainText` escapa `&`, `<`, `>`, `"` y `'` a entidades al GUARDAR.
 * React escapa otra vez al pintar, así que un valor guardado con ella llega a
 * la pantalla como `&amp;` literal si nadie lo decodifica en medio. Esa es la
 * regla 18, y se repite en cada pantalla nueva que pinte una de esas columnas
 * porque el decode vivía escondido dentro de `sanitizePlainTextBody`, en la
 * ruta de ESCRITURA, donde quien lee el render no lo ve nunca.
 *
 * Vive en su propio módulo, sin dependencias, y no dentro de `sanitize-html.ts`
 * a propósito: ese importa el paquete `sanitize-html`, y este decode lo
 * necesitan componentes marcados `"use client"` —arrastrarlo metería toda la
 * librería en el bundle del navegador para hacer cinco `replace`.
 *
 * `&amp;` va AL FINAL para que `&amp;lt;` termine en `&lt;` y no en `<`.
 *
 * ⚠ INVARIANTE (la misma de `sanitizePlainTextBody`): al decodificar, el valor
 * puede volver a tener forma de HTML — un `<script>` escrito a mano queda como
 * texto literal `<script>`. Lo que salga de aquí NUNCA debe llegar a
 * `dangerouslySetInnerHTML` ni al cuerpo HTML crudo de un email: sólo a sinks
 * que escapan (texto en React, `<Text>` de React Email).
 */
export function decodePlainText(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
