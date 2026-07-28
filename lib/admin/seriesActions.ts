"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

type SupabaseLike = Awaited<ReturnType<typeof requireAdmin>> & { ok: true } extends {
  supabase: infer S;
}
  ? S
  : never;

/**
 * `field: "ordinal"` = el error pertenece al campo Mes #, para pintarlo inline.
 * Es un discriminador explícito a propósito: el modal antes lo deducía buscando
 * un trozo de texto dentro del mensaje, y cualquier cambio de copy lo rompía en
 * silencio.
 */
export interface SeriesActionResult {
  error?: string;
  field?: "ordinal";
}

/**
 * Una posición concreta: qué variante muestra la serie y en qué mes.
 *
 * Es por FILA, no por serie. Una misma serie puede ser el Mes 1 de una variante
 * y el Mes 4 de otra, así que un único `ordinal` para toda la serie reescribiría
 * la posición de las demás variantes sin que el admin lo pida.
 */
export interface SeriesMappingInput {
  variantId: string;
  ordinal: number;
}

export interface CreateSeriesInput {
  title: string;
  description?: string | null;
  mappings: SeriesMappingInput[];
}

export interface UpdateSeriesInput {
  title: string;
  description?: string | null;
  published: boolean;
  mappings: SeriesMappingInput[];
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 1000;

/**
 * Un id con la FORMA de uuid, no un uuid RFC 4122.
 *
 * `z.string().uuid()` exige los bits de versión y variante (el 3er grupo debe
 * empezar por 1–8, el 4º por 8/9/a/b). Los ids del catálogo están sembrados a
 * mano — `00000000-0000-0000-0002-000000000010` — así que NO los cumplen, y
 * `.uuid()` rechazaba cada variante y cada programa reales. Postgres acepta
 * cualquier uuid de 32 hex, y lo que hay que impedir aquí es que llegue basura
 * a la consulta, no imponer una versión concreta.
 */
const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

// `months_elapsed` arranca en 1, así que un Mes 0 sería contenido que ninguna
// cliente puede alcanzar nunca. La columna en la BD es `int` a secas.
const mappingSchema = z.object({
  variantId: uuidLike,
  ordinal: z.number().int().min(1).max(240),
});

const baseSchema = {
  title: z.string().trim().min(1).max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  // Tope alto pero finito: el programa más grande tiene 3 variantes, así que
  // 50 no estorba a Aura y evita construir una query enorme desde un post
  // inflado. Sin tope, un `.in()` gigante se trunca por paginación y el
  // chequeo de pertenencia falla cerrado — correcto, pero después del trabajo.
  mappings: z.array(mappingSchema).min(1).max(50),
};

const idSchema = z.object({
  seriesId: uuidLike,
  programId: uuidLike,
});

const createSchema = z.object(baseSchema);
const updateSchema = z.object({ ...baseSchema, published: z.boolean() });

/**
 * 23505 sobre `variant_series_map` = esa variante ya tiene una serie en esa
 * posición. Ya NO puede venir de `program_series`: el mes es único por
 * variante, no por programa, que es justo lo que este cambio arregla.
 */
/**
 * Nombra la variante y el mes que chocaron. Se consulta DESPUÉS del 23505, no
 * antes: el índice único sigue siendo lo que garantiza la integridad; esto sólo
 * convierte "alguna de las variantes elegidas" en algo que Aura puede corregir.
 * Si la consulta falla se cae al mensaje genérico.
 */
async function positionTakenMessage(
  supabase: SupabaseLike,
  mappings: SeriesMappingInput[],
  excludeSeriesId?: string
): Promise<string> {
  const months = Array.from(new Set(mappings.map((m) => m.ordinal))).sort((a, b) => a - b);
  const generic =
    months.length === 1
      ? `Ya existe un Mes ${months[0]} en alguna de las variantes elegidas.`
      : `Alguna de las variantes elegidas ya tiene ocupado uno de esos meses.`;

  // Acotado a los meses en juego: sin el `.in(ordinal)` esto lee el currículo
  // entero de cada variante, y pasada la página por defecto de PostgREST (1000
  // filas) la fila que chocó puede quedar fuera — el mensaje concreto
  // degradaría al genérico justo cuando el currículo es grande.
  const { data } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, series_id, ordinal, program_variants(name)")
    .in("program_variant_id", mappings.map((m) => m.variantId))
    .in("ordinal", months);

  // keep: variant_series_map JOIN program_variants — forma del join no inferida.
  const rows = (data ?? []) as unknown as {
    program_variant_id: string;
    series_id: string;
    ordinal: number;
    program_variants: { name: string } | null;
  }[];

  for (const m of mappings) {
    const clash = rows.find(
      (r) =>
        r.program_variant_id === m.variantId &&
        r.ordinal === m.ordinal &&
        r.series_id !== excludeSeriesId
    );
    if (clash?.program_variants?.name) {
      return `${clash.program_variants.name} ya tiene un Mes ${m.ordinal}.`;
    }
  }
  return generic;
}

/**
 * Mensaje concreto por campo: "revisa los datos" no dice qué corregir.
 * Devuelve también `field` para que el modal pinte el error del mes inline,
 * igual que hace con el 23505 — si no, el mismo problema aparece en dos sitios
 * distintos de la interfaz según de dónde venga.
 */
function validationFailure(error: z.ZodError): SeriesActionResult {
  const path = error.issues[0]?.path.join(".") ?? "";
  if (path === "mappings") {
    return { error: "Elige al menos una variante para esta serie." };
  }
  if (path.startsWith("mappings") && path.endsWith("ordinal")) {
    return {
      error: "El mes debe ser un número entero mayor o igual a 1.",
      field: "ordinal",
    };
  }
  if (path.startsWith("mappings")) return { error: "Variante no válida." };
  if (path === "title") return { error: "El título es requerido (máximo 120 caracteres)." };
  if (path === "description") {
    return { error: "La descripción es demasiado larga (máximo 1000 caracteres)." };
  }
  return { error: "Revisa los datos de la serie." };
}

/**
 * Comprueba que TODAS las variantes elegidas pertenecen a `programId`.
 *
 * No es una frontera de privilegio — `is_admin()` puede escribir en cualquier
 * programa —, es integridad: el índice único es por variante, así que nada en
 * la BD impide mapear una serie del programa A a una variante del programa B.
 * Si eso ocurre, las clientes de B reciben contenido de A por la vía normal de
 * lectura. Un post de formulario viejo o manipulado basta para provocarlo.
 */
async function variantsBelongToProgram(
  supabase: SupabaseLike,
  programId: string,
  mappings: SeriesMappingInput[]
): Promise<boolean> {
  const variantIds = Array.from(new Set(mappings.map((m) => m.variantId)));
  const { data, error } = await supabase
    .from("program_variants")
    .select("id")
    .eq("program_id", programId)
    .in("id", variantIds);

  if (error) return false;
  return ((data ?? []) as { id: string }[]).length === variantIds.length;
}

function toRows(seriesId: string, mappings: SeriesMappingInput[]) {
  return mappings.map((m) => ({
    program_variant_id: m.variantId,
    series_id: seriesId,
    ordinal: m.ordinal,
  }));
}

export async function createSeries(
  programId: string,
  data: CreateSeriesInput
): Promise<SeriesActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  // Sin variante la serie no tiene posición: no es que quede inalcanzable, es
  // que no se puede representar en ningún currículo.
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  const input = parsed.data;
  const supabase = auth.supabase;

  if (!uuidLike.safeParse(programId).success) {
    return { error: "Programa no válido." };
  }
  if (!(await variantsBelongToProgram(supabase, programId, input.mappings))) {
    return { error: "Variante no válida." };
  }

  const { data: newSeries, error: seriesError } = await supabase
    .from("program_series")
    .insert({
      program_id: programId,
      title: input.title,
      description: input.description ?? null,
      published: false,
    })
    .select("id")
    .single();

  if (seriesError) {
    return { error: logAndGeneric("createSeries.insert", seriesError) };
  }

  const seriesId = (newSeries as { id: string }).id;
  const { error: mapError } = await supabase
    .from("variant_series_map")
    .insert(toRows(seriesId, input.mappings));

  if (mapError) {
    // La serie ya se insertó; sin mapeo queda huérfana e invisible. Se borra
    // para no dejar basura que el admin no puede ver ni eliminar.
    const { error: rollbackError } = await supabase
      .from("program_series")
      .delete()
      .eq("id", seriesId);
    if (rollbackError) logAndGeneric("createSeries.rollback", rollbackError);

    if ((mapError as { code?: string }).code === "23505") {
      return {
        error: await positionTakenMessage(supabase, input.mappings),
        field: "ordinal",
      };
    }
    return { error: logAndGeneric("createSeries.map", mapError) };
  }

  revalidatePath(`/admin/content/${programId}`);
  return {};
}

export async function updateSeries(
  seriesId: string,
  programId: string,
  data: UpdateSeriesInput
): Promise<SeriesActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  const input = parsed.data;
  const supabase = auth.supabase;

  if (!idSchema.safeParse({ seriesId, programId }).success) {
    return { error: "Serie no válida." };
  }
  // Acotado al programa antes de tocar nada: esta acción BORRA los mapeos
  // actuales, así que un `seriesId` de otro programa no puede llegar al delete.
  const { data: owned } = await supabase
    .from("program_series")
    .select("id")
    .eq("id", seriesId)
    .eq("program_id", programId)
    .maybeSingle();
  if (!owned) return { error: "Serie no válida." };

  if (!(await variantsBelongToProgram(supabase, programId, input.mappings))) {
    return { error: "Variante no válida." };
  }

  // Reconciliación borrar-e-insertar: NO es atómica. Se leen los mapeos actuales
  // antes de borrar para poder restaurarlos si la inserción falla — sin eso, un
  // 23505 (posición ocupada, un error que el admin provoca a diario) dejaría la
  // serie mapeada a CERO variantes: invisible en todos los currículos e
  // irrecuperable desde el editor. Misma familia que D2 (saveBlocks).
  const { data: rawPrevious, error: readError } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, series_id, ordinal")
    .eq("series_id", seriesId);

  if (readError) return { error: logAndGeneric("updateSeries.readMap", readError) };
  const previous = (rawPrevious ?? []) as {
    program_variant_id: string;
    series_id: string;
    ordinal: number;
  }[];

  const { error: deleteMapError } = await supabase
    .from("variant_series_map")
    .delete()
    .eq("series_id", seriesId);

  if (deleteMapError) return { error: logAndGeneric("updateSeries.deleteMap", deleteMapError) };

  const { error: insertMapError } = await supabase
    .from("variant_series_map")
    .insert(toRows(seriesId, input.mappings));

  if (insertMapError) {
    if (previous.length > 0) {
      const { error: restoreError } = await supabase
        .from("variant_series_map")
        .insert(previous);
      if (restoreError) logAndGeneric("updateSeries.restoreMap", restoreError);
    }
    if ((insertMapError as { code?: string }).code === "23505") {
      return {
        error: await positionTakenMessage(supabase, input.mappings, seriesId),
        field: "ordinal",
      };
    }
    return { error: logAndGeneric("updateSeries.insertMap", insertMapError) };
  }

  // Los metadatos se escriben DESPUÉS de que el mapeo cuadre: si se hicieran
  // antes, un 23505 devolvería "esta variante ya tiene un Mes N" — que implica
  // que no se guardó nada — con el título y `published` ya persistidos, y
  // `published` puede haber puesto contenido en vivo.
  const { error: updateError } = await supabase
    .from("program_series")
    .update({
      title: input.title,
      description: input.description ?? null,
      published: input.published,
    })
    .eq("id", seriesId);

  if (updateError) return { error: logAndGeneric("updateSeries.update", updateError) };

  revalidatePath(`/admin/content/${programId}`);
  return {};
}

/**
 * Borra la serie en orden seguro por FKs.
 *
 * Ni `program_days.series_id` ni `progress_logs.program_day_id` tienen cascade
 * (001:99 y 001:175), así que borrar `program_series` a secas falla con 23503
 * en cuanto la serie tiene días — es decir, siempre. Sólo caen solos
 * `program_day_blocks` (desde los días) y `program_series_pillars` →
 * `program_pillar_blocks` (desde la serie).
 *
 * ⚠ Se borran también los `progress_logs` de esos días: son entrenamientos
 * registrados por clientes. Dejarlos con `program_day_id` en null no es mejor
 * — `/portal/history` une con `program_days!inner`, así que desaparecerían de
 * la vista de la propia cliente mientras el admin seguiría viéndolos. El
 * diálogo de confirmación lo advierte.
 */
export async function deleteSeries(
  seriesId: string,
  programId: string
): Promise<SeriesActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  // Los ids vienen del cliente. No es una frontera de privilegio (el admin
  // puede borrar cualquier serie), pero es la única acción que no validaba lo
  // que las otras dos sí — y la que borra datos de las clientes.
  if (!idSchema.safeParse({ seriesId, programId }).success) {
    return { error: "Serie no válida." };
  }
  const supabase = auth.supabase;

  // Acotado al programa: una serie de otro programa no se borra desde aquí.
  const { data: owned } = await supabase
    .from("program_series")
    .select("id")
    .eq("id", seriesId)
    .eq("program_id", programId)
    .maybeSingle();
  if (!owned) return { error: "Serie no válida." };

  const { data: rawDays, error: daysReadError } = await supabase
    .from("program_days")
    .select("id")
    .eq("series_id", seriesId);

  if (daysReadError) return { error: logAndGeneric("deleteSeries.readDays", daysReadError) };

  const dayIds = ((rawDays ?? []) as { id: string }[]).map((d) => d.id);

  if (dayIds.length > 0) {
    const { error: logsError } = await supabase
      .from("progress_logs")
      .delete()
      .in("program_day_id", dayIds);
    if (logsError) return { error: logAndGeneric("deleteSeries.deleteLogs", logsError) };

    const { error: daysError } = await supabase
      .from("program_days")
      .delete()
      .eq("series_id", seriesId);
    if (daysError) return { error: logAndGeneric("deleteSeries.deleteDays", daysError) };
  }

  const { error: mapError } = await supabase
    .from("variant_series_map")
    .delete()
    .eq("series_id", seriesId);

  if (mapError) return { error: logAndGeneric("deleteSeries.deleteMap", mapError) };

  const { error } = await supabase
    .from("program_series")
    .delete()
    .eq("id", seriesId);

  if (error) return { error: logAndGeneric("deleteSeries.delete", error) };

  revalidatePath(`/admin/content/${programId}`);
  return {};
}
