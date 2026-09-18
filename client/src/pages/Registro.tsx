import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth";
import { api } from "../api";

type Modo = "corretor" | "imobiliaria";

export default function Registro() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tipoParam = params.get("tipo");
  // Um "tipo" válido na URL (vindo da landing) trava o modo e esconde o seletor.
  const modoTravado =
    tipoParam === "empresa" ||
    tipoParam === "imobiliaria" ||
    tipoParam === "corretor";
  const modoInicial: Modo =
    tipoParam === "empresa" || tipoParam === "imobiliaria"
      ? "imobiliaria"
      : "corretor";
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [f, setF] = useState({
    nome: "",
    email: "",
    senha: "",
    empresaNome: "",
    cnpj: "",
    empresaTelefone: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const nome = f.nome.trim();
    const email = f.email.trim();
    if (!nome || !email) return setError("Preencha nome e e-mail.");
    if (f.senha.length < 6) {
      return setError("A senha precisa ter pelo menos 6 caracteres.");
    }
    if (modo === "imobiliaria" && (!f.empresaNome.trim() || !f.cnpj.trim())) {
      return setError("Informe o nome e o CNPJ da imobiliária.");
    }

    const rota = modo === "imobiliaria" ? "/api/registrar-imobiliaria" : "/api/registrar";
    const payload =
      modo === "imobiliaria"
        ? {
            nome,
            email,
            senha: f.senha,
            empresaNome: f.empresaNome.trim(),
            cnpj: f.cnpj.trim(),
            empresaTelefone: f.empresaTelefone.trim(),
          }
        : { nome, email, senha: f.senha };

    setBusy(true);
    try {
      const { status, data } = await api(rota, { body: payload });
      if ((status === 200 || status === 201) && data.ok) {
        await refresh();
        navigate("/app");
        return;
      }
      setError(data.error || "Não foi possível criar a conta.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
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
        <h1>Criar conta</h1>
        <p className="sub">
          {modo === "imobiliaria"
            ? "Cadastre a imobiliária e a conta de administrador."
            : "Cadastre-se como corretor autônomo para gerenciar seus imóveis."}
        </p>

        {!modoTravado && (
          <div className="segmented">
            <button
              type="button"
              className={modo === "corretor" ? "primary" : ""}
              onClick={() => setModo("corretor")}
            >
              Corretor autônomo
            </button>
            <button
              type="button"
              className={modo === "imobiliaria" ? "primary" : ""}
              onClick={() => setModo("imobiliaria")}
            >
              Imobiliária
            </button>
          </div>
        )}

        {error && <div className="msg error">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          {modo === "imobiliaria" && (
            <>
              <div className="field">
                <label htmlFor="empresaNome">Nome da imobiliária</label>
                <input
                  id="empresaNome"
                  placeholder="Imobiliária Aurora"
                  value={f.empresaNome}
                  onChange={set("empresaNome")}
                />
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="cnpj">CNPJ</label>
                  <input
                    id="cnpj"
                    placeholder="00.000.000/0001-00"
                    value={f.cnpj}
                    onChange={set("cnpj")}
                  />
                </div>
                <div className="field">
                  <label htmlFor="empresaTelefone">Telefone (opcional)</label>
                  <input
                    id="empresaTelefone"
                    placeholder="(81) 3000-0000"
                    value={f.empresaTelefone}
                    onChange={set("empresaTelefone")}
                  />
                </div>
              </div>
              <hr className="hr" />
            </>
          )}

          <div className="field">
            <label htmlFor="nome">
              {modo === "imobiliaria" ? "Seu nome (administrador)" : "Seu nome"}
            </label>
            <input
              id="nome"
              autoComplete="name"
              placeholder="Maria Silva"
              value={f.nome}
              onChange={set("nome")}
            />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="maria@email.com"
              value={f.email}
              onChange={set("email")}
            />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha (mín. 6 caracteres)</label>
            <input
              id="senha"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={f.senha}
              onChange={set("senha")}
            />
          </div>

          <button type="submit" className="primary block" disabled={busy}>
            {busy ? "Criando…" : "Criar conta"}
          </button>
        </form>

        <p className="foot">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </main>
    </div>
  );
}
