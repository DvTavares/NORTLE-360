import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract.d";
import contractJson from "../prisma/contract.json" with { type: "json" };

/**
 * Cliente Prisma Next — singleton para todo o processo.
 * A conexão é preguiçosa: o pool só abre na primeira query.
 * Nunca chame `db.close()` dentro de um handler HTTP (só em scripts).
 */
export const db = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL,
});
