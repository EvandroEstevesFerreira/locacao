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
