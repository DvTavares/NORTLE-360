import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth";
import { api, brl } from "../api";

interface Anuncio {
  id: number;
  valor: string;
  status: string | null;
  bairro: string | null;
  descricao: string;
  caracteristicas: { descricao: string; quantidade: number }[];
  fotos: { url: string }[];
}

const STATUS_BADGE: Record<string, string> = {
  "Disponível": "ok",
  "Reservado": "warn",
  "Vendido": "info",
  "Alugado": "purple",
};
const TIPOS = ["Casa", "Apartamento", "Cobertura", "Kitnet", "Terreno", "Sala comercial"];
// características que são contagem (têm filtro próprio ou não fazem sentido como "tem/não tem")
const CARACS_NUMERICAS = ["Quartos", "Suítes", "Banheiros", "Vagas de garagem", "Salas"];

export function resumoCaracs(c: { descricao: string; quantidade: number }[]): string {
  const partes: string[] = [];
  const get = (n: string) => c.find((x) => x.descricao === n);
  const tipo = TIPOS.map(get).find(Boolean);
  if (tipo) partes.push(tipo.descricao);
  const q = get("Quartos");
  if (q) partes.push(`${q.quantidade} quarto${q.quantidade > 1 ? "s" : ""}`);
  const v = get("Vagas de garagem");
  if (v) partes.push(`${v.quantidade} vaga${v.quantidade > 1 ? "s" : ""}`);
  return partes.join(" · ");
}

const soDigitos = (v: string) => Number(String(v).replace(/[^\d]/g, "")) || 0;
function qtdCarac(a: Anuncio, nome: string): number {
  return a.caracteristicas.find((c) => c.descricao === nome)?.quantidade ?? 0;
}

const filtroVazio = {
  precoMin: "",
  precoMax: "",
  bairro: "",
  tipo: "",
  quartos: "",
  vagas: "",
  caracs: [] as string[],
};
type CampoTexto = Exclude<keyof typeof filtroVazio, "caracs">;

export default function Vitrine() {
  const { user } = useAuth();
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState(filtroVazio);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    api("/api/publico/imoveis").then(({ status, data }) =>
      setAnuncios(status === 200 && data.ok ? data.imoveis || [] : []),
    );
  }, []);

  const bairros = useMemo(
    () =>
      [...new Set((anuncios ?? []).map((a) => a.bairro).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [anuncios],
  );

  // amenidades presentes nos anúncios (ex.: Piscina, Churrasqueira, Varanda…)
  const amenidades = useMemo(() => {
    const set = new Set<string>();
    for (const a of anuncios ?? []) {
      for (const c of a.caracteristicas) {
        if (!TIPOS.includes(c.descricao) && !CARACS_NUMERICAS.includes(c.descricao)) {
          set.add(c.descricao);
        }
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [anuncios]);

  const set = (k: CampoTexto) => (e: { target: { value: string } }) =>
    setFiltro((p) => ({ ...p, [k]: e.target.value }));

  const toggleCarac = (nome: string) =>
    setFiltro((p) => ({
      ...p,
      caracs: p.caracs.includes(nome)
        ? p.caracs.filter((c) => c !== nome)
        : [...p.caracs, nome],
    }));

  const nFiltros =
    [filtro.precoMin, filtro.precoMax, filtro.bairro, filtro.tipo, filtro.quartos, filtro.vagas]
      .filter(Boolean).length + filtro.caracs.length;

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const min = soDigitos(filtro.precoMin);
    const max = soDigitos(filtro.precoMax);
    const nQuartos = soDigitos(filtro.quartos);
    const nVagas = soDigitos(filtro.vagas);

    return (anuncios ?? []).filter((a) => {
      if (t) {
        const alvo = [a.bairro, a.descricao, resumoCaracs(a.caracteristicas)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      const valor = Number(a.valor) || 0;
      if (min && valor < min) return false;
      if (max && valor > max) return false;
      if (filtro.bairro && a.bairro !== filtro.bairro) return false;
      if (filtro.tipo && !a.caracteristicas.some((c) => c.descricao === filtro.tipo)) return false;
      if (nQuartos && qtdCarac(a, "Quartos") < nQuartos) return false;
      if (nVagas && qtdCarac(a, "Vagas de garagem") < nVagas) return false;
      if (filtro.caracs.some((nome) => qtdCarac(a, nome) < 1)) return false;
      return true;
    });
  }, [anuncios, q, filtro]);

  const semNada = anuncios !== null && anuncios.length === 0;

  return (
    <div className="vitrine">
      <header className="appbar">
        <div className="appbar-inner">
          <Link to="/" className="appbar-brand" aria-label="Início">
            <Brand />
          </Link>
          <div className="appbar-right">
            <ThemeToggle />
            <Link to="/">
              <button type="button" className="sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
                </svg>
                Início
              </button>
            </Link>
            {user ? (
              <Link to="/app">
                <button type="button" className="sm">Meu painel</button>
              </Link>
            ) : (
              <Link to="/anunciar">
                <button type="button" className="sm">Anunciar imóvel</button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <div className="vit-hero">
            <h1>O imóvel certo começa com a informação certa</h1>
            <p>Os anúncios mais recentes. Toque num imóvel para ver as fotos e os detalhes.</p>
          </div>

          <div className="vit-toolbar">
            <input
              className="vit-busca"
              placeholder="Buscar por bairro, tipo, referência…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              className={"vit-filtro-btn" + (nFiltros ? " primary" : "")}
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filtros{nFiltros ? ` (${nFiltros})` : ""}
            </button>
          </div>

          {aberto && (
            <div className="filters" style={{ marginBottom: 18 }}>
              <div className="field">
                <label>Preço mínimo</label>
                <input inputMode="numeric" placeholder="R$" value={filtro.precoMin} onChange={set("precoMin")} />
              </div>
              <div className="field">
                <label>Preço máximo</label>
                <input inputMode="numeric" placeholder="R$" value={filtro.precoMax} onChange={set("precoMax")} />
              </div>
              <div className="field">
                <label>Bairro</label>
                <select value={filtro.bairro} onChange={set("bairro")}>
                  <option value="">Todos</option>
                  {bairros.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={filtro.tipo} onChange={set("tipo")}>
                  <option value="">Qualquer</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quartos (mín.)</label>
                <select value={filtro.quartos} onChange={set("quartos")}>
                  <option value="">Qualquer</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}+</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Vagas (mín.)</label>
                <select value={filtro.vagas} onChange={set("vagas")}>
                  <option value="">Qualquer</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}+</option>
                  ))}
                </select>
              </div>
              {amenidades.length > 0 && (
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Características</label>
                  <div className="chips">
                    {amenidades.map((nome) => (
                      <label key={nome} className="chip">
                        <input
                          type="checkbox"
                          checked={filtro.caracs.includes(nome)}
                          onChange={() => toggleCarac(nome)}
                        />
                        {nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="filters-foot">
                <span className="count">{filtrados.length} resultado(s)</span>
                {nFiltros > 0 && (
                  <button type="button" className="sm ghost" onClick={() => setFiltro(filtroVazio)}>
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {anuncios === null ? (
            <p className="empty">Carregando anúncios…</p>
          ) : filtrados.length === 0 ? (
            <p className="empty">
              {semNada
                ? "Nenhum anúncio disponível no momento."
                : "Nenhum imóvel encontrado com esses filtros."}
            </p>
          ) : (
            <>
              <p className="vit-contagem">
                {filtrados.length} anúncio(s)
                {(nFiltros || q.trim()) && anuncios.length !== filtrados.length
                  ? ` de ${anuncios.length}`
                  : ""}
              </p>
              <div className="pub-grid">
                {filtrados.map((a) => (
                  <Link key={a.id} to={`/imovel/${a.id}`} className="pub-card">
                    <div className="pub-foto">
                      {a.fotos[0] ? (
                        <img src={a.fotos[0].url} alt="" loading="lazy" />
                      ) : (
                        <span className="pub-sem-foto">sem foto</span>
                      )}
                      {a.fotos.length > 1 && <span className="pub-n">{a.fotos.length} fotos</span>}
                      {a.status && (
                        <span className={`badge ${STATUS_BADGE[a.status] ?? "muted"} pub-status`}>
                          {a.status}
                        </span>
                      )}
                    </div>
                    <div className="pub-corpo">
                      <span className="pub-preco">{brl(a.valor)}</span>
                      <span className="pub-meta">
                        {[resumoCaracs(a.caracteristicas), a.bairro].filter(Boolean).join(" · ") || "—"}
                      </span>
                      {a.descricao && <span className="pub-desc">{a.descricao}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
