import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth";

export default function Entrada() {
  const { user } = useAuth();

  return (
    <div className="centered">
      <div className="theme-fixed">
        <ThemeToggle />
      </div>

      <main className="landing">
        <div className="hero">
          <Brand full />
          <span className="kicker">Plataforma de gestão e inteligência imobiliária</span>
          <h1>O imóvel certo começa com a informação certa</h1>
          <p>Escolha por onde começar.</p>
        </div>

        <div className="choices">
          <section className="choice">
            <div className="icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 20V9l7-5 7 5v11M4 20h14M9 20v-5h4v5M20.5 20.5 18 18m1.5-3.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>Ver imóveis</h2>
            <p>Explore os imóveis anunciados, com fotos e detalhes. Sem precisar de conta.</p>
            <ul>
              <li>Anúncios mais recentes</li>
              <li>Filtros por preço, bairro e tipo</li>
              <li>Página com todas as fotos</li>
            </ul>
            <div className="spacer" />
            <Link to="/anuncios">
              <button type="button" className="primary block">Ver imóveis anunciados</button>
            </Link>
          </section>

          <section className="choice">
            <div className="icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>Anunciar imóvel</h2>
            <p>Cadastre e organize sua carteira. Para corretores individuais e imobiliárias.</p>
            <ul>
              <li>Cadastro de imóveis com fotos</li>
              <li>Gestão de corretores (imobiliária)</li>
              <li>Painel com a carteira completa</li>
            </ul>
            <div className="spacer" />
            {user ? (
              <Link to="/app">
                <button type="button" className="primary block">Ir para o meu painel</button>
              </Link>
            ) : (
              <Link to="/anunciar">
                <button type="button" className="primary block">Anunciar / criar conta</button>
              </Link>
            )}
          </section>
        </div>

        <p className="foot">
          {user ? (
            <>
              Você está conectado. <Link to="/app">Meu painel</Link>
            </>
          ) : (
            <>
              Já tem conta? <Link to="/login">Entrar</Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
