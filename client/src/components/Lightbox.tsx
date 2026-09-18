import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Foto {
  id: number;
  url: string;
}

interface Props {
  fotos: Foto[];
  startIndex?: number;
  onClose: () => void;
}

export function Lightbox({ fotos, startIndex = 0, onClose }: Props) {
  const [i, setI] = useState(startIndex);
  const total = fotos.length;

  const prev = useCallback(() => setI((n) => (n - 1 + total) % total), [total]);
  const next = useCallback(() => setI((n) => (n + 1) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  if (!total) return null;
  const atual = fotos[Math.min(i, total - 1)];

  return createPortal(
    <div className="lightbox" onMouseDown={onClose}>
      <button type="button" className="lb-close" aria-label="Fechar" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="lb-stage" onMouseDown={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button type="button" className="lb-nav prev" aria-label="Anterior" onClick={prev}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}

        <img className="lb-img" src={atual.url} alt="" />

        {total > 1 && (
          <button type="button" className="lb-nav next" aria-label="Próxima" onClick={next}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="lb-foot" onMouseDown={(e) => e.stopPropagation()}>
          <span className="lb-count">{Math.min(i, total - 1) + 1} / {total}</span>
          <div className="lb-strip">
            {fotos.map((f, idx) => (
              <button
                type="button"
                key={f.id}
                className={"lb-thumb" + (idx === i ? " active" : "")}
                onClick={() => setI(idx)}
                aria-label={`Foto ${idx + 1}`}
              >
                <img src={f.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
