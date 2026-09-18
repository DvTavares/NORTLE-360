import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth";
import { api } from "../api";

const REENVIO_SEG = 30;

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState<"credenciais" | "codigo">("credenciais");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [dev, setDev] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [espera, setEspera] = useState(0);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setInterval(() => setEspera((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [espera]);

  useEffect(() => {
    if (etapa === "codigo") codigoRef.current?.focus();
  }, [etapa]);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !senha) return setError("Informe e-mail e senha.");
    setBusy(true);
    try {
      const { status, data } = await api("/api/login", {
        body: { email: email.trim(), senha },
      });
      if (status === 200 && data.ok && data.etapa === "codigo") {
        setDev(!!data.dev);
        setCodigo("");
        setEspera(REENVIO_SEG);
        setEtapa("codigo");
        return;
      }
      setError(data.error || "Não foi possível entrar.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (codigo.length !== 6) return setError("Digite o código de 6 dígitos.");
    setBusy(true);
    try {
      const { status, data } = await api("/api/login/confirmar", {
        body: { email: email.trim(), codigo },
      });
      if (status === 200 && data.ok) {
        await refresh();
        navigate("/app");
        return;
      }
      setError(data.error || "Não foi possível confirmar.");
      if (status === 400 || status === 429) setEtapa("credenciais");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function reenviar() {
    if (espera > 0 || busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const { data } = await api("/api/login/reenviar", { body: { email: email.trim() } });
      if (data.ok) {
        setEspera(REENVIO_SEG);
        setInfo("Enviamos um novo código.");
      } else {
        setError(data.error || "Não foi possível reenviar.");
      }
    } catch {
      setError("Falha de conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered">
      <Link to="/" className="nav-fixed-left">
        <button type="button" className="sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
          </svg>
          Início
        </button>
      </Link>
      <div className="theme-fixed">
        <ThemeToggle />
      </div>
      <main className="auth-card">
        <Brand tagline />

        {etapa === "credenciais" ? (
          <>
            <h1>Entrar</h1>
            <p className="sub">Acesse sua conta para gerenciar seus imóveis.</p>
            {error && <div className="msg error">{error}</div>}
            <form onSubmit={pedirCodigo} noValidate>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="voce@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <button type="submit" className="primary block" disabled={busy}>
                {busy ? "Enviando código…" : "Entrar"}
              </button>
            </form>
            <p className="foot">
              Ainda não tem conta? <Link to="/anunciar">Criar conta</Link>
            </p>
          </>
        ) : (
          <>
            <h1>Confirme o acesso</h1>
            <p className="sub">
              Enviamos um código de 6 dígitos para <strong>{email}</strong>. Ele vale por 10 minutos.
            </p>
            {dev && (
              <div className="msg ok" style={{ alignItems: "flex-start" }}>
                Ambiente de teste: o código aparece no console do servidor (o e-mail só é enviado de verdade com o SMTP configurado).
              </div>
            )}
            {error && <div className="msg error">{error}</div>}
            {info && <div className="msg ok">{info}</div>}
            <form onSubmit={confirmar} noValidate>
              <div className="field">
                <label htmlFor="codigo">Código</label>
                <input
                  id="codigo"
                  ref={codigoRef}
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <button type="submit" className="primary block" disabled={busy || codigo.length !== 6}>
                {busy ? "Confirmando…" : "Confirmar e entrar"}
              </button>
            </form>
            <div className="foot" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button
                type="button"
                className="ghost sm"
                onClick={() => {
                  setEtapa("credenciais");
                  setError("");
                  setInfo("");
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className="ghost sm"
                onClick={reenviar}
                disabled={espera > 0 || busy}
              >
                {espera > 0 ? `Reenviar em ${espera}s` : "Reenviar código"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
