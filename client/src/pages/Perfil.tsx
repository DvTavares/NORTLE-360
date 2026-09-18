import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { AppLayout } from "../components/AppLayout";
import { Avatar } from "../components/Avatar";
import { resizeImage } from "../lib/resizeImage";

const LABEL_TIPO: Record<string, string> = {
  ADMIN: "Imobiliária (administrador)",
  CORRETOR: "Corretor",
  CORRETOR_INDIVIDUAL: "Corretor autônomo",
};

type Msg = { text: string; kind: "ok" | "error" } | null;

interface Perfil {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  instagram: string;
  tipoUsuario: string;
  empresaNome: string | null;
  fotoUrl: string | null;
}

export default function Perfil() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [p, setP] = useState<Perfil | null>(null);
  const [f, setF] = useState({ nome: "", email: "", telefone: "", cpf: "", instagram: "" });
  const [dadosMsg, setDadosMsg] = useState<Msg>(null);
  const [dadosBusy, setDadosBusy] = useState(false);

  const [sf, setSf] = useState({ atual: "", nova: "", conf: "" });
  const [senhaMsg, setSenhaMsg] = useState<Msg>(null);
  const [senhaBusy, setSenhaBusy] = useState(false);

  const [fotoMsg, setFotoMsg] = useState<Msg>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    const { status, data } = await api("/api/perfil");
    if (status === 401) return navigate("/login");
    if (data.ok) {
      const perfil: Perfil = data.perfil;
      setP(perfil);
      setF({
        nome: perfil.nome,
        email: perfil.email,
        telefone: perfil.telefone,
        cpf: perfil.cpf,
        instagram: perfil.instagram,
      });
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const setS = (k: keyof typeof sf) => (e: { target: { value: string } }) =>
    setSf((prev) => ({ ...prev, [k]: e.target.value }));

  async function enviarFoto(file: File | undefined) {
    if (!file) return;
    setFotoMsg(null);
    setFotoBusy(true);
    try {
      const img = await resizeImage(file, 512);
      const { data } = await api("/api/perfil/foto", { body: { dataUrl: img.dataUrl } });
      if (data.ok) {
        setP((prev) => (prev ? { ...prev, fotoUrl: data.fotoUrl } : prev));
        await refresh();
        setFotoMsg({ text: "Foto atualizada.", kind: "ok" });
      } else {
        setFotoMsg({ text: data.error || "Erro ao enviar a foto.", kind: "error" });
      }
    } catch {
      setFotoMsg({ text: "Não foi possível processar a imagem.", kind: "error" });
    } finally {
      setFotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removerFoto() {
    if (!window.confirm("Remover sua foto de perfil?")) return;
    setFotoBusy(true);
    const { data } = await api("/api/perfil/foto", { method: "DELETE" });
    if (data.ok) {
      setP((prev) => (prev ? { ...prev, fotoUrl: null } : prev));
      await refresh();
      setFotoMsg({ text: "Foto removida.", kind: "ok" });
    } else {
      setFotoMsg({ text: data.error || "Erro ao remover.", kind: "error" });
    }
    setFotoBusy(false);
  }

  async function salvarDados(e: FormEvent) {
    e.preventDefault();
    setDadosMsg(null);
    if (!f.nome.trim()) return setDadosMsg({ text: "Informe o nome.", kind: "error" });
    if (!f.email.trim()) return setDadosMsg({ text: "Informe o e-mail.", kind: "error" });
    setDadosBusy(true);
    try {
      const { data } = await api("/api/perfil", {
        method: "PATCH",
        body: {
          nome: f.nome.trim(),
          email: f.email.trim(),
          telefone: f.telefone.trim(),
          cpf: f.cpf.trim(),
          instagram: f.instagram.trim(),
        },
      });
      if (data.ok) {
        await refresh();
        await carregar();
        setDadosMsg({ text: "Dados salvos.", kind: "ok" });
      } else {
        setDadosMsg({ text: data.error || "Não foi possível salvar.", kind: "error" });
      }
    } catch {
      setDadosMsg({ text: "Falha de conexão.", kind: "error" });
    } finally {
      setDadosBusy(false);
    }
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault();
    setSenhaMsg(null);
    if (sf.nova.length < 6) {
      return setSenhaMsg({ text: "A nova senha precisa ter pelo menos 6 caracteres.", kind: "error" });
    }
    if (sf.nova !== sf.conf) {
      return setSenhaMsg({ text: "A confirmação não confere.", kind: "error" });
    }
    setSenhaBusy(true);
    try {
      const { data } = await api("/api/perfil/senha", {
        method: "PATCH",
        body: { atual: sf.atual, nova: sf.nova },
      });
      if (data.ok) {
        setSf({ atual: "", nova: "", conf: "" });
        setSenhaMsg({ text: "Senha alterada.", kind: "ok" });
      } else {
        setSenhaMsg({ text: data.error || "Não foi possível trocar a senha.", kind: "error" });
      }
    } catch {
      setSenhaMsg({ text: "Falha de conexão.", kind: "error" });
    } finally {
      setSenhaBusy(false);
    }
  }

  return (
    <AppLayout title="Meu perfil" subtitle="Foto, dados de contato e senha.">
      <div className="dash">
        <div className="dash-main">
          <section className="card">
            <h2>Dados</h2>
            <p className="sub">Como você aparece no sistema.</p>
            {dadosMsg && <div className={`msg ${dadosMsg.kind}`}>{dadosMsg.text}</div>}
            <form onSubmit={salvarDados} noValidate>
              <div className="row">
                <div className="field">
                  <label htmlFor="nome">Nome</label>
                  <input id="nome" value={f.nome} onChange={set("nome")} placeholder="Seu nome" />
                </div>
                <div className="field">
                  <label htmlFor="email">E-mail (login)</label>
                  <input id="email" type="email" value={f.email} onChange={set("email")} placeholder="voce@email.com" />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="telefone">Telefone</label>
                  <input id="telefone" value={f.telefone} onChange={set("telefone")} placeholder="(81) 90000-0000" />
                </div>
                <div className="field">
                  <label htmlFor="instagram">Instagram</label>
                  <input id="instagram" value={f.instagram} onChange={set("instagram")} placeholder="@seuperfil" />
                </div>
                <div className="field">
                  <label htmlFor="cpf">CPF</label>
                  <input id="cpf" value={f.cpf} onChange={set("cpf")} placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="btn-row">
                <button type="submit" className="primary" disabled={dadosBusy}>
                  {dadosBusy ? "Salvando…" : "Salvar dados"}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>Senha</h2>
            <p className="sub">Deixe em branco se não quiser trocar.</p>
            {senhaMsg && <div className={`msg ${senhaMsg.kind}`}>{senhaMsg.text}</div>}
            <form onSubmit={trocarSenha} noValidate>
              <div className="field" style={{ maxWidth: 320 }}>
                <label htmlFor="atual">Senha atual</label>
                <input id="atual" type="password" autoComplete="current-password" value={sf.atual} onChange={setS("atual")} />
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="nova">Nova senha</label>
                  <input id="nova" type="password" autoComplete="new-password" value={sf.nova} onChange={setS("nova")} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="field">
                  <label htmlFor="conf">Confirmar nova senha</label>
                  <input id="conf" type="password" autoComplete="new-password" value={sf.conf} onChange={setS("conf")} />
                </div>
              </div>
              <div className="btn-row">
                <button type="submit" className="primary" disabled={senhaBusy}>
                  {senhaBusy ? "Salvando…" : "Trocar senha"}
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="dash-side">
          <section className="card">
            <h2>Foto de perfil</h2>
            <div className="perfil-foto">
              <Avatar nome={p?.nome ?? user?.nome} fotoUrl={p?.fotoUrl} size={96} className="lg" />
              {fotoMsg && <div className={`msg ${fotoMsg.kind}`} style={{ margin: "12px 0 0", width: "100%" }}>{fotoMsg.text}</div>}
              <div className="btn-row" style={{ marginTop: 14, justifyContent: "center" }}>
                <label className="btn primary sm" style={{ cursor: fotoBusy ? "progress" : "pointer" }}>
                  {fotoBusy ? "Enviando…" : p?.fotoUrl ? "Trocar" : "Enviar foto"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={fotoBusy}
                    onChange={(e) => enviarFoto(e.target.files?.[0])}
                  />
                </label>
                {p?.fotoUrl && (
                  <button type="button" className="sm danger" disabled={fotoBusy} onClick={removerFoto}>
                    Remover
                  </button>
                )}
              </div>
              <p className="hint" style={{ marginTop: 10, textAlign: "center" }}>
                A imagem é reduzida para 512px antes de subir.
              </p>
            </div>
          </section>

          <section className="card">
            <h2>Conta</h2>
            <dl className="kv">
              <dt>Perfil</dt>
              <dd>
                <span className={`badge ${p?.tipoUsuario === "ADMIN" ? "purple" : "info"}`}>
                  {LABEL_TIPO[p?.tipoUsuario ?? ""] ?? p?.tipoUsuario ?? "—"}
                </span>
              </dd>
              <dt>Imobiliária</dt>
              <dd>{p?.empresaNome ?? "Sem vínculo"}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </AppLayout>
  );
}
