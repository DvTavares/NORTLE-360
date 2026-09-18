# NORTLE 360

Plataforma de gestão e inteligência imobiliária — informações que orientam negócios imobiliários. Imobiliárias e corretores autônomos cadastram e organizam seus imóveis (com fotos e características); os anúncios ficam disponíveis publicamente numa vitrine, sem expor dados do corretor ou do cliente.

## Stack

- **Front-end**: React + Vite + TypeScript, em `client/` (SPA com `react-router`).
- **Back-end**: Express 5 + TypeScript rodando com [`tsx`](https://github.com/privatenumber/tsx), em `src/`.
- **Banco**: PostgreSQL via [Prisma Next](https://www.prisma.io/) (`@prisma/orm-postgres`). O contrato do banco fica em `prisma/contract.prisma`.
- **Autenticação**: sessão em cookie assinado (HMAC) + login em duas etapas (código de 6 dígitos por e-mail via SMTP).

## Rodando localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha:
   - `DATABASE_URL` — string de conexão do PostgreSQL (ex.: um banco no [Neon](https://neon.tech)).
   - `SESSION_SECRET` — uma string aleatória (o `.env.example` mostra como gerar uma).
   - `SMTP_*` — opcional em desenvolvimento: sem essas variáveis, o código de login aparece no console do servidor em vez de ser enviado por e-mail.
3. Aplique o esquema no banco:
   ```bash
   npx prisma db update
   ```
4. (Opcional) Popule dados de exemplo:
   ```bash
   npm run seed
   ```
5. Suba o front e a API juntos:
   ```bash
   npm run dev
   ```
   O site fica em `http://localhost:5173` (a API roda em `:3000`, com proxy configurado no Vite).

## Rodando em produção

```bash
npm install
npm run build   # gera client/dist
npm start       # Express serve a API e o front (client/dist) na porta $PORT (padrão 3000)
```

## Deploy

Este repositório sozinho no GitHub **não** deixa o site acessível por um link — o GitHub só hospeda o código. Para publicar o NORTLE 360 com um link ao vivo, é preciso rodar o Node.js e conectar num banco Postgres em algum serviço de hospedagem. O jeito mais rápido é o [Render](https://render.com), usando o `render.yaml` já incluído neste repositório:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/DvTavares/NORTLE-360)

Ao clicar, o Render vai pedir pra você preencher (uma vez só):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a string de conexão do seu Postgres (Neon, Supabase, ou o Postgres do próprio Render) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | credenciais de e-mail para o código de login (ex.: Gmail com senha de app) |

`SESSION_SECRET` é gerado automaticamente pelo Render. Depois de preencher e confirmar, o Render builda e sobe o site sozinho — e todo novo `git push` nesta branch faz um novo deploy automático.

## Estrutura

```
src/            API Express (TypeScript, roda com tsx)
client/         front-end React + Vite
prisma/         contrato do banco (Prisma Next)
migrations/     histórico de migrações aplicadas
uploads/        fotos enviadas (não versionado)
```
