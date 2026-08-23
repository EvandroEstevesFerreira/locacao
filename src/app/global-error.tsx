"use client";

import { useEffect } from "react";
import { SLATE_50, SLATE_500, SLATE_900, BRANCO } from "@/lib/brand-colors";

// global-error.tsx substitui o root layout, então globals.css NÃO é aplicada:
// os estilos inline são obrigatórios, não uma escolha ruim. Por isso o tema
// escuro aqui vem de um <style> com prefers-color-scheme, e não da classe .dark
// — sem CSS não há provider de tema para injetá-la.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro global:", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        <style>{`
          :root {
            color-scheme: light dark;
            --fundo: ${BRANCO};
            --texto: ${SLATE_900};
            --fraco: ${SLATE_500};
            --botao-fundo: ${SLATE_900};
            --botao-texto: ${SLATE_50};
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --fundo: #070A13;
              --texto: #E2E8F0;
              --fraco: #94A3B8;
              --botao-fundo: #E2E8F0;
              --botao-texto: #0F172A;
            }
          }
        `}</style>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            minHeight: "100dvh",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--fundo)",
            color: "var(--texto)",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
            <h1 style={{ fontSize: 24, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Algo deu errado
            </h1>
            <p style={{ color: "var(--fraco)", marginBottom: 16 }}>
              Ocorreu um erro inesperado. Tente novamente.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: "var(--botao-fundo)",
                color: "var(--botao-texto)",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
            {error.digest ? (
              <p
                style={{
                  marginTop: 20,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 11,
                  color: "var(--fraco)",
                }}
              >
                ID do erro: {error.digest}
              </p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );
}
