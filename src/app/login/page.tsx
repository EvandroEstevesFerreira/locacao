import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar — Loca",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <LoginForm />
    </main>
  );
}
