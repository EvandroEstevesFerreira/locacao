import { NovaSenhaForm } from "./nova-senha-form";

export const metadata = {
  title: "Nova senha — Loca",
};

export default function NovaSenhaPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <NovaSenhaForm />
    </main>
  );
}
