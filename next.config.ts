import type { NextConfig } from "next";

/**
 * Headers de segurança em todas as rotas, alinhados ao Sistenge People.
 *
 * `unsafe-inline`/`unsafe-eval` em script-src são necessários porque o Next
 * injeta scripts de hidratação inline; uma CSP estrita exigiria nonce gerado
 * no proxy (src/proxy.ts) e propagado por request.
 *
 * connect-src: só o que o BROWSER realmente chama. O Supabase é acessado do
 * cliente (auth, dados, Storage) via @supabase/ssr. O Resend NÃO entra aqui —
 * `src/lib/email.ts` roda apenas no servidor, e CSP governa o browser.
 * Nenhuma outra chamada externa existe: `src/lib/cnpj.ts` é validação local
 * (DV mód-11 alfanumérico), sem rede.
 *
 * worker-src e manifest-src existem porque o Loca é PWA (`public/sw.js`,
 * `public/manifest.webmanifest`) — o People não é, e sem eles o service
 * worker é bloqueado.
 *
 * HSTS vai sem `includeSubDomains` de propósito: o app é servido de um
 * domínio Sistenge e a diretiva se propagaria para irmãos que podem não
 * estar em HTTPS. Reavaliar junto com a configuração de domínio.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  {
    // camera=(self): `src/app/(app)/vistorias/foto-uploader.tsx` usa
    // <input type="file" capture="environment"> para fotografar a avaria
    // direto da obra. Não há getUserMedia no projeto.
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // https: cobre as URLs assinadas do Supabase Storage; blob: os previews
      // locais de upload; data: os SVGs embutidos.
      "img-src 'self' data: blob: https:",
      // next/font/google baixa as fontes no build e as serve de 'self'.
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
