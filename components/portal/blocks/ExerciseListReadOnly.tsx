export interface ReadOnlyExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
  notes?: string;
  video_url?: string;
  metrics?: string[];
}

interface ExerciseListReadOnlyContent {
  exercises: ReadOnlyExercise[];
}

export function ExerciseListReadOnly({ content }: { content: ExerciseListReadOnlyContent }) {
  const exercises = content?.exercises ?? [];

  if (exercises.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {exercises.map((ex) => (
        <div
          key={ex.id}
          className="rounded-xl p-4"
          style={{
            background: "#fff",
            border: "1.5px solid var(--gris-linea)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>
            {ex.name}
          </p>

          <p className="font-body mt-1" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
            Meta: {ex.sets}×{ex.reps}
            {ex.rest_seconds != null && (
              <>
                {" · "}
                Descanso: {ex.rest_seconds} seg
              </>
            )}
          </p>

          {ex.notes && (
            <p
              className="font-body mt-2"
              style={{ fontSize: 13, color: "var(--gris-texto)", fontStyle: "italic" }}
            >
              {ex.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
