export const metadata = { title: "Offline — Loca" };

// Esta página é pré-cacheada pelo service worker e servida quando não há rede.
// Os estilos são inline de propósito: a folha em /_next/static/css/*.css não
// está no PRECACHE, então classes do Tailwind não teriam efeito aqui.
//
// Pelo mesmo motivo o tema escuro vem de um <style> com prefers-color-scheme, e
// não da classe .dark — sem CSS e sem o script do next-themes, nada aplicaria
// essa classe.
//
// Ao editar esta página, bumpe o CACHE em public/sw.js: o navegador que já tem
// a versão antiga no PRECACHE continuaria vendo-a indefinidamente.

export default function OfflinePage() {
  return (
    <>
      <style>{`
        .loca-offline {
          color-scheme: light dark;
          --fundo: #FFFFFF;
          --texto: #0F172A;
          --fraco: #64748B;
        }
        @media (prefers-color-scheme: dark) {
          .loca-offline {
            --fundo: #070A13;
            --texto: #E2E8F0;
            --fraco: #94A3B8;
          }
        }
      `}</style>
      <div
        className="loca-offline"
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--fundo)",
          color: "var(--texto)",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 8,
              letterSpacing: "-0.02em",
            }}
          >
            Você está offline
          </h1>
          <p style={{ color: "var(--fraco)", fontSize: 14, lineHeight: 1.5 }}>
            Não foi possível conectar ao Loca. Verifique sua internet — assim que
            a conexão voltar, recarregue a página para continuar de onde parou.
          </p>
        </div>
      </div>
    </>
  );
}
