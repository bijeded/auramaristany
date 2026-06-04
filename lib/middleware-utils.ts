import type { UserRole } from "./supabase/types";

interface RedirectParams {
  pathname: string;
  hasSession: boolean;
  role: UserRole | null;
  onboardingCompleted: boolean;
  hasActiveSubscription: boolean;
}

export function getRedirectPath(params: RedirectParams): string | null {
  const { pathname, hasSession, role, onboardingCompleted, hasActiveSubscription } = params;

  const isProtectedRoute =
    pathname.startsWith("/portal") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/onboarding");

  if (!hasSession && isProtectedRoute) {
    return "/auth/login";
  }

  if (!hasSession) {
    return null;
  }

  if (role === "admin" && pathname.startsWith("/portal")) {
    return "/admin/dashboard";
  }

  if (role === "client" && pathname.startsWith("/admin")) {
    return "/portal/today";
  }

  if (role === "client" && (pathname.startsWith("/portal") || pathname.startsWith("/onboarding"))) {
    if (!hasActiveSubscription) {
      return "/portal/sin-suscripcion";
    }
    if (hasActiveSubscription && !onboardingCompleted && pathname.startsWith("/portal")) {
      return "/onboarding/questionnaire";
    }
  }

  return null;
}
