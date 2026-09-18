interface BrandProps {
  /** Logotipo grande (marca + wordmark + assinatura) — telas de entrada. */
  full?: boolean;
  /** Variante compacta: mostra a assinatura abaixo do nome. */
  tagline?: boolean;
}

/**
 * Marca NORTLE 360 — bússola + telhado, preto e dourado.
 * PNGs com fundo transparente em client/public/. No tema escuro os PNGs são
 * recoloridos por CSS (`filter: invert() hue-rotate()`), então o preto vira
 * claro e o dourado se mantém.
 */
export function Brand({ full = false, tagline = false }: BrandProps) {
  if (full) {
    return (
      <div className="brand-full">
        <img
          className="brand-lockup"
          src="/nortle360-claro.png"
          alt="NORTLE 360 — Informações que orientam negócios imobiliários"
        />
      </div>
    );
  }

  return (
    <div className={"brand" + (tagline ? " brand-stacked" : "")}>
      <img className="brand-mark" src="/nortle360-marca-claro.png" alt="" aria-hidden="true" />
      <span className="brand-text">
        <strong>
          NORTLE<span className="brand-360">&nbsp;360</span>
        </strong>
        {tagline && <small>Informações que orientam negócios imobiliários.</small>}
      </span>
    </div>
  );
}
