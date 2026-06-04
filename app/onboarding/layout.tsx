export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--rosa-soft)" }}>
      <div className="flex items-center justify-center pt-8 pb-4">
        <span
          className="font-head text-xl tracking-widest uppercase"
          style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
        >
          AURA
        </span>
      </div>
      {children}
    </div>
  );
}
