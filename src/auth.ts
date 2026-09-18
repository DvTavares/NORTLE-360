import "dotenv/config";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/* -------------------------------------------------------------------------- */
/*  Senha — hash scrypt (formato: scrypt$N$salt_hex$hash_hex, cabe em 255)    */
/* -------------------------------------------------------------------------- */

const SCRYPT_COST = 16384; // N
const KEY_LEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LEN, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;

  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isInteger(cost) || salt.length === 0 || expected.length === 0) {
    return false;
  }

  const actual = scryptSync(plain, salt, expected.length, { N: cost });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* -------------------------------------------------------------------------- */
/*  Tokens assinados (HMAC-SHA256), estilo JWT enxuto                         */
/* -------------------------------------------------------------------------- */

const SECRET =
  process.env.SESSION_SECRET ??
  "dev-only-insecure-secret-troque-no-.env-para-producao";

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString("base64url");

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

/** Assina `payload` (JSON) e devolve `<body>.<mac>`. */
function encodeToken(payload: Record<string, unknown>): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Valida assinatura + expiração e devolve o payload, ou `null`. */
function decodeToken<T extends { exp: number }>(
  token: string | undefined,
): T | null {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as T;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Sessão                                                                   */
/* -------------------------------------------------------------------------- */

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

export type TipoUsuario = "ADMIN" | "CORRETOR" | "CORRETOR_INDIVIDUAL";

export interface SessionPayload {
  typ: "session";
  sub: number; // idUsuario
  nome: string;
  email: string;
  tipoUsuario: TipoUsuario;
  empresaId: number | null; // null só para CORRETOR_INDIVIDUAL
  exp: number; // epoch seconds
}

export function createSession(
  user: Omit<SessionPayload, "exp" | "typ">,
): { token: string; maxAge: number } {
  const token = encodeToken({
    typ: "session",
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  return { token, maxAge: SESSION_TTL_SECONDS };
}

export function readSession(token: string | undefined): SessionPayload | null {
  const payload = decodeToken<SessionPayload>(token);
  return payload?.typ === "session" ? payload : null;
}

/* -------------------------------------------------------------------------- */
/*  Cookies — sem dependência externa                                        */
/* -------------------------------------------------------------------------- */

export const SESSION_COOKIE = "corretora_session";

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function setSessionCookie(
  res: ServerResponse,
  token: string,
  maxAge: number,
): void {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; "));
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}
