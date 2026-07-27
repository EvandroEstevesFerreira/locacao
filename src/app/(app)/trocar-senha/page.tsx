import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrocarSenhaForm } from "./trocar-senha-form";

export const metadata = { title: "Trocar senha — Loca" };

export default function TrocarSenhaPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Defina sua senha
          </CardTitle>
          <CardDescription>
            Por segurança, no primeiro acesso (ou após uma redefinição pelo administrador)
            você precisa criar uma senha pessoal antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrocarSenhaForm />
        </CardContent>
      </Card>
    </div>
  );
}
