import { AuthShell } from "@/components/shared/auth-shell";
import { APP_VERSION } from "@/lib/changelog";
import { NovaSenhaForm } from "./nova-senha-form";

export const metadata = {
  title: "Nova senha — Loca",
};

export default function NovaSenhaPage() {
  return (
    <AuthShell
      titulo="Definir nova senha"
      descricao="Escolha uma senha nova para entrar no Loca."
      versao={APP_VERSION}
    >
      <NovaSenhaForm />
    </AuthShell>
  );
}
