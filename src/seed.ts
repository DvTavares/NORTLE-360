import "dotenv/config";
import { db } from "./db";
import { hashPassword } from "./auth";

/**
 * Popula dados de base + um dono de teste.
 * Rode com:  npm run seed   (idempotente — pode rodar de novo)
 *
 * Login de teste:  corretor@demo.com.br  /  senha123
 */

const BAIRROS = [
  "Centro",
  "Boa Viagem",
  "Espinheiro",
  "Graças",
  "Casa Forte",
  "Aflitos",
  "Parnamirim",
  "Madalena",
  "Torre",
  "Pina",
  "Rosarinho",
  "Tamarineira",
  "Setúbal",
  "Candeias",
  "Piedade",
];

// Tudo vira linha em `caracteristicas`. O formulário decide como exibir:
// TIPOS -> escolha única | EXTRAS -> caixa de marcar | resto -> quantidade.
const CARACTERISTICAS = [
  "Casa",
  "Apartamento",
  "Cobertura",
  "Kitnet",
  "Terreno",
  "Sala comercial",
  "Quartos",
  "Suítes",
  "Banheiros",
  "Vagas de garagem",
  "Salas",
  "Piscina",
  "Churrasqueira",
  "Varanda",
  "Mobiliado",
  "Elevador",
  "Portaria 24h",
  "Área de serviço",
];

async function ensureBairros() {
  const existentes = new Set(
    (await db.orm.public.Bairro.select("nome").all()).map((b: any) =>
      String(b.nome).toLowerCase(),
    ),
  );
  let novos = 0;
  for (const nome of BAIRROS) {
    if (existentes.has(nome.toLowerCase())) continue;
    await db.orm.public.Bairro.create({ nome } as any);
    novos++;
  }
  console.log(`bairros: ${novos} novo(s), ${BAIRROS.length - novos} já existia(m)`);
}

async function ensureCaracteristicas() {
  const existentes = new Set(
    (await db.orm.public.Caracteristica.select("descricao").all()).map((c: any) =>
      String(c.descricao).toLowerCase(),
    ),
  );
  let novos = 0;
  for (const descricao of CARACTERISTICAS) {
    if (existentes.has(descricao.toLowerCase())) continue;
    await db.orm.public.Caracteristica.create({ descricao } as any);
    novos++;
  }
  console.log(
    `caracteristicas: ${novos} nova(s), ${CARACTERISTICAS.length - novos} já existia(m)`,
  );
}

const IMOBILIARIA_DEMO = { cnpj: "00.000.000/0001-00", nome: "Imobiliária Demo" };
const SENHA_DEMO = "senha123";

async function ensureImobiliariaDemo(): Promise<number> {
  let empresa = await db.orm.public.Empresa
    .where((e) => e.cnpj.eq(IMOBILIARIA_DEMO.cnpj as any))
    .first();
  if (!empresa) {
    empresa = await db.orm.public.Empresa.create({
      nome: IMOBILIARIA_DEMO.nome,
      cnpj: IMOBILIARIA_DEMO.cnpj,
    } as any);
    console.log(`imobiliária demo: criada (#${empresa.idEmpresa})`);
  } else {
    console.log(`imobiliária demo: já existe (#${empresa.idEmpresa})`);
  }
  return empresa.idEmpresa;
}

async function ensureUsuario(opts: {
  nome: string;
  email: string;
  tipoUsuario: "ADMIN" | "CORRETOR" | "CORRETOR_INDIVIDUAL";
  empresaId: number | null;
}): Promise<number> {
  const existente = await db.orm.public.Usuario
    .where((u) => u.email.eq(opts.email as any))
    .first();
  if (existente) {
    console.log(`usuário ${opts.email}: já existe (#${existente.idUsuario})`);
    return existente.idUsuario;
  }
  const u = await db.orm.public.Usuario.create({
    nome: opts.nome,
    email: opts.email,
    senha: hashPassword(SENHA_DEMO),
    tipoUsuario: opts.tipoUsuario,
    empresaId: opts.empresaId,
  } as any);
  console.log(
    `usuário ${opts.email}: criado (#${u.idUsuario}) — ${opts.tipoUsuario} / ${SENHA_DEMO}`,
  );
  return u.idUsuario;
}

// Imóveis de exemplo — só cria se a imobiliária demo ainda não tiver nenhum,
// para não duplicar a cada `npm run seed`.
async function ensureImoveisDemo(ctx: {
  empresaId: number;
  adminId: number;
  corretorId: number;
  autonomoId: number;
}) {
  const jaTem = await db.orm.public.Imovel
    .where((i) => i.empresaId.eq(ctx.empresaId as any))
    .select("idImovel")
    .first();
  if (jaTem) {
    console.log("imóveis demo: imobiliária demo já tem imóveis, pulando");
    return;
  }

  const bairros = await db.orm.public.Bairro.select("idBairro", "nome").all();
  const caracs = await db.orm.public.Caracteristica.select("idCaracteristica", "descricao").all();
  const bId = (nome: string) =>
    bairros.find((b: any) => b.nome === nome)?.idBairro ?? bairros[0]?.idBairro;
  const cId = (desc: string) =>
    caracs.find((c: any) => c.descricao === desc)?.idCaracteristica;

  const amostra = [
    {
      valor: 890000, status: "Disponível", bairro: "Boa Viagem",
      cliente: "Família Andrade", referencia: "Ed. Vista Mar, ap. 1201",
      descricao: "Apartamento de frente para o mar, andar alto, nascente. Sala ampla em dois ambientes, varanda com churrasqueira, 3 quartos sendo 1 suíte, 2 vagas cobertas. Condomínio com piscina, academia e portaria 24h.",
      usuarioId: ctx.corretorId, empresaId: ctx.empresaId, criadoPorId: ctx.corretorId,
      caracs: [["Apartamento", 1], ["Quartos", 3], ["Suítes", 1], ["Vagas de garagem", 2], ["Piscina", 1], ["Varanda", 1]],
    },
    {
      valor: 1650000, status: "Reservado", bairro: "Casa Forte",
      cliente: "João Meireles", referencia: "Rua do Sossego, casa 44",
      descricao: "Casa em rua tranquila e arborizada. 4 quartos, 2 suítes, 4 banheiros, quintal com churrasqueira e espaço gourmet. Garagem para 3 carros. Documentação em ordem, aceita financiamento.",
      usuarioId: null, empresaId: ctx.empresaId, criadoPorId: ctx.adminId,
      caracs: [["Casa", 1], ["Quartos", 4], ["Suítes", 2], ["Banheiros", 4], ["Vagas de garagem", 3], ["Churrasqueira", 1]],
    },
    {
      valor: 420000, status: "Vendido", bairro: "Espinheiro",
      cliente: "Marina Lopes", referencia: "Ed. Aurora, ap. 302",
      descricao: "Apartamento reformado, 2 quartos, cozinha planejada, 1 vaga. Prédio com elevador e portaria.",
      usuarioId: ctx.corretorId, empresaId: ctx.empresaId, criadoPorId: ctx.adminId,
      caracs: [["Apartamento", 1], ["Quartos", 2], ["Vagas de garagem", 1], ["Elevador", 1]],
    },
    {
      valor: 3200, status: "Alugado", bairro: "Graças",
      cliente: "Carlos Nunes", referencia: "Kitnet mobiliada, R. das Flores 10",
      descricao: "Kitnet mobiliada e equipada, ideal para quem trabalha na região. Portaria 24h, água e gás inclusos no condomínio.",
      usuarioId: null, empresaId: ctx.empresaId, criadoPorId: ctx.adminId,
      caracs: [["Kitnet", 1], ["Mobiliado", 1], ["Portaria 24h", 1]],
    },
    {
      valor: 275000, status: "Disponível", bairro: "Torre",
      cliente: "Espólio Beatriz", referencia: "Terreno 12x30, esquina",
      descricao: "Terreno de esquina, 12x30 (360 m²), plano e murado. Ótimo para construção residencial ou comercial. Toda a infraestrutura na rua.",
      usuarioId: ctx.autonomoId, empresaId: null, criadoPorId: ctx.autonomoId,
      caracs: [["Terreno", 1]],
    },
  ];

  let n = 0;
  for (const im of amostra) {
    const criado = await db.orm.public.Imovel.create({
      valor: im.valor,
      status: im.status,
      cliente: im.cliente,
      referencia: im.referencia,
      descricao: im.descricao,
      bairroId: bId(im.bairro),
      usuarioId: im.usuarioId,
      empresaId: im.empresaId,
      criadoPorId: im.criadoPorId,
    } as any);
    for (const [desc, qtd] of im.caracs as [string, number][]) {
      const caracteristicaId = cId(desc);
      if (!caracteristicaId) continue;
      await db.orm.public.ImovelCaracteristica.create({
        imovelId: criado.idImovel,
        caracteristicaId,
        quantidade: qtd,
      } as any);
    }
    n++;
  }
  console.log(`imóveis demo: ${n} criado(s)`);
}

async function main() {
  await ensureBairros();
  await ensureCaracteristicas();
  const empresaId = await ensureImobiliariaDemo();
  const adminId = await ensureUsuario({
    nome: "Imobiliária Demo — Admin",
    email: "admin@demo.com.br",
    tipoUsuario: "ADMIN",
    empresaId,
  });
  const corretorId = await ensureUsuario({
    nome: "Corretor Demo",
    email: "corretor@demo.com.br",
    tipoUsuario: "CORRETOR",
    empresaId,
  });
  const autonomoId = await ensureUsuario({
    nome: "Corretor Autônomo Demo",
    email: "autonomo@demo.com.br",
    tipoUsuario: "CORRETOR_INDIVIDUAL",
    empresaId: null,
  });
  await ensureImoveisDemo({ empresaId, adminId, corretorId, autonomoId });
  console.log("\nSeed concluído.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
