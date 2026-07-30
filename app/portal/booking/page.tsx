import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTodayContent } from "@/lib/content/queries";
import { getBookingState } from "@/lib/content/booking-queries";
import { dayHasAgendarBlock } from "@/lib/content/booking-helpers";
import { longDateLabel } from "@/lib/admin/date-helpers";
import { BookingEmbed } from "@/components/portal/BookingEmbed";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-head text-xl mb-4" style={{ color: "var(--negro)" }}>
        {title}
      </h1>
      {children}
    </div>
  );
}

function NotAvailable() {
  return (
    <Shell title="Tu llamada">
      <div className="rounded-xl p-5" style={{ background: "var(--lavanda-tint)" }}>
        <div className="flex items-center gap-2 font-head" style={{ color: "var(--lavanda-dark)" }}>
          <CalendarClock size={18} /> Agendar no está disponible ahora
        </div>
        <p className="font-body mt-1" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
          Tu próxima llamada se habilitará desde tu plan del día. Te avisaremos
          cuando puedas reservarla.
        </p>
        <Link
          href="/portal/today"
          className="mt-4 inline-flex items-center rounded-lg font-head font-semibold"
          style={{ minHeight: 48, padding: "0 20px", background: "var(--lavanda)", color: "var(--blanco)" }}
        >
          Volver a Hoy
        </Link>
      </div>
    </Shell>
  );
}

export default async function PortalBookingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Identidad y elegibilidad se derivan en el servidor (nunca del cliente).
  // getTodayContent ya exige una suscripción con estado de acceso: si es null,
  // no hay sub activa o es día de descanso → no elegible.
  const content = await getTodayContent(user.id);
  const booking = await getBookingState(user.id);

  // Ya tiene una llamada futura → no ofrecer el embed.
  if (booking.hasFutureCall) {
    return (
      <Shell title="Tu llamada">
        <div className="rounded-xl p-5" style={{ background: "var(--lavanda-tint)" }}>
          <div className="flex items-center gap-2 font-head" style={{ color: "var(--lavanda-dark)" }}>
            <CheckCircle2 size={18} />
            {booking.nextCallDate
              ? `Tu llamada es el ${longDateLabel(booking.nextCallDate)}`
              : "Ya tienes una llamada agendada"}
          </div>
          <p className="font-body mt-1" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
            Si necesitas moverla, hazlo desde el correo de confirmación.
          </p>
        </div>
      </Shell>
    );
  }

  // La ventana de reserva sólo está abierta si el día de hoy expone un bloque
  // "agendar" (cadencia dirigida por contenido). Teclear la URL en otro día
  // no elegible cae aquí.
  const eligible = !!content && dayHasAgendarBlock(content.blocks);
  if (!eligible) return <NotAvailable />;

  // El día ES elegible pero falta la config de Calendly → no es un "vuelve
  // luego", es un error de configuración: el CTA de Hoy lleva a un callejón
  // sin salida. Se registra en el servidor (el cliente ve el mismo mensaje
  // amable). Recordar: NEXT_PUBLIC_* se inyecta en build → requiere redeploy.
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL;
  if (!calendlyUrl) {
    console.warn(
      "[booking] Día elegible pero NEXT_PUBLIC_CALENDLY_URL no está configurado; configúralo en el entorno y redeploya."
    );
    return <NotAvailable />;
  }

  return (
    <Shell title="Agenda tu llamada">
      <BookingEmbed calendlyUrl={calendlyUrl} email={user.email ?? ""} />
    </Shell>
  );
}
