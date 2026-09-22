import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { BADGE_TONE } from "@/lib/ui/badge-tones";
import { contrastRatio, compositeOverWhite } from "@/lib/ui/contrast";

// D8 — el mínimo de 4.5:1 se prueba contra los tokens REALES de globals.css, no
// contra una copia de los hex: una copia se separa de los tokens justo en la
// edición que esta prueba existe para atrapar.
function rootTokens(): Record<string, string> {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const root = /:root\s*\{([^}]*)\}/.exec(css);
  if (!root) throw new Error("globals.css no tiene bloque :root");
  const body = root[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens: Record<string, string> = {};
  const decl = /--([\w-]+)\s*:\s*([^;]+);/g;
  for (let m = decl.exec(body); m; m = decl.exec(body)) tokens[m[1]] = m[2].trim();
  return tokens;
}

function resolve(value: string, tokens: Record<string, string>): string {
  const ref = /^var\(--([\w-]+)\)$/.exec(value.trim());
  if (!ref) return value;
  const next = tokens[ref[1]];
  if (next === undefined) throw new Error(`token --${ref[1]} no existe en :root`);
  return resolve(next, tokens);
}

describe("contraste de los tonos de insignia", () => {
  const tokens = rootTokens();

  it.each(Object.entries(BADGE_TONE))("%s llega a 4.5:1", (tone, { bg, color }) => {
    const ratio = contrastRatio(
      compositeOverWhite(resolve(color, tokens)),
      compositeOverWhite(resolve(bg, tokens))
    );
    expect(ratio, `tono ${tone}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
