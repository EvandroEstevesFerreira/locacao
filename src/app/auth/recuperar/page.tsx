import { AuthShell } from "@/components/shared/auth-shell";
import { APP_VERSION } from "@/lib/changelog";
import { RecuperarForm } from "./recuperar-form";

export const metadata = {
  title: "Recuperar senha — Loca",
};

export default function RecuperarPage() {
  return (
    <AuthShell
      titulo="Recuperar acesso"
      descricao="Informe seu e-mail e enviaremos um link para você criar uma nova senha."
      versao={APP_VERSION}
    >
      <RecuperarForm />
    </AuthShell>
  );
}
