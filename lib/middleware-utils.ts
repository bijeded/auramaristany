import type { UserRole } from "./supabase/types";

interface RedirectParams {
  pathname: string;
  hasSession: boolean;
  role: UserRole | null;
  onboardingCompleted: boolean;
  hasActiveSubscription: boolean;
  /** L2c — terminó su programa: conserva el portal, no el contenido. */
  hasGraduatedSubscription?: boolean;
}

/**
 * Lo que alcanza una clienta graduada. Es una lista de PERMITIDOS, no de
 * prohibidos: así una ruta de contenido futura nace cerrada para ella en vez de
 * quedar abierta hasta que alguien se acuerde de añadirla a una lista negra.
 *
 * `/portal/settings` es además su aterrizaje: ahí están su cuenta, su historial
 * de pagos y el CTA para seguir con Extra.
 */
export const GRADUATED_HOME = "/portal/settings";

const GRADUATED_ALLOWED_ROUTES: readonly string[] = [
  GRADUATED_HOME,
  "/portal/history",
  "/portal/messages",
  "/portal/sin-suscripcion",
  "/portal/activando",
];

/**
 * ¿Alcanza una cliente graduada esta ruta?
 *
 * Rechaza de entrada cualquier ruta con segmentos `.` / `..` o con escapes
 * `%`: hoy Next no resuelve los segmentos de punto —así que
 * `/portal/settings/../today` es un 404, no un salto—, pero la lista de
 * permitidos no debe depender de eso. Si mañana algo normalizara la ruta antes
 * que nosotros, un prefijo permitido se convertiría en la llave de todo.
 *
 * También la usa la barra de navegación, para que lo que se pinta y lo que se
 * deja pasar salgan de la misma lista.
 */
export function graduatedMayReachRoute(pathname: string): boolean {
  if (pathname.includes("%")) return false;
  const segments = pathname.split("/");
  if (segments.some((s) => s === "." || s === "..")) return false;

  return GRADUATED_ALLOWED_ROUTES.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`)
  );
}

export function getRedirectPath(params: RedirectParams): string | null {
  const { pathname, hasSession, role, onboardingCompleted, hasActiveSubscription } = params;
  // Sólo cuenta cuando no hay ninguna que pague: si compró Extra después de
  // terminar CuarentaMás, es clienta de pleno derecho otra vez.
  const isGraduated = !hasActiveSubscription && params.hasGraduatedSubscription === true;

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

  if (hasSession && !role && isProtectedRoute) {
    return "/auth/login";
  }

  // Ya autenticado: no permitir re-login desde /auth/login|register; mandar a su home.
  // /auth/callback (confirmación de correo) y /auth/reset-password quedan fuera a propósito.
  // El hogar de la clienta: quien se graduó aterriza en su cuenta, no en Hoy —
  // mandarla a Hoy sólo para rebotarla es un parpadeo que no hace falta.
  const clientHome = isGraduated ? GRADUATED_HOME : "/portal/today";

  if (hasSession && role && (pathname === "/auth/login" || pathname === "/auth/register")) {
    return role === "admin" ? "/admin/dashboard" : clientHome;
  }

  if (role === "admin" && pathname.startsWith("/portal")) {
    return "/admin/dashboard";
  }

  if (role === "client" && pathname.startsWith("/admin")) {
    return clientHome;
  }

  if (role === "client" && (pathname.startsWith("/portal") || pathname.startsWith("/onboarding"))) {
    if (pathname === "/portal/sin-suscripcion" || pathname === "/portal/activando") {
      return null; // Allow access — no-subscription page and payment processing page
    }
    if (isGraduated) {
      // Conserva lo que ganó; pierde lo que estaba pagando. El onboarding
      // tampoco aplica: ya lo hizo, y el cuestionario sólo sirve para empezar.
      return graduatedMayReachRoute(pathname) ? null : GRADUATED_HOME;
    }
    if (!hasActiveSubscription) {
      return "/portal/sin-suscripcion";
    }
    if (hasActiveSubscription && !onboardingCompleted && pathname.startsWith("/portal")) {
      return "/onboarding/questionnaire";
    }
  }

  return null;
}
