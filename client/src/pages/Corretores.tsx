import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { AppLayout } from "../components/AppLayout";
import { Modal } from "../components/Modal";

interface Corretor {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
}

const emptyForm = { nome: "", email: "", senha: "", telefone: "", cpf: "" };

function initials(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function Corretores() {
  const navigate = useNavigate();

  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [listaMsg, setListaMsg] = useState("Carregando…");
  const [f, setF] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function carregar() {
    const { status, data } = await api("/api/corretores");
    if (status === 401) return navigate("/login");
    if (status === 403) return navigate("/app");
    const rows: Corretor[] = data.corretores || [];
    setCorretores(rows);
    setListaMsg(rows.length ? "" : "Nenhum corretor cadastrado ainda.");
  }

  useEffect(() => {
    carregar();
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function abrirNovo() {
    setF(emptyForm);
    setEditId(null);
    setMsg(null);
    setModalOpen(true);
  }

  function startEdit(c: Corretor) {
    setMsg(null);
    setEditId(c.id);
    setF({ nome: c.nome, email: c.email, senha: "", telefone: c.telefone ?? "", cpf: "" });
    setModalOpen(true);
  }

  const fechar = useCallback(() => {
    setModalOpen(false);
    setF(emptyForm);
    setEditId(null);
  }, []);

  async function excluir(c: Corretor) {
    if (
      !window.confirm(
        `Excluir o corretor ${c.nome}? Os imóveis dele passam para o pool da imobiliária.`,
      )
    ) {
      return;
    }
    const { status, data } = await api(`/api/corretores/${c.id}`, { method: "DELETE" });
    if (status === 401) return navigate("/login");
    if (data.ok) {
      setMsg({ text: "Corretor excluído.", kind: "ok" });
      await carregar();
    } else {
      setMsg({ text: data.error || "Não foi possível excluir.", kind: "error" });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!f.nome.trim()) return setMsg({ text: "Informe o nome.", kind: "error" });
    if (!editId) {
      if (!f.email.trim()) return setMsg({ text: "Informe o e-mail.", kind: "error" });
      if (f.senha.length < 6) {
        return setMsg({ text: "A senha precisa ter pelo menos 6 caracteres.", kind: "error" });
      }
    }

    setBusy(true);
    try {
      const { status, data } = editId
        ? await api(`/api/corretores/${editId}`, {
            method: "PATCH",
            body: { nome: f.nome.trim(), telefone: f.telefone.trim(), cpf: f.cpf.trim() },
          })
        : await api("/api/corretores", {
            body: {
              nome: f.nome.trim(),
              email: f.email.trim(),
              senha: f.senha,
              telefone: f.telefone.trim(),
              cpf: f.cpf.trim(),
            },
          });
      if ((status === 200 || status === 201) && data.ok) {
        setMsg({
          text: editId ? "Corretor atualizado." : `Corretor #${data.id} cadastrado.`,
          kind: "ok",
        });
        fechar();
        await carregar();
      } else {
        setMsg({ text: data.error || "Não foi possível salvar.", kind: "error" });
      }
    } catch {
      setMsg({ text: "Falha de conexão.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout
      title="Corretores"
      subtitle="Equipe da imobiliária — cadastro, edição e remoção."
      actions={
        <button type="button" className="primary" onClick={abrirNovo}>
          + Novo corretor
        </button>
      }
    >
      <section className="card">
        <div className="card-head">
          <h2>Corretores da imobiliária</h2>
          {corretores.length > 0 && (
            <span className="badge muted">{corretores.length} no total</span>
          )}
        </div>

        {!modalOpen && msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {listaMsg ? (
          <p className="empty">{listaMsg}</p>
        ) : (
          <ul className="list">
            {corretores.map((c) => (
              <li key={c.id}>
                <div className="person">
                  <span className="avatar">{initials(c.nome)}</span>
                  <div className="who">
                    <strong>{c.nome}</strong>
                    <span>{c.email}{c.telefone ? ` · ${c.telefone}` : ""}</span>
                  </div>
                </div>
                <div className="actions">
                  <button type="button" className="sm" onClick={() => startEdit(c)}>Editar</button>
                  <button type="button" className="sm danger" onClick={() => excluir(c)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={fechar}
        title={editId ? `Editar corretor #${editId}` : "Novo corretor"}
      >
        <p className="sub">
          {editId
            ? "E-mail e senha não são alterados por aqui."
            : "O corretor acessa com o e-mail e a senha definidos abaixo."}
        </p>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input id="nome" placeholder="João Souza" value={f.nome} onChange={set("nome")} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="joao@imobiliaria.com.br"
                value={f.email}
                onChange={set("email")}
                disabled={!!editId}
              />
            </div>
          </div>
          <div className="row">
            {!editId && (
              <div className="field">
                <label htmlFor="senha">Senha</label>
                <input id="senha" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={f.senha} onChange={set("senha")} />
              </div>
            )}
            <div className="field">
              <label htmlFor="telefone">Telefone <span className="hint" style={{ display: "inline" }}>· opcional</span></label>
              <input id="telefone" placeholder="(81) 90000-0000" value={f.telefone} onChange={set("telefone")} />
            </div>
            <div className="field">
              <label htmlFor="cpf">CPF <span className="hint" style={{ display: "inline" }}>· opcional</span></label>
              <input id="cpf" placeholder="000.000.000-00" value={f.cpf} onChange={set("cpf")} />
            </div>
          </div>

          <div className="btn-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ghost" onClick={fechar} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Salvando…" : editId ? "Salvar alterações" : "Cadastrar corretor"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
