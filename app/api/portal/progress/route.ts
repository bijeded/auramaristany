import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertProgressLog } from "@/lib/content/queries";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { dayId, subscriptionId, exercisesDone, generalNotes, completed } =
    body as {
      dayId: string;
      subscriptionId: string;
      exercisesDone: Record<string, unknown>;
      generalNotes: string;
      completed: boolean;
    };

  if (!dayId || !subscriptionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const result = await upsertProgressLog({
    userId: user.id,
    subscriptionId,
    programDayId: dayId,
    exercisesDone,
    generalNotes,
    completed,
  });

  if (!result) {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ id: result.id });
}
