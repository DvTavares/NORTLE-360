import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api, brl } from "../api";
import { AppLayout } from "../components/AppLayout";
import { Modal } from "../components/Modal";
import { Lightbox } from "../components/Lightbox";
import { resizeImage, type ResizedImage } from "../lib/resizeImage";

const MAX_FOTOS = 12;

interface Foto { id: number; url: string; largura: number; altura: number }

const TIPOS = ["Casa", "Apartamento", "Cobertura", "Kitnet", "Terreno", "Sala comercial"];
const EXTRAS = ["Piscina", "Churrasqueira", "Varanda", "Mobiliado", "Elevador", "Portaria 24h", "Área de serviço"];
const STATUS = ["Disponível", "Reservado", "Vendido", "Alugado"];
// status que aparecem na vitrine pública (espelha STATUS_PUBLICO do server.ts)
const STATUS_PUBLICO = ["Disponível", "Reservado"];

const STATUS_BADGE: Record<string, string> = {
  "Disponível": "ok",
  "Reservado": "warn",
  "Vendido": "info",
  "Alugado": "purple",
};

interface Bairro { idBairro: number; nome: string }
interface Carac { idCaracteristica: number; descricao: string }
interface Corretor { id: number; nome: string }
interface ImovelRow {
  id: number;
  valor: string;
  cliente: string | null;
  telefone: string | null;
  referencia: string | null;
  rua: string | null;
  numero: string | null;
  descricao: string;
  status: string | null;
  bairroId: number | null;
  bairro: string | null;
  corretor: string | null;
  corretorId: number | null;
  podeEditar: boolean;
  caracteristicas: { caracteristicaId: number; descricao: string; quantidade: number }[];
  fotos: Foto[];
}

const emptyForm = {
  valor: "",
  bairroId: "",
  status: "Disponível",
  cliente: "",
  telefone: "",
  referencia: "",
  rua: "",
  numero: "",
  descricao: "",
};

export default function Imoveis() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.tipoUsuario === "ADMIN";

  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [caracs, setCaracs] = useState<Carac[]>([]);
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [imoveis, setImoveis] = useState<ImovelRow[]>([]);
  const [listaMsg, setListaMsg] = useState("Carregando…");

  const [f, setF] = useState(emptyForm);
  const [corretorId, setCorretorId] = useState("");
  const [tipo, setTipo] = useState<number | null>(null);
  const [extras, setExtras] = useState<Set<number>>(new Set());
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fotosExistentes, setFotosExistentes] = useState<Foto[]>([]);
  const [fotosNovas, setFotosNovas] = useState<ResizedImage[]>([]);
  const [fotoBusy, setFotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState<{ fotos: Foto[]; index: number } | null>(null);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const totalFotos = fotosExistentes.length + fotosNovas.length;

  async function copiarLink(id: number) {
    const url = `${window.location.origin}/imovel/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback para navegadores/contextos sem Clipboard API
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1800);
  }

  const emptyFiltro = { q: "", status: "", bairro: "", carac: "", dono: "" };
  const [filtro, setFiltro] = useState(emptyFiltro);
  const filtroAtivo = Object.values(filtro).some((v) => v !== "");

  const { tipos, extrasList, comodos } = useMemo(() => {
    const tipos: Carac[] = [];
    const extrasList: Carac[] = [];
    const comodos: Carac[] = [];
    for (const c of caracs) {
      if (TIPOS.includes(c.descricao)) tipos.push(c);
      else if (EXTRAS.includes(c.descricao)) extrasList.push(c);
      else comodos.push(c);
    }
    return { tipos, extrasList, comodos };
  }, [caracs]);

  const imoveisFiltrados = useMemo(() => {
    const q = filtro.q.trim().toLowerCase();
    const caracId = filtro.carac ? Number(filtro.carac) : null;
    return imoveis.filter((i) => {
      if (filtro.status && i.status !== filtro.status) return false;
      if (filtro.bairro && String(i.bairroId ?? "") !== filtro.bairro) return false;
      if (caracId && !i.caracteristicas.some((c) => c.caracteristicaId === caracId)) return false;
      if (filtro.dono === "pool" && i.corretorId != null) return false;
      if (filtro.dono && filtro.dono !== "pool" && String(i.corretorId ?? "") !== filtro.dono) return false;
      if (q) {
        const alvo = [i.bairro, i.referencia, i.cliente, i.corretor, i.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [imoveis, filtro]);

  async function carregarLista() {
    const { status, data } = await api("/api/imoveis");
    if (status === 401) return navigate("/login");
    const rows: ImovelRow[] = data.imoveis || [];
    setImoveis(rows);
    setListaMsg(rows.length ? "" : "Nenhum imóvel cadastrado ainda.");
  }

  useEffect(() => {
    (async () => {
      const [rb, rc] = await Promise.all([api("/api/bairros"), api("/api/caracteristicas")]);
      if (rb.status === 401 || rc.status === 401) return navigate("/login");
      setBairros(rb.data.bairros || []);
      setCaracs(rc.data.caracteristicas || []);
      if (isAdmin) {
        const rk = await api("/api/corretores");
        if (rk.status === 200) setCorretores(rk.data.corretores || []);
      }
      await carregarLista();
    })();
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function toggleExtra(id: number) {
    setExtras((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function resetForm() {
    setF(emptyForm);
    setCorretorId("");
    setTipo(null);
    setExtras(new Set());
    setQtd({});
    setEditId(null);
    setFotosExistentes([]);
    setFotosNovas([]);
  }

  const fechar = useCallback(() => {
    setModalOpen(false);
    resetForm();
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setMsg(null);
    setFotoBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (fotosExistentes.length + fotosNovas.length >= MAX_FOTOS) {
          setMsg({ text: `Máximo de ${MAX_FOTOS} fotos por imóvel.`, kind: "error" });
          break;
        }
        let img: ResizedImage;
        try {
          img = await resizeImage(file);
        } catch {
          setMsg({ text: `Não foi possível processar "${file.name}".`, kind: "error" });
          continue;
        }
        if (editId) {
          const { data } = await api(`/api/imoveis/${editId}/fotos`, {
            body: { dataUrl: img.dataUrl, largura: img.width, altura: img.height },
          });
          if (data.ok) setFotosExistentes((p) => [...p, data.foto]);
          else setMsg({ text: data.error || "Erro ao enviar a foto.", kind: "error" });
        } else {
          setFotosNovas((p) => [...p, img]);
        }
      }
    } finally {
      setFotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removerFotoExistente(id: number) {
    if (!editId) return;
    const { data } = await api(`/api/imoveis/${editId}/fotos/${id}`, { method: "DELETE" });
    if (data.ok) setFotosExistentes((p) => p.filter((f) => f.id !== id));
    else setMsg({ text: data.error || "Erro ao remover a foto.", kind: "error" });
  }

  function abrirNovo() {
    resetForm();
    // ADMIN é corretor também: por padrão o imóvel novo fica com ele.
    if (isAdmin && user?.id) setCorretorId(String(user.id));
    setMsg(null);
    setModalOpen(true);
  }

  function startEdit(row: ImovelRow) {
    setMsg(null);
    setEditId(row.id);
    setF({
      valor: String(row.valor ?? "").replace(".", ","),
      bairroId: row.bairroId ? String(row.bairroId) : "",
      status: row.status ?? "Disponível",
      cliente: row.cliente ?? "",
      telefone: row.telefone ?? "",
      referencia: row.referencia ?? "",
      rua: row.rua ?? "",
      numero: row.numero ?? "",
      descricao: row.descricao ?? "",
    });
    setCorretorId(row.corretorId ? String(row.corretorId) : "");
    setFotosExistentes(row.fotos ?? []);
    setFotosNovas([]);
    let novoTipo: number | null = null;
    const novoExtras = new Set<number>();
    const novoQtd: Record<number, number> = {};
    for (const c of row.caracteristicas) {
      if (!c.caracteristicaId) continue;
      if (TIPOS.includes(c.descricao)) novoTipo = c.caracteristicaId;
      else if (EXTRAS.includes(c.descricao)) novoExtras.add(c.caracteristicaId);
      else novoQtd[c.caracteristicaId] = c.quantidade;
    }
    setTipo(novoTipo);
    setExtras(novoExtras);
    setQtd(novoQtd);
    setModalOpen(true);
  }

  async function excluir(row: ImovelRow) {
    if (!window.confirm(`Excluir o imóvel de ${row.bairro ?? "bairro não informado"} (${brl(row.valor)})?`)) {
      return;
    }
    const { status, data } = await api(`/api/imoveis/${row.id}`, { method: "DELETE" });
    if (status === 401) return navigate("/login");
    if (data.ok) {
      if (editId === row.id) fechar();
      setMsg({ text: "Imóvel excluído.", kind: "ok" });
      await carregarLista();
    } else {
      setMsg({ text: data.error || "Não foi possível excluir.", kind: "error" });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!f.valor.trim()) return setMsg({ text: "Informe o valor.", kind: "error" });
    if (!f.bairroId) return setMsg({ text: "Selecione o bairro.", kind: "error" });

    const caracteristicas: { caracteristicaId: number; quantidade: number }[] = [];
    if (tipo) caracteristicas.push({ caracteristicaId: tipo, quantidade: 1 });
    for (const id of extras) caracteristicas.push({ caracteristicaId: id, quantidade: 1 });
    for (const [id, q] of Object.entries(qtd)) {
      if (q > 0) caracteristicas.push({ caracteristicaId: Number(id), quantidade: q });
    }

    const body = {
      valor: f.valor.trim(),
      bairroId: Number(f.bairroId),
      status: f.status,
      cliente: f.cliente.trim(),
      telefone: f.telefone.trim(),
      referencia: f.referencia.trim(),
      rua: f.rua.trim(),
      numero: f.numero.trim(),
      descricao: f.descricao.trim(),
      ...(isAdmin ? { corretorId: corretorId ? Number(corretorId) : null } : {}),
      caracteristicas,
    };

    setBusy(true);
    try {
      const { status, data } = editId
        ? await api(`/api/imoveis/${editId}`, { method: "PUT", body })
        : await api("/api/imoveis", { body });
      if ((status === 200 || status === 201) && data.ok) {
        // No fluxo de criação, as fotos só sobem agora que o imóvel tem id.
        let fotosFalhas = 0;
        if (!editId && fotosNovas.length) {
          for (const img of fotosNovas) {
            try {
              const r = await api(`/api/imoveis/${data.id}/fotos`, {
                body: { dataUrl: img.dataUrl, largura: img.width, altura: img.height },
              });
              if (!r.data?.ok) fotosFalhas++;
            } catch {
              fotosFalhas++;
            }
          }
        }
        setMsg({
          text:
            (editId ? `Imóvel #${data.id} atualizado.` : `Imóvel #${data.id} cadastrado.`) +
            (fotosFalhas ? ` (${fotosFalhas} foto(s) não enviada(s))` : ""),
          kind: fotosFalhas ? "error" : "ok",
        });
        fechar();
        await carregarLista();
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
      title="Imóveis"
      subtitle={isAdmin ? "Carteira da imobiliária e da equipe." : "Sua carteira de imóveis."}
      actions={
        <button type="button" className="primary" onClick={abrirNovo}>
          + Novo imóvel
        </button>
      }
    >
      <Modal
        open={modalOpen}
        onClose={fechar}
        title={editId ? `Editar imóvel #${editId}` : "Novo imóvel"}
        wide
      >
        <p className="sub">Preencha os dados abaixo. Só valor e bairro são obrigatórios.</p>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="valor">Valor (R$)</label>
              <input id="valor" inputMode="decimal" placeholder="350000" value={f.valor} onChange={set("valor")} />
            </div>
            <div className="field">
              <label htmlFor="bairroId">Bairro</label>
              <select id="bairroId" value={f.bairroId} onChange={set("bairroId")}>
                <option value="">Selecione…</option>
                {bairros.map((b) => (
                  <option key={b.idBairro} value={b.idBairro}>{b.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status">Situação</label>
              <select id="status" value={f.status} onChange={set("status")}>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {isAdmin && (
            <div className="row">
              <div className="field">
                <label htmlFor="corretorId">Responsável</label>
                <select
                  id="corretorId"
                  value={corretorId}
                  onChange={(e) => setCorretorId(e.target.value)}
                >
                  <option value={user?.id}>{user?.nome} (você)</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                  <option value="">Imóvel da imobiliária (pool, sem corretor)</option>
                </select>
              </div>
            </div>
          )}

          <div className="row">
            <div className="field">
              <label htmlFor="cliente">Cliente / proprietário</label>
              <input id="cliente" placeholder="Nome do proprietário" value={f.cliente} onChange={set("cliente")} />
            </div>
            <div className="field">
              <label htmlFor="telefone">Telefone</label>
              <input id="telefone" placeholder="(81) 90000-0000" value={f.telefone} onChange={set("telefone")} />
            </div>
            <div className="field">
              <label htmlFor="referencia">Referência</label>
              <input id="referencia" placeholder="Ap. 302, Ed. Aurora" value={f.referencia} onChange={set("referencia")} />
            </div>
          </div>

          <div className="row">
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="rua">
                Rua <span className="hint" style={{ display: "inline" }}>· uso interno, não aparece no anúncio</span>
              </label>
              <input id="rua" placeholder="Rua das Flores" value={f.rua} onChange={set("rua")} />
            </div>
            <div className="field">
              <label htmlFor="numero">Número</label>
              <input id="numero" placeholder="123" value={f.numero} onChange={set("numero")} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="descricao">
              Descrição <span className="hint" style={{ display: "inline" }}>· aparece no anúncio público</span>
            </label>
            <textarea
              id="descricao"
              rows={4}
              maxLength={2000}
              placeholder="Fale sobre o imóvel: estado, andar, vista, condomínio, diferenciais…"
              value={f.descricao}
              onChange={set("descricao")}
              style={{ height: "auto", padding: "10px 13px", resize: "vertical" }}
            />
          </div>

          <fieldset className="group">
            <legend>Tipo</legend>
            <div className="chips">
              {tipos.length === 0 && <span className="hint">rode <code>npm run seed</code> para popular as opções</span>}
              {tipos.map((c) => (
                <label key={c.idCaracteristica} className="chip">
                  <input
                    type="radio"
                    name="tipo"
                    checked={tipo === c.idCaracteristica}
                    onChange={() => setTipo(c.idCaracteristica)}
                  />
                  {c.descricao}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Cômodos</legend>
            <div className="qty-grid">
              {comodos.map((c) => (
                <label key={c.idCaracteristica}>
                  {c.descricao}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={qtd[c.idCaracteristica] ?? 0}
                    onChange={(e) =>
                      setQtd((prev) => ({
                        ...prev,
                        [c.idCaracteristica]: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Extras</legend>
            <div className="chips">
              {extrasList.map((c) => (
                <label key={c.idCaracteristica} className="chip">
                  <input
                    type="checkbox"
                    checked={extras.has(c.idCaracteristica)}
                    onChange={() => toggleExtra(c.idCaracteristica)}
                  />
                  {c.descricao}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Fotos · {totalFotos}/{MAX_FOTOS}</legend>
            <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
              As imagens são reduzidas para no máx. 1600px antes do envio.
            </p>
            <div className="photo-grid">
              {fotosExistentes.map((f, idx) => (
                <div className="thumb clickable" key={`e${f.id}`}>
                  <img
                    src={f.url}
                    alt=""
                    loading="lazy"
                    onClick={() => setViewer({ fotos: fotosExistentes, index: idx })}
                  />
                  <button
                    type="button"
                    className="rm"
                    aria-label="Remover foto"
                    disabled={fotoBusy}
                    onClick={() => removerFotoExistente(f.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              {fotosNovas.map((img, idx) => (
                <div className="thumb" key={`n${idx}`}>
                  <img src={img.dataUrl} alt="" />
                  <button
                    type="button"
                    className="rm"
                    aria-label="Remover foto"
                    onClick={() => setFotosNovas((p) => p.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}
              {totalFotos < MAX_FOTOS && (
                <label className="add">
                  {fotoBusy ? "Processando…" : "+ Adicionar"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={fotoBusy}
                    onChange={(e) => onFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </fieldset>

          <div className="btn-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ghost" onClick={fechar} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={busy || fotoBusy}>
              {busy ? "Salvando…" : editId ? "Salvar alterações" : "Cadastrar imóvel"}
            </button>
          </div>
        </form>
      </Modal>

      <section className="card">
        <div className="card-head">
          <h2>{isAdmin ? "Imóveis da imobiliária" : "Meus imóveis"}</h2>
          {imoveis.length > 0 && (
            <span className="badge muted">
              {filtroAtivo ? `${imoveisFiltrados.length} de ${imoveis.length}` : `${imoveis.length} no total`}
            </span>
          )}
        </div>

        {!modalOpen && msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {imoveis.length > 0 && (
          <div className="filters" style={{ marginBottom: 18 }}>
            <div className="field">
              <label htmlFor="fq">Busca</label>
              <input
                id="fq"
                placeholder="bairro, cliente, referência…"
                value={filtro.q}
                onChange={(e) => setFiltro((p) => ({ ...p, q: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="fstatus">Situação</label>
              <select
                id="fstatus"
                value={filtro.status}
                onChange={(e) => setFiltro((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="">Todas</option>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fbairro">Bairro</label>
              <select
                id="fbairro"
                value={filtro.bairro}
                onChange={(e) => setFiltro((p) => ({ ...p, bairro: e.target.value }))}
              >
                <option value="">Todos</option>
                {bairros.map((b) => (
                  <option key={b.idBairro} value={b.idBairro}>{b.nome}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fcarac">Característica</label>
              <select
                id="fcarac"
                value={filtro.carac}
                onChange={(e) => setFiltro((p) => ({ ...p, carac: e.target.value }))}
              >
                <option value="">Qualquer</option>
                {caracs.map((c) => (
                  <option key={c.idCaracteristica} value={c.idCaracteristica}>{c.descricao}</option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div className="field">
                <label htmlFor="fdono">Responsável</label>
                <select
                  id="fdono"
                  value={filtro.dono}
                  onChange={(e) => setFiltro((p) => ({ ...p, dono: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value={user?.id}>{user?.nome} (você)</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                  <option value="pool">Imobiliária (pool)</option>
                </select>
              </div>
            )}
            <div className="filters-foot">
              <span className="count">
                {imoveisFiltrados.length} de {imoveis.length} imóvel(is)
              </span>
              {filtroAtivo && (
                <button type="button" className="sm ghost" onClick={() => setFiltro(emptyFiltro)}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {listaMsg ? (
          <p className="empty">{listaMsg}</p>
        ) : imoveisFiltrados.length === 0 ? (
          <p className="empty">Nenhum imóvel corresponde aos filtros.</p>
        ) : (
          <ul className="list">
            {imoveisFiltrados.map((i) => (
              <li key={i.id}>
                <div className="row-media">
                  {i.fotos.length > 0 && (
                    <button
                      type="button"
                      className="lead"
                      title="Ver fotos"
                      onClick={() => setViewer({ fotos: i.fotos, index: 0 })}
                    >
                      <img src={i.fotos[0].url} alt="" loading="lazy" />
                      {i.fotos.length > 1 && <span className="n">{i.fotos.length} fotos</span>}
                    </button>
                  )}
                  <div className="body">
                    <div className="head">
                      <span className="price">{brl(i.valor)}</span>
                      <span className={`badge ${STATUS_BADGE[i.status ?? ""] ?? "muted"}`}>
                        {i.status ?? "—"}
                      </span>
                    </div>
                    <div className="meta">
                      {isAdmin ? `${i.corretor ?? "Imobiliária"} · ` : ""}
                      {i.bairro ?? "sem bairro"}
                      {i.rua ? ` · ${i.rua}${i.numero ? `, ${i.numero}` : ""}` : ""}
                      {i.referencia ? ` · ${i.referencia}` : ""}
                      {i.cliente ? ` · ${i.cliente}` : ""}
                    </div>
                    {i.caracteristicas.length > 0 && (
                      <div className="tags">
                        {i.caracteristicas.map((c, idx) => (
                          <span key={idx} className="tag">
                            {c.quantidade > 1 ? `${c.quantidade}× ` : ""}
                            {c.descricao}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="actions">
                  {i.fotos.length > 0 && (
                    <button
                      type="button"
                      className="sm"
                      onClick={() => setViewer({ fotos: i.fotos, index: 0 })}
                    >
                      Ver fotos ({i.fotos.length})
                    </button>
                  )}
                  <button
                    type="button"
                    className={"sm" + (copiedId === i.id ? " primary" : "")}
                    onClick={() => copiarLink(i.id)}
                    disabled={!STATUS_PUBLICO.includes(i.status ?? "")}
                    title={
                      STATUS_PUBLICO.includes(i.status ?? "")
                        ? "Copiar o link público do anúncio para enviar ao cliente"
                        : "Só aparece nos anúncios enquanto o status for Disponível ou Reservado"
                    }
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7-7l-1.2 1.1" />
                      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
                    </svg>
                    {copiedId === i.id ? "Link copiado!" : "Copiar link"}
                  </button>
                  {i.podeEditar && (
                    <button type="button" className="sm" onClick={() => startEdit(i)}>Editar</button>
                  )}
                  {i.podeEditar && (
                    <button type="button" className="sm danger" onClick={() => excluir(i)}>Excluir</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewer && (
        <Lightbox
          fotos={viewer.fotos}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </AppLayout>
  );
}
