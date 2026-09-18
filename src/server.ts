import "dotenv/config";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";

import { db } from "./db";
import { emailConfigurado, enviarCodigoLogin } from "./email";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  hashPassword,
  parseCookies,
  readSession,
  setSessionCookie,
  verifyPassword,
  type SessionPayload,
  type TipoUsuario,
} from "./auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");
const PORT = Number(process.env.PORT ?? 3000);

// Fotos gravadas no disco em uploads/ e servidas em /uploads.
const UPLOADS_DIR = path.join(__dirname, "..", "uploads", "imoveis");
const PERFIS_DIR = path.join(__dirname, "..", "uploads", "perfis");
mkdirSync(UPLOADS_DIR, { recursive: true });
mkdirSync(PERFIS_DIR, { recursive: true });

// O cliente já redimensiona/comprime a imagem antes de enviar (lado maior
// <= 1600px e alvo de ~1,8 MB). Este teto é a rede de segurança do servidor.
const FOTO_MAX_BYTES = 2 * 1024 * 1024;
const FOTO_MAX_POR_IMOVEL = 12;

// Hash descartável para nivelar o tempo de resposta quando o e-mail não existe
// (evita enumeração de usuários por timing).
const DUMMY_HASH = hashPassword("::timing-equalizer::");

const app = express();
// A foto vai em base64 (~+33%) no corpo: 2 MB de imagem ≈ 2,8 MB de JSON.
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads"), {
  maxAge: "7d",
  immutable: true,
}));

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* -------------------------------------------------------------------------- */

const normEmail = (v: unknown): string => String(v ?? "").trim().toLowerCase();
const str = (v: unknown): string => String(v ?? "").trim();

async function findUsuarioByEmail(email: string) {
  return db.orm.public.Usuario.where((u) => u.email.eq(email as any)).first();
}

function startSession(res: Response, u: {
  idUsuario: number;
  nome: string;
  email: string;
  tipoUsuario: TipoUsuario;
  empresaId: number | null;
}) {
  const { token, maxAge } = createSession({
    sub: u.idUsuario,
    nome: u.nome,
    email: u.email,
    tipoUsuario: u.tipoUsuario,
    empresaId: u.empresaId ?? null,
  });
  setSessionCookie(res, token, maxAge);
}

/* -------------------------------------------------------------------------- */
/*  Middleware de autenticação                                               */
/* -------------------------------------------------------------------------- */

function loadSession(req: Request, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req);
  req.session = readSession(cookies[SESSION_COOKIE]) ?? undefined;
  next();
}

function requireAuthApi(req: Request, res: Response, next: NextFunction): void {
  if (req.session) return next();
  res.status(401).json({ ok: false, error: "Não autenticado." });
}

function requireAdminApi(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.tipoUsuario === "ADMIN" && req.session.empresaId != null) {
    return next();
  }
  res.status(403).json({ ok: false, error: "Ação restrita à imobiliária." });
}

app.use(loadSession);

/* -------------------------------------------------------------------------- */
/*  Autenticação                                                             */
/* -------------------------------------------------------------------------- */

/* ---- Confirmação de login por e-mail (código de 6 dígitos) --------------- */

const SECRET_2FA =
  process.env.SESSION_SECRET ??
  "dev-only-insecure-secret-troque-no-.env-para-producao";
const CODIGO_TTL_SEG = 10 * 60;
const CODIGO_MAX_TENTATIVAS = 5;

function hashCodigo(codigo: string): string {
  return createHmac("sha256", SECRET_2FA).update(`login:${codigo}`).digest("hex");
}
function codigoConfere(codigo: string, hash: string): boolean {
  const a = Buffer.from(hashCodigo(codigo));
  const b = Buffer.from(String(hash));
  return a.length === b.length && timingSafeEqual(a, b);
}
function novoCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Gera e envia um novo código; mantém no máx. um pendente por usuário.
async function emitirCodigoLogin(usuario: {
  idUsuario: number;
  nome: string;
  email: string;
}): Promise<void> {
  const codigo = novoCodigo();
  const agora = Math.floor(Date.now() / 1000);
  await db.orm.public.LoginCodigo
    .where((c) => c.usuarioId.eq(usuario.idUsuario as any))
    .deleteAndCount();
  await db.orm.public.LoginCodigo.create({
    usuarioId: usuario.idUsuario,
    codigoHash: hashCodigo(codigo),
    expiraEm: agora + CODIGO_TTL_SEG,
    tentativas: 0,
  } as any);
  await enviarCodigoLogin(usuario.email, usuario.nome, codigo);
}

app.post("/api/login", async (req, res) => {
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha ?? "");
  if (!email || !senha) {
    return res.status(400).json({ ok: false, error: "Informe e-mail e senha." });
  }

  try {
    const usuario = await findUsuarioByEmail(email);
    const senhaOk = usuario
      ? verifyPassword(senha, usuario.senha)
      : (verifyPassword(senha, DUMMY_HASH), false);

    if (!usuario || !senhaOk) {
      return res
        .status(401)
        .json({ ok: false, error: "E-mail ou senha inválidos." });
    }

    // Senha ok — não abre a sessão ainda: manda o código por e-mail.
    await emitirCodigoLogin(usuario);
    return res.json({
      ok: true,
      etapa: "codigo",
      email: usuario.email,
      dev: !emailConfigurado,
    });
  } catch (err) {
    console.error("[login]", err);
    return res
      .status(500)
      .json({ ok: false, error: "Não foi possível enviar o código. Tente de novo." });
  }
});

app.post("/api/login/confirmar", async (req, res) => {
  const email = normEmail(req.body?.email);
  const codigo = String(req.body?.codigo ?? "").replace(/\D/g, "");
  if (!email || codigo.length !== 6) {
    return res.status(400).json({ ok: false, error: "Informe o código de 6 dígitos." });
  }

  try {
    const usuario = await findUsuarioByEmail(email);
    const pend = usuario
      ? await db.orm.public.LoginCodigo
          .where((c) => c.usuarioId.eq(usuario.idUsuario as any))
          .first()
      : null;
    const agora = Math.floor(Date.now() / 1000);

    if (!usuario || !pend || pend.expiraEm < agora) {
      return res
        .status(400)
        .json({ ok: false, error: "Código expirado. Faça login de novo." });
    }
    if (pend.tentativas >= CODIGO_MAX_TENTATIVAS) {
      await db.orm.public.LoginCodigo
        .where((c) => c.idCodigo.eq(pend.idCodigo as any))
        .delete();
      return res
        .status(429)
        .json({ ok: false, error: "Muitas tentativas. Faça login de novo." });
    }
    if (!codigoConfere(codigo, pend.codigoHash)) {
      await db.orm.public.LoginCodigo
        .where((c) => c.idCodigo.eq(pend.idCodigo as any))
        .update({ tentativas: pend.tentativas + 1 } as any);
      return res.status(401).json({ ok: false, error: "Código incorreto." });
    }

    await db.orm.public.LoginCodigo
      .where((c) => c.idCodigo.eq(pend.idCodigo as any))
      .delete();
    startSession(res, {
      idUsuario: usuario.idUsuario,
      nome: usuario.nome,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario as TipoUsuario,
      empresaId: usuario.empresaId ?? null,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[login:confirmar]", err);
    return res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

app.post("/api/login/reenviar", async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!email) return res.status(400).json({ ok: false, error: "Informe o e-mail." });
  try {
    const usuario = await findUsuarioByEmail(email);
    const pend = usuario
      ? await db.orm.public.LoginCodigo
          .where((c) => c.usuarioId.eq(usuario.idUsuario as any))
          .first()
      : null;
    if (!usuario || !pend) {
      return res.status(400).json({ ok: false, error: "Faça login novamente." });
    }
    await emitirCodigoLogin(usuario);
    return res.json({ ok: true, dev: !emailConfigurado });
  } catch (err) {
    console.error("[login:reenviar]", err);
    return res.status(500).json({ ok: false, error: "Não foi possível reenviar." });
  }
});

app.post("/api/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

function perfilFotoUrl(arquivo: unknown): string | null {
  return typeof arquivo === "string" && arquivo ? `/uploads/perfis/${arquivo}` : null;
}

app.get("/api/me", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const [usuario, emp] = await Promise.all([
    db.orm.public.Usuario
      .where((u) => u.idUsuario.eq(s.sub as any))
      .select("foto")
      .first(),
    s.empresaId != null
      ? db.orm.public.Empresa
          .where((e) => e.idEmpresa.eq(s.empresaId as any))
          .select("nome")
          .first()
      : Promise.resolve(null),
  ]);
  res.json({
    ok: true,
    usuario: {
      id: s.sub,
      nome: s.nome,
      email: s.email,
      tipoUsuario: s.tipoUsuario,
      empresaId: s.empresaId,
      empresaNome: (emp?.nome as string) ?? null,
      fotoUrl: perfilFotoUrl(usuario?.foto),
    },
  });
});

/* -------------------------------------------------------------------------- */
/*  Perfil do usuário                                                        */
/* -------------------------------------------------------------------------- */

app.get("/api/perfil", requireAuthApi, async (req, res) => {
  const s = req.session!;
  try {
    const u = await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .first();
    if (!u) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });

    let empresaNome: string | null = null;
    if (u.empresaId != null) {
      const emp = await db.orm.public.Empresa
        .where((e) => e.idEmpresa.eq(u.empresaId as any))
        .select("nome")
        .first();
      empresaNome = (emp?.nome as string) ?? null;
    }
    res.json({
      ok: true,
      perfil: {
        id: u.idUsuario,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone ?? "",
        cpf: u.cpf ?? "",
        instagram: u.instagram ?? "",
        tipoUsuario: u.tipoUsuario,
        empresaNome,
        fotoUrl: perfilFotoUrl(u.foto),
      },
    });
  } catch (err) {
    console.error("[perfil:get]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

app.patch("/api/perfil", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const nome = str(req.body?.nome);
  const email = normEmail(req.body?.email);
  if (!nome) return res.status(400).json({ ok: false, error: "Informe o nome." });
  if (!email) return res.status(400).json({ ok: false, error: "Informe o e-mail." });

  try {
    const outro = await db.orm.public.Usuario
      .where((u) => u.email.eq(email as any))
      .select("idUsuario")
      .first();
    if (outro && outro.idUsuario !== s.sub) {
      return res.status(409).json({ ok: false, error: "Esse e-mail já está em uso." });
    }

    await db.orm.public.Usuario
      .where((u) => u.idUsuario.eq(s.sub as any))
      .update({
        nome,
        email,
        telefone: str(req.body?.telefone) || null,
        cpf: str(req.body?.cpf) || null,
        instagram: str(req.body?.instagram) || null,
      } as any);

    // Reemite a sessão para o header/`/api/me` refletirem nome/e-mail novos.
    startSession(res, {
      idUsuario: s.sub,
      nome,
      email,
      tipoUsuario: s.tipoUsuario,
      empresaId: s.empresaId,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[perfil:patch]", err);
    return res.status(500).json({ ok: false, error: "Erro ao salvar o perfil." });
  }
});

app.patch("/api/perfil/senha", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const atual = String(req.body?.atual ?? "");
  const nova = String(req.body?.nova ?? "");
  if (nova.length < 6) {
    return res
      .status(400)
      .json({ ok: false, error: "A nova senha precisa ter pelo menos 6 caracteres." });
  }
  try {
    const u = await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .select("senha")
      .first();
    if (!u || !verifyPassword(atual, u.senha)) {
      return res.status(403).json({ ok: false, error: "Senha atual incorreta." });
    }
    await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .update({ senha: hashPassword(nova) } as any);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[perfil:senha]", err);
    return res.status(500).json({ ok: false, error: "Erro ao trocar a senha." });
  }
});

app.post("/api/perfil/foto", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const parsed = parseDataUrl(req.body?.dataUrl);
  if ("error" in parsed) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  try {
    const u = await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .select("foto")
      .first();

    const arquivo = `${s.sub}-${randomBytes(8).toString("hex")}.${parsed.ext}`;
    await writeFile(path.join(PERFIS_DIR, arquivo), parsed.buf);
    await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .update({ foto: arquivo } as any);

    if (u?.foto && u.foto !== arquivo) {
      await unlink(path.join(PERFIS_DIR, u.foto as string)).catch(() => {});
    }
    return res.status(201).json({ ok: true, fotoUrl: `/uploads/perfis/${arquivo}` });
  } catch (err) {
    console.error("[perfil:foto:post]", err);
    return res.status(500).json({ ok: false, error: "Erro ao salvar a foto." });
  }
});

app.delete("/api/perfil/foto", requireAuthApi, async (req, res) => {
  const s = req.session!;
  try {
    const u = await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .select("foto")
      .first();
    await db.orm.public.Usuario
      .where((x) => x.idUsuario.eq(s.sub as any))
      .update({ foto: null } as any);
    if (u?.foto) {
      await unlink(path.join(PERFIS_DIR, u.foto as string)).catch(() => {});
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[perfil:foto:delete]", err);
    return res.status(500).json({ ok: false, error: "Erro ao remover a foto." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Cadastro de usuário                                                      */
/* -------------------------------------------------------------------------- */

// Cadastro público = corretor autônomo (sem vínculo com imobiliária).
app.post("/api/registrar", async (req, res) => {
  const nome = str(req.body?.nome);
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha ?? "");

  if (!nome || !email || senha.length < 6) {
    return res.status(400).json({
      ok: false,
      error: "Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.",
    });
  }

  try {
    if (await db.orm.public.Usuario.where((u) => u.email.eq(email as any)).first()) {
      return res
        .status(409)
        .json({ ok: false, error: "Já existe uma conta com esse e-mail." });
    }

    const usuario = await db.orm.public.Usuario.create({
      nome,
      email,
      senha: hashPassword(senha),
      cpf: str(req.body?.cpf) || null,
      telefone: str(req.body?.telefone) || null,
      tipoUsuario: "CORRETOR_INDIVIDUAL",
      empresaId: null,
    } as any);

    startSession(res, {
      idUsuario: usuario.idUsuario,
      nome: usuario.nome,
      email: usuario.email,
      tipoUsuario: "CORRETOR_INDIVIDUAL",
      empresaId: null,
    });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[registrar]", err);
    return res.status(500).json({ ok: false, error: "Erro ao criar a conta." });
  }
});

// Cadastro da imobiliária: cria a empresa + o usuário ADMIN dono dela.
app.post("/api/registrar-imobiliaria", async (req, res) => {
  const nome = str(req.body?.nome);
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha ?? "");
  const empresaNome = str(req.body?.empresaNome);
  const cnpj = str(req.body?.cnpj);
  const empresaTelefone = str(req.body?.empresaTelefone) || null;
  const empresaEmail = normEmail(req.body?.empresaEmail) || null;

  if (!nome || !email || senha.length < 6 || !empresaNome || !cnpj) {
    return res.status(400).json({
      ok: false,
      error:
        "Preencha o nome e o CNPJ da imobiliária, seu nome, e-mail e uma senha de pelo menos 6 caracteres.",
    });
  }

  try {
    if (await db.orm.public.Usuario.where((u) => u.email.eq(email as any)).first()) {
      return res
        .status(409)
        .json({ ok: false, error: "Já existe uma conta com esse e-mail." });
    }
    if (await db.orm.public.Empresa.where((e) => e.cnpj.eq(cnpj as any)).first()) {
      return res
        .status(409)
        .json({ ok: false, error: "Já existe uma imobiliária com esse CNPJ." });
    }

    const usuario = await db.transaction(async (tx: any) => {
      const empresa = await tx.orm.public.Empresa.create({
        nome: empresaNome,
        cnpj,
        telefone: empresaTelefone,
        email: empresaEmail,
      } as any);
      return tx.orm.public.Usuario.create({
        nome,
        email,
        senha: hashPassword(senha),
        tipoUsuario: "ADMIN",
        empresaId: empresa.idEmpresa,
      } as any);
    });

    startSession(res, {
      idUsuario: usuario.idUsuario,
      nome: usuario.nome,
      email: usuario.email,
      tipoUsuario: "ADMIN",
      empresaId: usuario.empresaId ?? null,
    });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[registrar-imobiliaria]", err);
    return res
      .status(500)
      .json({ ok: false, error: "Erro ao criar a imobiliária." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Corretores (só a imobiliária/ADMIN gerencia)                             */
/* -------------------------------------------------------------------------- */

app.get("/api/corretores", requireAuthApi, requireAdminApi, async (req, res) => {
  const s = req.session!;
  try {
    const usuarios = await db.orm.public.Usuario
      .where((u) => u.empresaId.eq(s.empresaId as any))
      .select("idUsuario", "nome", "email", "telefone", "tipoUsuario")
      .orderBy((u) => u.nome.asc())
      .all();
    res.json({
      ok: true,
      corretores: usuarios
        .filter((u: any) => u.tipoUsuario === "CORRETOR")
        .map((u: any) => ({
          id: u.idUsuario,
          nome: u.nome,
          email: u.email,
          telefone: u.telefone,
        })),
    });
  } catch (err) {
    console.error("[corretores:list]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

app.post("/api/corretores", requireAuthApi, requireAdminApi, async (req, res) => {
  const s = req.session!;
  const nome = str(req.body?.nome);
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha ?? "");

  if (!nome || !email || senha.length < 6) {
    return res.status(400).json({
      ok: false,
      error: "Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.",
    });
  }

  try {
    if (await db.orm.public.Usuario.where((u) => u.email.eq(email as any)).first()) {
      return res
        .status(409)
        .json({ ok: false, error: "Já existe uma conta com esse e-mail." });
    }

    const corretor = await db.orm.public.Usuario.create({
      nome,
      email,
      senha: hashPassword(senha),
      cpf: str(req.body?.cpf) || null,
      telefone: str(req.body?.telefone) || null,
      instagram: str(req.body?.instagram) || null,
      tipoUsuario: "CORRETOR",
      empresaId: s.empresaId,
    } as any);

    return res.status(201).json({ ok: true, id: corretor.idUsuario });
  } catch (err) {
    console.error("[corretores:create]", err);
    return res
      .status(500)
      .json({ ok: false, error: "Erro ao cadastrar o corretor." });
  }
});

// Carrega um corretor garantindo que ele pertence à imobiliária do ADMIN.
async function loadCorretorDaEmpresa(
  id: number,
  s: SessionPayload,
): Promise<{ corretor?: any; status?: number; error?: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    return { status: 400, error: "Corretor inválido." };
  }
  const corretor = await db.orm.public.Usuario
    .where((u) => u.idUsuario.eq(id as any))
    .first();
  if (
    !corretor ||
    corretor.tipoUsuario !== "CORRETOR" ||
    (corretor.empresaId ?? null) !== s.empresaId
  ) {
    return { status: 404, error: "Corretor não encontrado nesta imobiliária." };
  }
  return { corretor };
}

app.patch("/api/corretores/:id", requireAuthApi, requireAdminApi, async (req, res) => {
  const s = req.session!;
  const found = await loadCorretorDaEmpresa(Number(req.params.id), s);
  if (!found.corretor) {
    return res.status(found.status!).json({ ok: false, error: found.error });
  }

  const nome = str(req.body?.nome);
  if (!nome) return res.status(400).json({ ok: false, error: "Informe o nome." });

  try {
    await db.orm.public.Usuario
      .where((u) => u.idUsuario.eq(found.corretor.idUsuario as any))
      .update({
        nome,
        telefone: str(req.body?.telefone) || null,
        cpf: str(req.body?.cpf) || null,
      } as any);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[corretores:update]", err);
    return res
      .status(500)
      .json({ ok: false, error: "Erro ao atualizar o corretor." });
  }
});

app.delete("/api/corretores/:id", requireAuthApi, requireAdminApi, async (req, res) => {
  const s = req.session!;
  const found = await loadCorretorDaEmpresa(Number(req.params.id), s);
  if (!found.corretor) {
    return res.status(found.status!).json({ ok: false, error: found.error });
  }
  const corretorId: number = found.corretor.idUsuario;

  try {
    await db.transaction(async (tx: any) => {
      // Imóveis do corretor voltam para o pool da imobiliária (empresa mantida).
      await tx.orm.public.Imovel
        .where((i: any) => i.usuarioId.eq(corretorId as any))
        .updateAndCount({ usuarioId: null } as any);
      // "criado por" não pode referenciar um usuário removido.
      await tx.orm.public.Imovel
        .where((i: any) => i.criadoPorId.eq(corretorId as any))
        .updateAndCount({ criadoPorId: null } as any);
      await tx.orm.public.Usuario
        .where((u: any) => u.idUsuario.eq(corretorId as any))
        .delete();
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[corretores:delete]", err);
    return res
      .status(500)
      .json({ ok: false, error: "Erro ao excluir o corretor." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Bairros e características (para o formulário de imóvel)                    */
/* -------------------------------------------------------------------------- */

app.get("/api/bairros", requireAuthApi, async (_req, res) => {
  try {
    const bairros = await db.orm.public.Bairro
      .select("idBairro", "nome")
      .orderBy((b) => b.nome.asc())
      .all();
    res.json({ ok: true, bairros });
  } catch (err) {
    console.error("[bairros]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

app.get("/api/caracteristicas", requireAuthApi, async (_req, res) => {
  try {
    const caracteristicas = await db.orm.public.Caracteristica
      .select("idCaracteristica", "descricao")
      .orderBy((c) => c.idCaracteristica.asc())
      .all();
    res.json({ ok: true, caracteristicas });
  } catch (err) {
    console.error("[caracteristicas]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Imóveis                                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_IMOVEL_PADRAO = "Disponível";

interface ImovelInput {
  valorNum: number;
  bairroId: number;
  cliente: string | null;
  telefone: string | null;
  referencia: string | null;
  rua: string | null;
  numero: string | null;
  descricao: string | null;
  status: string;
  caracs: { caracteristicaId: number; quantidade: number }[];
}

function parseImovelBody(body: any): { data?: ImovelInput; error?: string } {
  const valorNum = Number(
    String(body?.valor ?? "").replace(/\./g, "").replace(",", "."),
  );
  const bairroId = Number(body?.bairroId);
  if (!Number.isFinite(valorNum) || valorNum <= 0) {
    return { error: "Informe um valor válido." };
  }
  if (!Number.isInteger(bairroId) || bairroId <= 0) {
    return { error: "Selecione o bairro." };
  }
  const caracs = Array.isArray(body?.caracteristicas)
    ? body.caracteristicas
        .map((c: any) => ({
          caracteristicaId: Number(c?.caracteristicaId),
          quantidade: Math.max(1, Math.trunc(Number(c?.quantidade) || 1)),
        }))
        .filter(
          (c: any) => Number.isInteger(c.caracteristicaId) && c.caracteristicaId > 0,
        )
    : [];
  return {
    data: {
      valorNum,
      bairroId,
      cliente: str(body?.cliente) || null,
      telefone: str(body?.telefone) || null,
      referencia: str(body?.referencia) || null,
      // rua/número: guardados para uso interno (ex.: visitas), NUNCA expostos na vitrine pública.
      rua: str(body?.rua).slice(0, 150) || null,
      numero: str(body?.numero).slice(0, 20) || null,
      descricao: String(body?.descricao ?? "").trim().slice(0, 2000) || null,
      status: str(body?.status) || STATUS_IMOVEL_PADRAO,
      caracs,
    },
  };
}

// Resolve dono/empresa do imóvel conforme o papel da sessão. O ADMIN pode
// atribuir o imóvel a um corretor da imobiliária, a si mesmo (ele também atua
// como corretor) ou deixá-lo no pool (body.corretorId vazio).
async function resolveDonoImovel(
  s: SessionPayload,
  body: any,
): Promise<{ usuarioId: number | null; empresaId: number | null; error?: string }> {
  if (s.tipoUsuario === "CORRETOR_INDIVIDUAL") {
    return { usuarioId: s.sub, empresaId: null };
  }
  if (s.tipoUsuario === "CORRETOR") {
    return { usuarioId: s.sub, empresaId: s.empresaId };
  }
  const corretorId = Number(body?.corretorId);
  if (Number.isInteger(corretorId) && corretorId > 0) {
    // O próprio ADMIN pode ser o responsável.
    if (corretorId === s.sub) {
      return { usuarioId: s.sub, empresaId: s.empresaId };
    }
    const corretor = await db.orm.public.Usuario
      .where((u) => u.idUsuario.eq(corretorId as any))
      .first();
    if (
      !corretor ||
      corretor.tipoUsuario !== "CORRETOR" ||
      (corretor.empresaId ?? null) !== s.empresaId
    ) {
      return {
        usuarioId: null,
        empresaId: null,
        error: "Corretor inválido para esta imobiliária.",
      };
    }
    return { usuarioId: corretorId, empresaId: s.empresaId };
  }
  return { usuarioId: null, empresaId: s.empresaId };
}

// Carrega o imóvel garantindo que a sessão pode alterá-lo (dono ou ADMIN da
// mesma imobiliária).
async function loadImovelParaEscrita(
  id: number,
  s: SessionPayload,
): Promise<{ imovel?: any; status?: number; error?: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    return { status: 400, error: "Imóvel inválido." };
  }
  const imovel = await db.orm.public.Imovel
    .where((i) => i.idImovel.eq(id as any))
    .first();
  if (!imovel) return { status: 404, error: "Imóvel não encontrado." };

  const podeMexer =
    imovel.usuarioId === s.sub ||
    (s.tipoUsuario === "ADMIN" && (imovel.empresaId ?? null) === s.empresaId);
  if (!podeMexer) {
    return { status: 403, error: "Sem permissão sobre este imóvel." };
  }
  return { imovel };
}

const FOTO_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseDataUrl(v: unknown): { buf: Buffer; ext: string } | { error: string } {
  if (typeof v !== "string") return { error: "Imagem ausente." };
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) return { error: "Formato inválido — use JPEG, PNG ou WebP." };
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0) return { error: "Imagem vazia." };
  if (buf.length > FOTO_MAX_BYTES) {
    return { error: `Imagem muito grande (máx. ${Math.round(FOTO_MAX_BYTES / 1048576)} MB).` };
  }
  return { buf, ext: FOTO_MIME_EXT[m[1]] };
}

async function trocarCaracteristicas(
  tx: any,
  imovelId: number,
  caracs: { caracteristicaId: number; quantidade: number }[],
): Promise<void> {
  // deleteAndCount() apaga TODAS as linhas do filtro; delete() apagaria só a 1ª.
  await tx.orm.public.ImovelCaracteristica
    .where((c: any) => c.imovelId.eq(imovelId as any))
    .deleteAndCount();
  for (const c of caracs) {
    await tx.orm.public.ImovelCaracteristica.create({
      imovelId,
      caracteristicaId: c.caracteristicaId,
      quantidade: c.quantidade,
    } as any);
  }
}

app.get("/api/imoveis", requireAuthApi, async (req, res) => {
  const s = req.session!;
  // ADMIN vê todos os imóveis da imobiliária (pool + dos corretores);
  // corretor (vinculado ou autônomo) vê só os seus.
  const filtro =
    s.tipoUsuario === "ADMIN"
      ? (i: any) => i.empresaId.eq(s.empresaId as any)
      : (i: any) => i.usuarioId.eq(s.sub as any);
  try {
    const imoveis = await db.orm.public.Imovel
      .where(filtro)
      .include("bairro", (b) => b.select("idBairro", "nome"))
      .include("usuario", (u) => u.select("idUsuario", "nome"))
      .include("fotos", (f) =>
        f.select("idFoto", "arquivo", "largura", "altura", "ordem"),
      )
      .include("caracteristicas", (c) =>
        c.include("caracteristica", (k) =>
          k.select("idCaracteristica", "descricao"),
        ),
      )
      .orderBy((i) => i.idImovel.desc())
      .all();

    res.json({
      ok: true,
      imoveis: imoveis.map((i: any) => ({
        id: i.idImovel,
        valor: i.valor,
        cliente: i.cliente,
        telefone: i.telefone,
        referencia: i.referencia,
        rua: i.rua,
        numero: i.numero,
        descricao: i.descricao ?? "",
        status: i.status,
        bairroId: i.bairroId ?? null,
        bairro: i.bairro?.nome ?? null,
        corretor: i.usuario?.nome ?? null,
        corretorId: i.usuarioId ?? null,
        podeEditar:
          i.usuarioId === s.sub ||
          (s.tipoUsuario === "ADMIN" && (i.empresaId ?? null) === s.empresaId),
        caracteristicas: (i.caracteristicas ?? []).map((c: any) => ({
          caracteristicaId: c.caracteristica?.idCaracteristica ?? c.caracteristicaId,
          descricao: c.caracteristica?.descricao ?? "",
          quantidade: c.quantidade,
        })),
        fotos: (i.fotos ?? [])
          .slice()
          .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((f: any) => ({
            id: f.idFoto,
            url: `/uploads/imoveis/${f.arquivo}`,
            largura: f.largura,
            altura: f.altura,
          })),
      })),
    });
  } catch (err) {
    console.error("[imoveis:list]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Vitrine pública (sem login, sem dados do corretor/cliente)               */
/* -------------------------------------------------------------------------- */

const STATUS_PUBLICO = ["Disponível", "Reservado"];

function imovelPublico(i: any) {
  // Só bairro — nunca rua/número/referência (endereço fica só no painel interno).
  return {
    id: i.idImovel,
    valor: i.valor,
    status: i.status,
    bairro: i.bairro?.nome ?? null,
    descricao: i.descricao ?? "",
    caracteristicas: (i.caracteristicas ?? [])
      .map((c: any) => ({
        descricao: c.caracteristica?.descricao ?? "",
        quantidade: c.quantidade,
      }))
      .filter((c: any) => c.descricao),
    fotos: (i.fotos ?? [])
      .slice()
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((f: any) => ({
        url: `/uploads/imoveis/${f.arquivo}`,
        largura: f.largura,
        altura: f.altura,
      })),
  };
}

app.get("/api/publico/imoveis", async (_req, res) => {
  try {
    const imoveis = await db.orm.public.Imovel
      .include("bairro", (b) => b.select("idBairro", "nome"))
      .include("fotos", (f) => f.select("arquivo", "largura", "altura", "ordem"))
      .include("caracteristicas", (c) =>
        c.include("caracteristica", (k) => k.select("descricao")),
      )
      .orderBy((i) => i.idImovel.desc())
      .all();

    const lista = imoveis
      .filter((i: any) => STATUS_PUBLICO.includes(i.status))
      .slice(0, 120)
      .map(imovelPublico);
    res.json({ ok: true, imoveis: lista });
  } catch (err) {
    console.error("[publico:list]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

app.get("/api/publico/imoveis/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: "Anúncio inválido." });
  }
  try {
    const i = await db.orm.public.Imovel
      .where((x) => x.idImovel.eq(id as any))
      .include("bairro", (b) => b.select("idBairro", "nome"))
      .include("fotos", (f) => f.select("arquivo", "largura", "altura", "ordem"))
      .include("caracteristicas", (c) =>
        c.include("caracteristica", (k) => k.select("descricao")),
      )
      .first();
    if (!i) return res.status(404).json({ ok: false, error: "Anúncio não encontrado." });
    res.json({ ok: true, imovel: imovelPublico(i) });
  } catch (err) {
    console.error("[publico:detalhe]", err);
    res.status(500).json({ ok: false, error: "Erro interno." });
  }
});

app.post("/api/imoveis", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const parsed = parseImovelBody(req.body);
  if (!parsed.data) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  const d = parsed.data;

  try {
    const bairro = await db.orm.public.Bairro
      .where((b) => b.idBairro.eq(d.bairroId as any))
      .first();
    if (!bairro) {
      return res.status(400).json({ ok: false, error: "Bairro inexistente." });
    }

    const dono = await resolveDonoImovel(s, req.body);
    if (dono.error) return res.status(400).json({ ok: false, error: dono.error });

    const imovel = await db.transaction(async (tx: any) => {
      const im = await tx.orm.public.Imovel.create({
        valor: d.valorNum,
        cliente: d.cliente,
        telefone: d.telefone,
        referencia: d.referencia,
        rua: d.rua,
        numero: d.numero,
        descricao: d.descricao,
        status: d.status,
        usuarioId: dono.usuarioId,
        empresaId: dono.empresaId,
        criadoPorId: s.sub,
        bairroId: d.bairroId,
      } as any);
      await trocarCaracteristicas(tx, im.idImovel, d.caracs);
      return im;
    });

    return res.status(201).json({ ok: true, id: imovel.idImovel });
  } catch (err) {
    console.error("[imoveis:create]", err);
    return res.status(500).json({ ok: false, error: "Erro ao cadastrar o imóvel." });
  }
});

app.put("/api/imoveis/:id", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const found = await loadImovelParaEscrita(Number(req.params.id), s);
  if (!found.imovel) {
    return res.status(found.status!).json({ ok: false, error: found.error });
  }
  const imovelId: number = found.imovel.idImovel;

  const parsed = parseImovelBody(req.body);
  if (!parsed.data) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  const d = parsed.data;

  try {
    const bairro = await db.orm.public.Bairro
      .where((b) => b.idBairro.eq(d.bairroId as any))
      .first();
    if (!bairro) {
      return res.status(400).json({ ok: false, error: "Bairro inexistente." });
    }

    // Só o ADMIN reatribui a posse; os demais mantêm dono/empresa originais.
    let usuarioId: number | null = found.imovel.usuarioId ?? null;
    let empresaId: number | null = found.imovel.empresaId ?? null;
    if (s.tipoUsuario === "ADMIN") {
      const dono = await resolveDonoImovel(s, req.body);
      if (dono.error) return res.status(400).json({ ok: false, error: dono.error });
      usuarioId = dono.usuarioId;
      empresaId = dono.empresaId;
    }

    await db.transaction(async (tx: any) => {
      await tx.orm.public.Imovel
        .where((i: any) => i.idImovel.eq(imovelId as any))
        .update({
          valor: d.valorNum,
          cliente: d.cliente,
          telefone: d.telefone,
          referencia: d.referencia,
          rua: d.rua,
          numero: d.numero,
          descricao: d.descricao,
          status: d.status,
          usuarioId,
          empresaId,
          bairroId: d.bairroId,
        } as any);
      await trocarCaracteristicas(tx, imovelId, d.caracs);
    });

    return res.json({ ok: true, id: imovelId });
  } catch (err) {
    console.error("[imoveis:update]", err);
    return res.status(500).json({ ok: false, error: "Erro ao atualizar o imóvel." });
  }
});

app.delete("/api/imoveis/:id", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const found = await loadImovelParaEscrita(Number(req.params.id), s);
  if (!found.imovel) {
    return res.status(found.status!).json({ ok: false, error: found.error });
  }
  const imovelId: number = found.imovel.idImovel;

  try {
    const fotos = await db.orm.public.ImovelFoto
      .where((f: any) => f.imovelId.eq(imovelId as any))
      .select("arquivo")
      .all();

    await db.transaction(async (tx: any) => {
      await tx.orm.public.ImovelFoto
        .where((f: any) => f.imovelId.eq(imovelId as any))
        .deleteAndCount();
      await tx.orm.public.ImovelCaracteristica
        .where((c: any) => c.imovelId.eq(imovelId as any))
        .deleteAndCount();
      await tx.orm.public.Imovel
        .where((i: any) => i.idImovel.eq(imovelId as any))
        .delete();
    });

    await Promise.all(
      fotos.map((f: any) =>
        unlink(path.join(UPLOADS_DIR, f.arquivo)).catch(() => {}),
      ),
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("[imoveis:delete]", err);
    return res.status(500).json({ ok: false, error: "Erro ao excluir o imóvel." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Fotos do imóvel                                                          */
/* -------------------------------------------------------------------------- */

// O cliente envia a imagem já redimensionada (lado maior <= 1600px) como data
// URL base64. Aqui só validamos, limitamos e gravamos no disco.
app.post("/api/imoveis/:id/fotos", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const found = await loadImovelParaEscrita(Number(req.params.id), s);
  if (!found.imovel) {
    return res.status(found.status!).json({ ok: false, error: found.error });
  }
  const imovelId: number = found.imovel.idImovel;

  const parsed = parseDataUrl(req.body?.dataUrl);
  if ("error" in parsed) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  const largura = Math.max(0, Math.trunc(Number(req.body?.largura) || 0));
  const altura = Math.max(0, Math.trunc(Number(req.body?.altura) || 0));

  try {
    const atuais = await db.orm.public.ImovelFoto
      .where((f: any) => f.imovelId.eq(imovelId as any))
      .select("ordem")
      .all();
    if (atuais.length >= FOTO_MAX_POR_IMOVEL) {
      return res
        .status(409)
        .json({ ok: false, error: `Máximo de ${FOTO_MAX_POR_IMOVEL} fotos por imóvel.` });
    }
    const proximaOrdem =
      atuais.reduce((mx: number, f: any) => Math.max(mx, f.ordem ?? 0), -1) + 1;

    const arquivo = `${imovelId}-${randomBytes(8).toString("hex")}.${parsed.ext}`;
    await writeFile(path.join(UPLOADS_DIR, arquivo), parsed.buf);

    const foto = await db.orm.public.ImovelFoto.create({
      imovelId,
      arquivo,
      largura,
      altura,
      bytes: parsed.buf.length,
      ordem: proximaOrdem,
    } as any);

    return res.status(201).json({
      ok: true,
      foto: {
        id: foto.idFoto,
        url: `/uploads/imoveis/${arquivo}`,
        largura,
        altura,
      },
    });
  } catch (err) {
    console.error("[imoveis:foto:create]", err);
    return res.status(500).json({ ok: false, error: "Erro ao salvar a foto." });
  }
});

app.delete("/api/imoveis/:id/fotos/:fotoId", requireAuthApi, async (req, res) => {
  const s = req.session!;
  const found = await loadImovelParaEscrita(Number(req.params.id), s);
  if (!found.imovel) {
    return res.status(found.status!).json({ ok: false, error: found.error });
  }
  const imovelId: number = found.imovel.idImovel;
  const fotoId = Number(req.params.fotoId);
  if (!Number.isInteger(fotoId) || fotoId <= 0) {
    return res.status(400).json({ ok: false, error: "Foto inválida." });
  }

  try {
    const foto = await db.orm.public.ImovelFoto
      .where((f: any) => f.idFoto.eq(fotoId as any))
      .first();
    if (!foto || foto.imovelId !== imovelId) {
      return res.status(404).json({ ok: false, error: "Foto não encontrada." });
    }
    await db.orm.public.ImovelFoto
      .where((f: any) => f.idFoto.eq(fotoId as any))
      .delete();
    await unlink(path.join(UPLOADS_DIR, foto.arquivo)).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error("[imoveis:foto:delete]", err);
    return res.status(500).json({ ok: false, error: "Erro ao excluir a foto." });
  }
});

/* -------------------------------------------------------------------------- */
/*  Front-end React (client/dist)                                            */
/*  Em dev use `npm run dev` — o Vite serve a :5173 com proxy pra /api.      */
/*  Em produção (`npm run build` + `npm start`) o Express serve o bundle.    */
/* -------------------------------------------------------------------------- */

if (existsSync(path.join(CLIENT_DIST, "index.html"))) {
  app.use(express.static(CLIENT_DIST));
  // Fallback SPA: tudo que não for /api/* devolve o index.html.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
} else {
  console.log("client/dist não encontrado — rode `npm run build` para servir o front pelo Express.");
}

app.listen(PORT, () => {
  console.log(`API no ar: http://localhost:${PORT}`);
});
