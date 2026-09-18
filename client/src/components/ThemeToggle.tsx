import { useState } from "react";
import { applyTema, getTema, type Tema } from "../lib/theme";

const IconSol = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const IconLua = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);
const IconAuto = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const OPCOES: { v: Tema; label: string; icon: React.ReactNode }[] = [
  { v: "light", label: "Claro", icon: IconSol },
  { v: "dark", label: "Escuro", icon: IconLua },
  { v: "system", label: "Sistema", icon: IconAuto },
];

export function ThemeToggle() {
  const [tema, setTemaState] = useState<Tema>(getTema());

  function escolher(t: Tema) {
    setTemaState(t);
    applyTema(t);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Tema da interface">
      {OPCOES.map((o) => (
        <button
          key={o.v}
          type="button"
          className={tema === o.v ? "active" : ""}
          title={o.label}
          aria-pressed={tema === o.v}
          onClick={() => escolher(o.v)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
