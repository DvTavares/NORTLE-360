import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { Lightbox } from "../components/Lightbox";
import { api, brl } from "../api";
import { resumoCaracs } from "./Vitrine";

interface Anuncio {
  id: number;
  valor: string;
  status: string | null;
  bairro: string | null;
  descricao: string;
  caracteristicas: { descricao: string; quantidade: number }[];
  fotos: { url: string; largura: number; altura: number }[];
}

const STATUS_BADGE: Record<string, string> = {
  "Disponível": "ok",
  "Reservado": "warn",
  "Vendido": "info",
  "Alugado": "purple",
};

export default function VitrineImovel() {
  const { id } = useParams();
  const [a, setA] = useState<Anuncio | null | "erro">(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [principal, setPrincipal] = useState(0);

  useEffect(() => {
    setA(null);
    setPrincipal(0);
    api(`/api/publico/imoveis/${id}`).then(({ status, data }) => {
      setA(status === 200 && data.ok ? data.imovel : "erro");
    });
  }, [id]);

  const fotos = a && a !== "erro" ? a.fotos : [];
  const anterior = () => setPrincipal((p) => (p - 1 + fotos.length) % fotos.length);
  const proxima = () => setPrincipal((p) => (p + 1) % fotos.length);

  return (
    <div className="vitrine">
      <header className="appbar">
        <div className="appbar-inner">
          <Link to="/" className="appbar-brand" aria-label="Início">
            <Brand />
          </Link>
          <div className="appbar-right">
            <ThemeToggle />
            <Link to="/anunciar">
              <button type="button" className="sm">Anunciar imóvel</button>
            </Link>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container" style={{ maxWidth: 600 }}>
          <Link to="/anuncios" className="card-link" style={{ marginTop: 0, marginBottom: 16 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
            Voltar aos anúncios
          </Link>

          {a === null ? (
            <p className="empty">Carregando…</p>
          ) : a === "erro" ? (
            <p className="empty">Anúncio não encontrado.</p>
          ) : (
            <>
              {fotos.length > 0 && (
                <div className={"pub-galeria2" + (fotos.length === 1 ? " unica" : "")}>
                  <div
                    className="pub-galeria2-principal"
                    role="button"
                    tabIndex={0}
                    aria-label="Ampliar foto"
                    onClick={() => setViewer(principal)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewer(principal); }
                      else if (e.key === "ArrowLeft" && fotos.length > 1) anterior();
                      else if (e.key === "ArrowRight" && fotos.length > 1) proxima();
                    }}
                  >
                    <img src={fotos[principal].url} alt="" />

                    {fotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="pub-galeria2-seta prev"
                          aria-label="Foto anterior"
                          onClick={(e) => { e.stopPropagation(); anterior(); }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
                        </button>
                        <button
                          type="button"
                          className="pub-galeria2-seta next"
                          aria-label="Próxima foto"
                          onClick={(e) => { e.stopPropagation(); proxima(); }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                        </button>
                        <span className="pub-galeria2-contagem">{principal + 1} / {fotos.length}</span>
                      </>
                    )}

                    <span className="pub-galeria2-zoom">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
                      </svg>
                      Ampliar
                    </span>
                  </div>

                  {fotos.length > 1 && (
                    <div className="pub-galeria2-miniaturas">
                      {fotos.map((f, idx) => (
                        <button
                          type="button"
                          key={idx}
                          className={"pub-galeria2-mini" + (idx === principal ? " ativa" : "")}
                          aria-label={`Ver foto ${idx + 1}`}
                          aria-current={idx === principal}
                          onClick={() => setPrincipal(idx)}
                        >
                          <img src={f.url} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="card">
                <div className="pub-det-head">
                  <span className="pub-preco lg">{brl(a.valor)}</span>
                  {a.status && (
                    <span className={`badge ${STATUS_BADGE[a.status] ?? "muted"}`}>{a.status}</span>
                  )}
                </div>
                <p className="pub-meta" style={{ marginBottom: a.descricao ? 16 : 0 }}>
                  {[resumoCaracs(a.caracteristicas), a.bairro]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>

                {a.descricao && <p className="pub-det-desc">{a.descricao}</p>}

                {a.caracteristicas.length > 0 && (
                  <div className="tags" style={{ marginTop: 18 }}>
                    {a.caracteristicas.map((c, i) => (
                      <span key={i} className="tag">
                        {c.quantidade > 1 ? `${c.quantidade}× ` : ""}
                        {c.descricao}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {viewer !== null && a !== null && a !== "erro" && (
        <Lightbox
          fotos={a.fotos.map((f, i) => ({ id: i, url: f.url }))}
          startIndex={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
