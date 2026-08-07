import { AuthShell } from "@/components/shared/auth-shell";
import { APP_VERSION } from "@/lib/changelog";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar — Loca",
};

export default function LoginPage() {
  return (
    <AuthShell
      titulo="Bem-vindo de volta"
      descricao="Entre com sua conta corporativa para continuar."
      versao={APP_VERSION}
    >
      <LoginForm />
    </AuthShell>
  );
}
