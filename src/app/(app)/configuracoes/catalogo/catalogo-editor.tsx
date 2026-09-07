"use client";

// A árvore de categorias e tipos.
//
// Uma árvore que abre e fecha, e não duas listas lado a lado: o tipo só existe
// DENTRO de uma categoria, e duas listas fariam a pessoa escolher a categoria
// num seletor toda vez que criasse um tipo — o erro de pôr NOTEBOOK em
// Concretagem entraria por descuido, não por convicção.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, ChevronRight, ChevronDown, ListChecks, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { NATUREZAS_ITEM, NATUREZA_ITEM, type NaturezaItem } from "@/lib/itens";
import { UNIDADES_MEDIDOR, UNIDADE_MEDIDOR_INFO } from "@/lib/catalogo";
import type { CategoriaComTipos } from "@/lib/data/catalogo";
import {
  salvarCategoria,
  excluirCategoria,
  salvarTipo,
  excluirTipo,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FichaEditor } from "./ficha-editor";
import { ExigenciasEditor } from "./exigencias-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function CatalogoEditor({
  categorias,
  podeEditar,
}: {
  categorias: CategoriaComTipos[];
  podeEditar: boolean;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(
    // Abre sozinha a categoria que JÁ tem tipos: é onde há o que ler. As vazias
    // ficam fechadas e visíveis, porque categoria sem tipo é onde falta
    // cadastro — e esconder isso deixaria a tela parecendo completa.
    () => new Set(categorias.filter((c) => c.tipos.length > 0).map((c) => c.id)),
  );
  const [criandoCategoria, setCriandoCategoria] = useState(false);

  function alternar(id: string) {
    setAbertas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  }

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-lg border">
        {categorias.map((c) => (
          <LinhaCategoria
            key={c.id}
            categoria={c}
            aberta={abertas.has(c.id)}
            aoAlternar={() => alternar(c.id)}
            podeEditar={podeEditar}
          />
        ))}
        {categorias.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma categoria cadastrada.
          </p>
        ) : null}
      </div>

      {podeEditar ? (
        criandoCategoria ? (
          <div className="rounded-lg border border-dashed p-4">
            <CategoriaForm aoConcluir={() => setCriandoCategoria(false)} />
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setCriandoCategoria(true)}>
            <Plus className="size-3.5" aria-hidden />
            Nova categoria
          </Button>
        )
      ) : null}
    </div>
  );
}

function LinhaCategoria({
  categoria,
  aberta,
  aoAlternar,
  podeEditar,
}: {
  categoria: CategoriaComTipos;
  aberta: boolean;
  aoAlternar: () => void;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button
          type="button"
          onClick={aoAlternar}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
          aria-expanded={aberta}
        >
          {aberta ? (
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          )}
          <span className="font-medium">{categoria.nome}</span>
          <span className="text-xs text-muted-foreground">
            {categoria.tipos.length}{" "}
            {categoria.tipos.length === 1 ? "tipo" : "tipos"}
          </span>
        </button>

        {podeEditar ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Renomear categoria"
              onClick={() => setEditando((v) => !v)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <ConfirmDelete
              action={excluirCategoria}
              id={categoria.id}
              mensagem={`Excluir a categoria “${categoria.nome}”?`}
            />
          </>
        ) : null}
      </div>

      {editando ? (
        <div className="border-t bg-muted/30 p-3">
          <CategoriaForm
            categoria={{ id: categoria.id, nome: categoria.nome }}
            aoConcluir={() => setEditando(false)}
          />
        </div>
      ) : null}

      {aberta ? (
        <div className="space-y-2 border-t bg-muted/20 p-3 pl-9">
          {categoria.tipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum tipo nesta categoria.
            </p>
          ) : (
            <div className="divide-y rounded-md border bg-background">
              {categoria.tipos.map((t) => (
                <LinhaTipo
                  key={t.id}
                  tipo={t}
                  categoriaId={categoria.id}
                  podeEditar={podeEditar}
                />
              ))}
            </div>
          )}

          {podeEditar ? (
            criandoTipo ? (
              <div className="rounded-md border border-dashed bg-background p-3">
                <TipoForm
                  categoriaId={categoria.id}
                  aoConcluir={() => setCriandoTipo(false)}
                />
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setCriandoTipo(true)}>
                <Plus className="size-3.5" aria-hidden />
                Novo tipo em {categoria.nome}
              </Button>
            )
          ) : null}

          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          {/* `setErro` fica aqui para o dia em que a linha precisar reportar —
              hoje quem reporta são os formulários. */}
          <span className="hidden" aria-hidden onClick={() => setErro(null)} />
        </div>
      ) : null}
    </div>
  );
}

function LinhaTipo({
  tipo,
  categoriaId,
  podeEditar,
}: {
  tipo: CategoriaComTipos["tipos"][number];
  categoriaId: string;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [ficha, setFicha] = useState(false);
  const [exigencias, setExigencias] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 font-medium">
          {tipo.nome}
          {!tipo.ativo ? (
            <Badge variant="outline" className="ml-2">
              Inativo
            </Badge>
          ) : null}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {NATUREZA_ITEM[tipo.naturezaPadrao].label.toLowerCase()}
            {tipo.itens > 0
              ? ` · ${tipo.itens} ${tipo.itens === 1 ? "item" : "itens"}`
              : ""}
          </span>
        </span>

        {podeEditar ? (
          <>
            {/* A ficha fica ao lado do lápis e não dentro dele: são coisas
                diferentes — o lápis muda o NOME do tipo, a ficha muda o que as
                PEÇAS dele vão pedir. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFicha((v) => !v)}
            >
              <ListChecks className="size-3.5" aria-hidden />
              Ficha
              {tipo.campos.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  ({tipo.campos.length})
                </span>
              ) : null}
            </Button>
            {/* Ao lado da ficha, e não dentro dela: a ficha diz o que a peça
                É, a exigência diz o que ela precisa TER em dia. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExigencias((v) => !v)}
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Exigências
              {tipo.exigencias.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  ({tipo.exigencias.length})
                </span>
              ) : null}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar tipo"
              onClick={() => setEditando((v) => !v)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <ConfirmDelete
              action={excluirTipo}
              id={tipo.id}
              mensagem={`Excluir o tipo “${tipo.nome}”?`}
            />
          </>
        ) : null}
      </div>

      {editando ? (
        <div className="border-t bg-muted/30 p-3">
          <TipoForm
            categoriaId={categoriaId}
            tipo={tipo}
            aoConcluir={() => setEditando(false)}
          />
        </div>
      ) : null}

      {ficha ? (
        <div className="border-t bg-muted/30 p-3">
          <FichaEditor
            tipoId={tipo.id}
            tipoNome={tipo.nome}
            campos={tipo.campos}
            aoConcluir={() => setFicha(false)}
          />
        </div>
      ) : null}

      {exigencias ? (
        <div className="border-t bg-muted/30 p-3">
          <ExigenciasEditor
            tipoId={tipo.id}
            tipoNome={tipo.nome}
            exigencias={tipo.exigencias}
            aoConcluir={() => setExigencias(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function CategoriaForm({
  categoria,
  aoConcluir,
}: {
  categoria?: { id: string; nome: string };
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarCategoria({
        id: categoria?.id,
        nome: String(fd.get("nome") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success(categoria ? "Categoria renomeada." : "Categoria criada.");
      aoConcluir();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor={`cat-${categoria?.id ?? "nova"}`}>Nome da categoria</Label>
        <Input
          id={`cat-${categoria?.id ?? "nova"}`}
          name="nome"
          required
          maxLength={60}
          disabled={pendente}
          defaultValue={categoria?.nome ?? ""}
          placeholder="Ex.: Concretagem"
        />
      </div>
      <Button type="submit" size="sm" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
        <X className="size-3.5" aria-hidden />
        Cancelar
      </Button>
      {erro ? <p className="w-full text-sm text-destructive">{erro}</p> : null}
    </form>
  );
}

function TipoForm({
  categoriaId,
  tipo,
  aoConcluir,
}: {
  categoriaId: string;
  tipo?: CategoriaComTipos["tipos"][number];
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [natureza, setNatureza] = useState<NaturezaItem>(
    tipo?.naturezaPadrao ?? "equipamento",
  );
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarTipo({
        id: tipo?.id,
        categoria_id: categoriaId,
        nome: String(fd.get("nome") ?? ""),
        natureza_padrao: natureza,
        intervalo_manutencao: String(fd.get("intervalo_manutencao") ?? ""),
        unidade_medidor: String(fd.get("unidade_medidor") ?? ""),
        ativo: fd.get("ativo") === "on",
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success(tipo ? "Tipo salvo." : "Tipo criado.");
      aoConcluir();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`tipo-nome-${tipo?.id ?? "novo"}`}>Nome do tipo</Label>
        <Input
          id={`tipo-nome-${tipo?.id ?? "novo"}`}
          name="nome"
          required
          maxLength={60}
          disabled={pendente}
          defaultValue={tipo?.nome ?? ""}
          placeholder="Ex.: NOTEBOOK"
        />
        {/* A caixa alta é aplicada no schema, não aqui: o formulário pode ser
            contornado, e "Notebook" convivendo com "NOTEBOOK" é exatamente a
            duplicata que este cadastro existe para impedir. */}
        <p className="text-xs text-muted-foreground">
          Salvo em caixa alta. A família, não o modelo — “NOTEBOOK”, e não “Dell
          Latitude 3490”.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`tipo-nat-${tipo?.id ?? "novo"}`}>Natureza sugerida</Label>
        <NativeSelect
          id={`tipo-nat-${tipo?.id ?? "novo"}`}
          value={natureza}
          onChange={(e) => setNatureza(e.target.value as NaturezaItem)}
          disabled={pendente}
        >
          {NATUREZAS_ITEM.map((n) => (
            <option key={n} value={n}>
              {NATUREZA_ITEM[n].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Sugestão para o item novo deste tipo — quem cadastra pode mudar.
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`tipo-int-${tipo?.id ?? "novo"}`}>
          Revisão a cada{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id={`tipo-int-${tipo?.id ?? "novo"}`}
          name="intervalo_manutencao"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          className="max-w-40"
          disabled={pendente}
          defaultValue={tipo?.intervaloManutencao ?? ""}
          placeholder="250"
        />
        {/* A UNIDADE fica ao lado do número, e não numa configuração à parte:
            250 e 10.000 são o mesmo campo com sentidos opostos, e separá-los
            deixaria o número sozinho na tela sem dizer o que ele conta. */}
        <NativeSelect
          name="unidade_medidor"
          aria-label="Unidade do medidor"
          className="max-w-40"
          disabled={pendente}
          defaultValue={tipo?.unidadeMedidor ?? ""}
        >
          <option value="">—</option>
          {UNIDADES_MEDIDOR.map((u) => (
            <option key={u} value={u}>
              {UNIDADE_MEDIDOR_INFO[u].medidor} ({UNIDADE_MEDIDOR_INFO[u].label})
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Quanto a máquina roda entre manutenções preventivas — 250 h para um
          gerador, 10.000 km para um carro. Em branco, este tipo não tem revisão
          por uso, que é o caso da maioria.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="ativo"
          className="size-4"
          disabled={pendente}
          defaultChecked={tipo?.ativo ?? true}
        />
        Tipo ativo
        <span className="text-xs text-muted-foreground">
          — inativo some do cadastro de item novo, sem apagar a classificação do
          que já existe.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar tipo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
          <X className="size-3.5" aria-hidden />
          Cancelar
        </Button>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      </div>
    </form>
  );
}
