export type Tema = "system" | "light" | "dark";

const KEY = "tema";

export function getTema(): Tema {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* localStorage indisponível */
  }
  return "system";
}

let animTimer: ReturnType<typeof setTimeout> | undefined;

export function applyTema(t: Tema): void {
  const el = document.documentElement;

  // Anima a troca de cores por 0.5s (classe removida logo depois).
  el.classList.add("theme-anim");
  clearTimeout(animTimer);
  animTimer = setTimeout(() => el.classList.remove("theme-anim"), 550);

  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignora */
  }
}

/** Chamado uma vez no boot (main.tsx), antes do render. */
export function initTema(): void {
  const el = document.documentElement;
  const t = getTema();
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
}
