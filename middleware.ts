import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_STATES } from "@/lib/content/subscription-access";
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
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("profile_id", user.id)
        .in("status", ACCESS_STATES as readonly string[])
        .maybeSingle();

      hasActiveSubscription = !!sub;
    }
  }

  const redirectPath = getRedirectPath({
    pathname: request.nextUrl.pathname,
    hasSession: !!user,
    role,
    onboardingCompleted,
    hasActiveSubscription,
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
