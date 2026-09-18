import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api, brl } from "../api";
import { AppLayout } from "../components/AppLayout";

const LABEL_TIPO: Record<string, string> = {
  ADMIN: "Imobiliária (administrador)",
  CORRETOR: "Corretor",
  CORRETOR_INDIVIDUAL: "Corretor autônomo",
};

const STATUS_ORDEM = ["Disponível", "Reservado", "Vendido", "Alugado"];
const STATUS_BADGE: Record<string, string> = {
  "Disponível": "ok",
  "Reservado": "warn",
  "Vendido": "info",
  "Alugado": "purple",
};

interface ImovelRow {
  id: number;
  valor: string;
  status: string | null;
  bairro: string | null;
  corretor: string | null;
}

export default function Painel() {
  const { user } = useAuth();
  const isAdmin = user?.tipoUsuario === "ADMIN";

  const [imoveis, setImoveis] = useState<ImovelRow[] | null>(null);
  const [nCorretores, setNCorretores] = useState<number | null>(null);

  useEffect(() => {
    api("/api/imoveis").then(({ status, data }) => {
      setImoveis(status === 200 && data.ok ? data.imoveis || [] : []);
    });
    if (isAdmin) {
      api("/api/corretores").then(({ status, data }) => {
        if (status === 200 && data.ok) setNCorretores((data.corretores || []).length);
      });
    }
  }, [isAdmin]);

  const { total, soma, porStatus, recentes, topBairros } = useMemo(() => {
    const lista = imoveis ?? [];
    const porStatus = STATUS_ORDEM.map((st) => ({
      status: st,
      n: lista.filter((i) => i.status === st).length,
    }));
    const bairroMap = new Map<string, number>();
    for (const i of lista) {
      const b = i.bairro ?? "Sem bairro";
      bairroMap.set(b, (bairroMap.get(b) ?? 0) + 1);
    }
    const topBairros = [...bairroMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    return {
      total: lista.length,
      soma: lista.reduce((s, i) => s + (Number(i.valor) || 0), 0),
      porStatus,
      recentes: lista.slice(0, 5),
      topBairros,
    };
  }, [imoveis]);

  const carregando = imoveis === null;

  return (
    <AppLayout
      title={`Olá, ${user?.nome?.split(" ")[0] ?? ""}`}
      subtitle="Um resumo da sua conta e da carteira de imóveis."
    >
      <div className="dash">
        <div className="dash-main">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>{isAdmin ? "Carteira da imobiliária" : "Sua carteira"}</h2>
                <p className="sub" style={{ margin: 0 }}>
                  {carregando ? "Carregando…" : `Valor somado ${brl(soma)}`}
                </p>
              </div>
            </div>
            <div className="stats">
              <div className="stat accent">
                <span className="stat-n">{total}</span>
                <span className="stat-l">Imóveis no total</span>
              </div>
              {porStatus.map((s) => (
                <div className="stat" key={s.status}>
                  <span className="stat-n">{s.n}</span>
                  <span className={`stat-l badge ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                </div>
              ))}
              {isAdmin && (
                <div className="stat">
                  <span className="stat-n">{nCorretores ?? "—"}</span>
                  <span className="stat-l">Corretores</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <h2>Últimos imóveis</h2>
            {carregando ? (
              <p className="sub" style={{ margin: 0 }}>Carregando…</p>
            ) : recentes.length === 0 ? (
              <p className="empty">Nenhum imóvel cadastrado ainda.</p>
            ) : (
              <>
                <ul className="mini-list">
                  {recentes.map((i) => (
                    <li key={i.id}>
                      <span className="m-main">
                        <span className="m-price">{brl(i.valor)}</span>
                        <span className="m-sub">
                          {isAdmin ? `${i.corretor ?? "Imobiliária"} · ` : ""}
                          {i.bairro ?? "sem bairro"}
                        </span>
                      </span>
                      <span className={`badge ${STATUS_BADGE[i.status ?? ""] ?? "muted"}`}>
                        {i.status ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link className="card-link" to="/imoveis">
                  Ver todos os imóveis
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </>
            )}
          </section>

          {!carregando && topBairros.length > 0 && (
            <section className="card">
              <h2>Imóveis por bairro</h2>
              <ul className="mini-list">
                {topBairros.map(([nome, n]) => (
                  <li key={nome}>
                    <span className="m-main">
                      <span className="m-sub" style={{ fontSize: "0.9rem", color: "var(--fg)" }}>{nome}</span>
                    </span>
                    <span className="m-count">{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="dash-side">
          <section className="card">
            <h2>Atalhos</h2>
            <div className="quick">
              <Link to="/imoveis">
                <button type="button" className="primary block">
                  {isAdmin ? "Ver imóveis" : "Meus imóveis"}
                </button>
              </Link>
              {isAdmin && (
                <Link to="/corretores">
                  <button type="button" className="block">Gerenciar corretores</button>
                </Link>
              )}
            </div>
          </section>

          <section className="card">
            <h2>Sua conta</h2>
            <dl className="kv">
              <dt>Nome</dt>
              <dd>{user?.nome}</dd>
              <dt>E-mail</dt>
              <dd>{user?.email}</dd>
              <dt>Perfil</dt>
              <dd>
                <span className={`badge ${isAdmin ? "purple" : "info"}`}>
                  {LABEL_TIPO[user?.tipoUsuario ?? ""] ?? user?.tipoUsuario}
                </span>
              </dd>
              <dt>{user?.tipoUsuario === "CORRETOR_INDIVIDUAL" ? "Vínculo" : "Imobiliária"}</dt>
              <dd>{user?.empresaNome ?? "Sem vínculo (autônomo)"}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </AppLayout>
  );
}
