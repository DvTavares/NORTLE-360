import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Brand } from "./Brand";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../auth";

const LABEL_TIPO: Record<string, string> = {
  ADMIN: "Imobiliária",
  CORRETOR: "Corretor",
  CORRETOR_INDIVIDUAL: "Corretor autônomo",
};

const IconPainel = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
const IconImoveis = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" />
  </svg>
);
const IconCorretores = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3 2.6-5 5.5-5s5.5 2 5.5 5" /><path d="M16 11a3 3 0 1 0 0-6" /><path d="M17.5 20c0-2.4-.8-4.2-2.2-5" />
  </svg>
);

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppLayout({ title, subtitle, actions, children }: Props) {
  const { user, logout } = useAuth();
  const isAdmin = user?.tipoUsuario === "ADMIN";
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => setMenu(false), [loc.pathname]);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  async function sair() {
    await logout();
    window.location.assign("/");
  }

  const cls = ({ isActive }: { isActive: boolean }) => "navlink" + (isActive ? " active" : "");

  return (
    <div className="app app-top">
      <header className="appbar">
        <div className="appbar-inner">
          <Link to="/app" className="appbar-brand" aria-label="Início">
            <Brand />
          </Link>

          <nav className="appbar-nav">
            <NavLink to="/app" className={cls}>{IconPainel}<span>Painel</span></NavLink>
            <NavLink to="/imoveis" className={cls}>{IconImoveis}<span>Imóveis</span></NavLink>
            {isAdmin && (
              <NavLink to="/corretores" className={cls}>{IconCorretores}<span>Corretores</span></NavLink>
            )}
          </nav>

          <div className="appbar-right">
            <Link to="/">
              <button type="button" className="sm" title="Página inicial">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
                </svg>
                Início
              </button>
            </Link>
            <ThemeToggle />
            <div className="usermenu" ref={menuRef}>
              <button
                type="button"
                className="usermenu-btn"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu((v) => !v)}
                title="Meu perfil"
              >
                <Avatar nome={user?.nome} fotoUrl={user?.fotoUrl} size={34} />
              </button>

              {menu && (
                <div className="usermenu-pop" role="menu">
                  <div className="usermenu-head">
                    <Avatar nome={user?.nome} fotoUrl={user?.fotoUrl} size={42} />
                    <div className="who">
                      <strong>{user?.nome}</strong>
                      <span>{user?.email}</span>
                      <span className="who-tag">
                        {LABEL_TIPO[user?.tipoUsuario ?? ""] ?? ""}
                        {user?.empresaNome ? ` · ${user.empresaNome}` : ""}
                      </span>
                    </div>
                  </div>
                  <Link to="/perfil" role="menuitem" className="usermenu-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
                    </svg>
                    Meu perfil
                  </Link>
                  <button type="button" role="menuitem" className="usermenu-item danger" onClick={sair}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h12" />
                    </svg>
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <header className="page-head">
            <div>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="btn-row">{actions}</div>}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
