import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  PORTAL_SHELL_STATES,
  derivePortalTier,
} from "@/lib/content/subscription-access";
import { getRedirectPath } from "@/lib/middleware-utils";
import type { UserRole } from "@/lib/supabase/types";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let onboardingCompleted = false;
  let hasActiveSubscription = false;
  let hasGraduatedSubscription = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile) {
      role = profile.role as UserRole;
      onboardingCompleted = profile.onboarding_completed;
    }

    if (role === "client") {
      // Se leen TODAS las filas que dan portal, no una sola: quien termina
      // CuarentaMás y compra Extra tiene dos a la vez, y un `.maybeSingle()`
      // sobre dos filas devuelve error —no filas—, que la dejaría fuera del
      // portal entero justo después de pagar.
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("profile_id", user.id)
        .in("status", PORTAL_SHELL_STATES as readonly string[]);

      const tier = derivePortalTier(
        ((subs ?? []) as { status: string }[]).map((s) => s.status)
      );
      hasActiveSubscription = tier === "paying";
      hasGraduatedSubscription = tier === "graduated";
    }
  }

  const redirectPath = getRedirectPath({
    pathname: request.nextUrl.pathname,
    hasSession: !!user,
    role,
    onboardingCompleted,
    hasActiveSubscription,
    hasGraduatedSubscription,
  });

  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    const redirectResponse = NextResponse.redirect(url);
    // Propagate any refreshed session cookies from Supabase
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as "lax" | "strict" | "none" | undefined,
        maxAge: cookie.maxAge,
        path: cookie.path,
      });
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

// Excluye api/webhooks y api/cron (MW-3): son endpoints máquina-a-máquina
// (Stripe / Vercel Cron) que no deben pagar getUser()+query a profiles ni
// arriesgar un redirect. NOTA: Next.js exige que `config.matcher` sea un
// literal inline analizable estáticamente — no puede referenciar una constante,
// o el matcher se ignora. El test lee `config.matcher[0]` como fuente única.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
