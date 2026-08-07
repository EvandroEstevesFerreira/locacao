import { formatarData } from "@/lib/locacao";
import { CHANGELOG, APP_VERSION, TIPO_MUDANCA_INFO } from "@/lib/changelog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Novidades — Loca" };

export default function NovidadesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo="Novidades"
        descricao="Histórico de versões e melhorias do Loca, da mais recente para a mais antiga."
        acoes={<Badge variant="secondary">Versão atual · v{APP_VERSION}</Badge>}
      />

      <div className="space-y-4">
        {CHANGELOG.map((rel) => (
          <Card key={rel.versao}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>v{rel.versao}</Badge>
                <CardTitle className="text-base">{rel.titulo}</CardTitle>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatarData(rel.data)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {rel.mudancas.map((m, i) => {
                  const info = TIPO_MUDANCA_INFO[m.tipo];
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant={info.variant} className="mt-0.5 shrink-0">
                        {info.label}
                      </Badge>
                      <span className="text-muted-foreground">{m.texto}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
