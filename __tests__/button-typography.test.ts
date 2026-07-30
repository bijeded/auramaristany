import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buttonVariants } from "@/components/ui/button";

/**
 * Qué prueba esto y qué NO prueba.
 *
 * Sólo fija que la declaración de tipografía siga estando en la base de
 * `buttonVariants`. Es un candado contra un borrado accidental: antes de este
 * cambio la base no decía nada de familia tipográfica, así que cada botón
 * heredaba Hind de `body` y sólo se veía bien si el llamado escribía
 * `font-head` a mano — de ~103 botones, unos 7 se acordaron.
 *
 * NO prueba que los botones se rendericen en Oswald. jsdom no arma cajas de
 * línea ni resuelve fuentes, y `tsc`, lint y el build tampoco maquetan texto:
 * los cuatro pasan igual con la fuente correcta o incorrecta. Esa parte se
 * verifica a ojo a ~375px (ver la smoke card del cambio), no aquí.
 */
describe("tipografía base del botón", () => {
  it("la base declara la fuente de titulares", () => {
    expect(buttonVariants()).toContain("font-head");
  });

  it("la base declara el peso, para que ningún llamado tenga que repetirlo", () => {
    expect(buttonVariants()).toContain("font-medium");
  });

  it("se conserva al pasar className extra", () => {
    // cn() hace merge de Tailwind: una clase ajena no debe tirar la familia.
    expect(buttonVariants({ className: "w-full" })).toContain("font-head");
  });

  it("todas las variantes la heredan de la base", () => {
    for (const variant of ["default", "destructive", "outline", "secondary", "ghost", "link"] as const) {
      expect(buttonVariants({ variant })).toContain("font-head");
    }
  });
});

/**
 * `buttonVariants` sólo cubre los ~10 <Button> de shadcn. La otra mitad de la
 * decisión — la regla `button` de globals.css — cubre los ~93 <button> planos,
 * que son la mayoría del problema, y no la veía ninguna prueba: un borrado
 * accidental pasaba tsc, lint, el build y toda la suite en verde.
 *
 * Esto es una aserción sobre el TEXTO del archivo, no sobre el render. Mismo
 * patrón que middleware-matcher.test.ts, y por la misma razón: la única
 * alternativa sería maquetar, y jsdom no maqueta.
 */
describe("regla base de globals.css", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("declara la fuente de titulares para todo <button>", () => {
    expect(css).toMatch(/button\s*\{[^}]*font-family:\s*var\(--font-head\)/);
  });

  it("usa el token, no la pila literal", () => {
    const rule = css.match(/\nbutton\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).not.toMatch(/Oswald/);
  });
});
