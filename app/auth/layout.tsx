export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--rosa-soft)" }}>
      <div className="flex-shrink-0 text-center pt-8 pb-4 px-6">
        <span
          className="font-head font-semibold tracking-widest uppercase text-xl"
          style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
        >
          AURA
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-start px-6 pb-9 pt-1 max-w-md mx-auto w-full">
        {children}
      </div>
      <footer className="text-center pb-6 text-xs" style={{ color: "var(--gris-suave)" }}>
        © Aura Maristany ·{" "}
        <a href="#" className="underline">Términos</a> ·{" "}
        <a href="#" className="underline">Privacidad</a>
      </footer>
    </div>
  );
}
