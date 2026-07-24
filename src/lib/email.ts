import { Resend } from "resend";

export function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type LinhaAlerta = {
  categoria: string;
  descricao: string;
  data: string;
};

/** Monta o HTML do e-mail de aviso de vencimentos. */
export function montarEmailVencimentos(
  orgNome: string,
  linhas: LinhaAlerta[],
): string {
  const itens = linhas
    .map(
      (l) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.categoria}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.descricao}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap;">${l.data}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;">
  <h2 style="margin:0 0 4px;">Loca — Avisos de vencimento</h2>
  <p style="color:#555;margin:0 0 16px;">${orgNome}</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <thead>
      <tr style="text-align:left;background:#f5f5f5;">
        <th style="padding:8px 12px;">Tipo</th>
        <th style="padding:8px 12px;">Descrição</th>
        <th style="padding:8px 12px;">Data</th>
      </tr>
    </thead>
    <tbody>${itens}</tbody>
  </table>
  <p style="color:#888;font-size:12px;margin-top:16px;">
    Enviado automaticamente pelo Loca — controle de locações.
  </p>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Comunicações de acesso (novo usuário / redefinição de senha)
// ---------------------------------------------------------------------------

const ACENTO = "#5980a6";

function layoutEmail(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;color:#1d1f20;background:#f2f2f3;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d4d4d7;">
    <div style="border-bottom:3px solid ${ACENTO};padding:16px 24px;">
      <div style="font-size:18px;font-weight:bold;letter-spacing:1px;">SISTENGE</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACENTO};">Locações de obra</div>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;font-size:18px;">${titulo}</h2>
      ${corpo}
      <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">
        Enviado automaticamente pelo Loca — controle de locações da Sistenge.
      </p>
    </div>
  </div>
</body></html>`;
}

function bloco(label: string, valor: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#5d5d60;font-size:13px;width:150px;">${label}</td>
    <td style="padding:8px 0;font-size:14px;font-weight:bold;">${valor}</td>
  </tr>`;
}

function botao(url: string, texto: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${ACENTO};color:#fff;text-decoration:none;padding:10px 18px;font-weight:bold;">${texto}</a>`;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://loca-sistenge.vercel.app";
}

/** E-mail de boas-vindas com os dados de acesso do novo usuário. */
export function montarEmailNovoUsuario(
  nome: string,
  email: string,
  senha: string,
  perfil: string,
): string {
  const url = appUrl();
  return layoutEmail(
    "Seu acesso ao Loca foi criado",
    `<p style="font-size:14px;">Olá, ${nome}. Você foi cadastrado no <strong>Loca</strong> — sistema de controle de locações da Sistenge.</p>
     <table style="border-collapse:collapse;width:100%;margin-top:8px;">
       ${bloco("Endereço do sistema", `<a href="${url}" style="color:${ACENTO};">${url}</a>`)}
       ${bloco("E-mail de acesso", email)}
       ${bloco("Senha temporária", senha)}
       ${bloco("Perfil", perfil)}
     </table>
     <p style="font-size:13px;color:#5d5d60;margin-top:12px;">Por segurança, recomendamos trocar a senha após o primeiro acesso.</p>
     ${botao(url, "Acessar o Loca")}`,
  );
}

/** E-mail avisando que a senha do usuário foi redefinida. */
export function montarEmailSenhaRedefinida(
  nome: string,
  email: string,
  senha: string,
): string {
  const url = appUrl();
  return layoutEmail(
    "Sua senha do Loca foi redefinida",
    `<p style="font-size:14px;">Olá, ${nome}. A senha da sua conta no <strong>Loca</strong> foi redefinida por um administrador.</p>
     <table style="border-collapse:collapse;width:100%;margin-top:8px;">
       ${bloco("E-mail de acesso", email)}
       ${bloco("Nova senha temporária", senha)}
     </table>
     <p style="font-size:13px;color:#5d5d60;margin-top:12px;">Recomendamos trocar a senha após entrar. Se você não esperava esta alteração, avise o administrador.</p>
     ${botao(url, "Acessar o Loca")}`,
  );
}

/** Envia um e-mail via Resend. Lança se não configurado. */
export async function enviarEmail(
  destinatarios: string[],
  assunto: string,
  html: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Resend não configurado (RESEND_API_KEY / EMAIL_FROM).");
  }
  const resend = new Resend(apiKey);
  return resend.emails.send({
    from,
    to: destinatarios,
    subject: assunto,
    html,
  });
}
