export const metadata = { title: "Offline — Loca" };

export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Você está offline</h1>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Não foi possível conectar ao Loca. Verifique sua internet — assim que a conexão voltar,
          recarregue a página para continuar de onde parou.
        </p>
      </div>
    </div>
  );
}
