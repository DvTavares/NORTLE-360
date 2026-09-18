export interface ApiResponse {
  status: number;
  data: any;
}

/** fetch enxuto: GET por padrão, POST se houver body. Sempre devolve { status, data }. */
export async function api(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const res = await fetch(path, {
    method,
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* resposta sem corpo JSON */
  }
  return { status: res.status, data };
}

export const brl = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : `R$ ${v}`;
};
