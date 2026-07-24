import { RecuperarForm } from "./recuperar-form";

export const metadata = {
  title: "Recuperar senha — Loca",
};

export default function RecuperarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <RecuperarForm />
    </main>
  );
}
