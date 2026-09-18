export function initials(nome?: string | null): string {
  if (!nome) return "?";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

interface Props {
  nome?: string | null;
  fotoUrl?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ nome, fotoUrl, size = 38, className }: Props) {
  const cls = "avatar" + (className ? ` ${className}` : "");
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (fotoUrl) {
    return (
      <span className={cls} style={style}>
        <img src={fotoUrl} alt="" />
      </span>
    );
  }
  return (
    <span className={cls} style={style}>
      {initials(nome)}
    </span>
  );
}
