import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

/** Logo NORTLE 360 embutida no e-mail (via cid:). null se o arquivo não existir. */
const LOGO_EMAIL: Buffer | null = (() => {
  try {
    return readFileSync(join(process.cwd(), "src", "email-logo.png"));
  } catch {
    return null;
  }
})();
const LOGO_CID = "nortle360logo";

/** true quando há SMTP configurado no .env; senão, cai no modo console. */
export const emailConfigurado = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = emailConfigurado
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER!, pass: SMTP_PASS! },
      // limites curtos — em alguns hosts a conexão SMTP fica pendurada em vez
      // de dar erro; sem isso o envio (e quem espera por ele) trava.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    })
  : null;

const REMETENTE = SMTP_FROM || SMTP_USER || "no-reply@nortle360.local";

export async function enviarCodigoLogin(
  para: string,
  nome: string,
  codigo: string,
): Promise<void> {
  if (!transporter) {
    // Modo dev — sem SMTP: o código aparece no log do servidor.
    console.log(
      `\n──────────────────────────────────────────────\n` +
        `  [e-mail: modo dev] código de login\n` +
        `  para: ${para}\n` +
        `  código: ${codigo}\n` +
        `──────────────────────────────────────────────\n`,
    );
    return;
  }

  const cabecalho = LOGO_EMAIL
    ? `<div style="text-align:center;margin:0 0 22px">` +
      `<img src="cid:${LOGO_CID}" alt="NORTLE 360" width="200" ` +
      `style="display:inline-block;width:200px;max-width:70%;height:auto;border:0" /></div>`
    : `<p style="font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#16150f;margin:0 0 4px">` +
      `NORTLE <span style="color:#b78a2e">360</span></p>` +
      `<p style="color:#6f6a5c;font-size:13px;margin:0 0 20px">Informações que orientam negócios imobiliários.</p>`;

  await transporter.sendMail({
    from: REMETENTE,
    to: para,
    subject: `Seu código de acesso NORTLE 360: ${codigo}`,
    attachments: LOGO_EMAIL
      ? [{ filename: "nortle360.png", content: LOGO_EMAIL, cid: LOGO_CID }]
      : undefined,
    text:
      `Olá, ${nome}.\n\n` +
      `Seu código para entrar na NORTLE 360 é: ${codigo}\n\n` +
      `Ele expira em 10 minutos. Se não foi você que tentou entrar, ignore este e-mail.\n\n` +
      `NORTLE 360 — Informações que orientam negócios imobiliários.`,
    html:
      `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#16150f;max-width:440px">` +
      cabecalho +
      `<p>Olá, ${nome}.</p>` +
      `<p>Seu código para entrar na <strong>NORTLE 360</strong> é:</p>` +
      `<p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:16px 0">${codigo}</p>` +
      `<p style="color:#6f6a5c;font-size:14px">Ele expira em 10 minutos. ` +
      `Se não foi você que tentou entrar, é só ignorar este e-mail.</p>` +
      `</div>`,
  });
}
