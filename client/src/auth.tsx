import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api";

export type TipoUsuario = "ADMIN" | "CORRETOR" | "CORRETOR_INDIVIDUAL";

export interface User {
  id: number;
  nome: string;
  email: string;
  tipoUsuario: TipoUsuario;
  empresaId: number | null;
  empresaNome: string | null;
  fotoUrl: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(): Promise<User | null> {
    const { status, data } = await api("/api/me");
    const u = status === 200 && data.ok ? (data.usuario as User) : null;
    setUser(u);
    setLoading(false);
    return u;
  }

  async function logout() {
    await api("/api/logout", { method: "POST" });
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="centered">
        <p className="empty">Carregando…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="centered">
        <p className="empty">Carregando…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.tipoUsuario !== "ADMIN") return <Navigate to="/app" replace />;
  return <>{children}</>;
}
