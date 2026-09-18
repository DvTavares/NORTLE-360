import { Link, Navigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth";

const IconInicio = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
  </svg>
);

const RECURSOS = [
  {
    titulo: "Fotos dos imóveis",
    texto: "Anexe várias fotos por imóvel — o site reduz a resolução sozinho para não pesar.",
    icon: (
      <path
        d="M4 7h3l1.5-2h7L18 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm8 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    ),
  },
  {
    titulo: "Encontre o que o cliente procura",
    texto: "Filtre por bairro, situação, característica ou responsável e chegue rápido na opção certa.",
    icon: (
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    ),
  },
  {
    titulo: "Visão 360° do negócio",
    texto: "Da gestão à negociação: conecte imóveis, clientes e oportunidades e acompanhe a carteira de cada corretor.",
    icon: (
      <path
        d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 8c0-2.8 2.7-5 6-5s6 2.2 6 5M16 8a3 3 0 1 0 0-6M15 19c0-2-.7-3.7-1.8-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function Home() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to="/app" replace />;

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
              <button type="button" className="sm">{IconInicio}Início</button>
            </Link>
            <Link to="/anuncios">
              <button type="button" className="sm">Ver imóveis</button>
            </Link>
            <Link to="/login">
              <button type="button" className="sm primary">Entrar</button>
            </Link>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <div className="landing">
            <div className="hero">
              <Brand full />
              <span className="kicker">Plataforma de gestão e inteligência imobiliária</span>
              <h1>Toda a sua gestão imobiliária em um só lugar</h1>
              <p>
                Cadastre e organize imóveis, centralize informações e encontre com mais
                facilidade as opções que realmente combinam com o perfil de cada cliente.
                Menos tempo procurando. Mais informação para decidir. Mais oportunidades para negociar.
              </p>
            </div>

            <div className="feature-strip">
              {RECURSOS.map((r) => (
                <div className="feature" key={r.titulo}>
                  <div className="feature-ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      {r.icon}
                    </svg>
                  </div>
                  <strong>{r.titulo}</strong>
                  <span>{r.texto}</span>
                </div>
              ))}
            </div>

            <div className="choices">
              <section className="choice">
                <div className="icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 20V7l6-3 6 3v13M4 20h12M4 20H2m14 0h6M16 20V10l4-2v12M8 9h.01M8 13h.01M8 17h.01M12 9h.01M12 13h.01M12 17h.01"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2>Sou uma imobiliária</h2>
                <p>Cadastre a empresa, seja o administrador da conta e registre seus corretores.</p>
                <ul>
                  <li>Gestão de corretores</li>
                  <li>Imóveis da imobiliária e da equipe</li>
                  <li>Visão de todos os imóveis</li>
                </ul>
                <div className="spacer" />
                <Link to="/registro?tipo=empresa">
                  <button type="button" className="primary block">Cadastrar como imobiliária</button>
                </Link>
              </section>

              <section className="choice">
                <div className="icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2>Sou corretor individual</h2>
                <p>Sem vínculo com imobiliária. Cadastre e acompanhe os seus imóveis.</p>
                <ul>
                  <li>Cadastro rápido</li>
                  <li>Sua carteira de imóveis</li>
                  <li>Edição e exclusão a qualquer hora</li>
                </ul>
                <div className="spacer" />
                <Link to="/registro?tipo=corretor">
                  <button type="button" className="primary block">Cadastrar como corretor individual</button>
                </Link>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
