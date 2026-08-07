"use client";

// Busca rápida (Ctrl/⌘+K).
//
// Sem dependência de cmdk: é um Dialog + Input + lista filtrada. O Base UI
// Dialog já entrega portal, trap e restauração de foco, Esc e trava de scroll.
//
// O índice traz páginas E ações rápidas, divergindo do Sistenge People, que
// indexa só páginas. O People é um app de consulta com 17 módulos; o Loca é
// transacional — o trabalho do dia é "lançar um contrato", "abrir vistoria",
// "dar baixa". Com 11 itens de nav, um palette que só navega competiria com a
// sidebar e perderia.
//
// As ações respeitam módulo E papel: os itens já chegam filtrados por módulo
// (o layout server fez isso) e os predicados de permissoes.ts fazem o resto.
// Isso é conveniência, não controle de acesso — a segurança real é RLS mais a
// checagem dentro de cada action.
//
// Não indexamos registros do banco (obras/contratos por nome): exigiria
// endpoint de busca com debounce, e as listas já têm o ListSearch.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { NavItem } from "@/lib/nav";
import {
  podeEditarCadastros,
  podeGerenciarFinanceiro,
  podeGerenciarUsuarios,
  podeOperar,
  type Papel,
} from "@/lib/permissoes";
import { cn } from "@/lib/utils";

type Grupo = "Páginas" | "Ações";
type Entrada = { label: string; href: string; grupo: Grupo };

/** Remove acentos para que "imoveis" encontre "Imóveis". */
function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function CommandPalette({
  itens,
  papel,
}: {
  itens: readonly NavItem[];
  papel: Papel;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const router = useRouter();

  const indice = useMemo<Entrada[]>(() => {
    const liberado = (m: string) => itens.some((n) => n.modulo === m);
    const acoes: Entrada[] = [];
    const add = (label: string, href: string) =>
      acoes.push({ label, href, grupo: "Ações" });

    if (liberado("obras") && podeEditarCadastros(papel)) add("Nova obra", "/obras/nova");
    if (liberado("fornecedores") && podeEditarCadastros(papel))
      add("Novo fornecedor", "/fornecedores/novo");
    if (liberado("itens") && podeEditarCadastros(papel)) add("Novo item", "/itens/novo");
    if (liberado("contratos") && podeOperar(papel)) add("Novo contrato", "/contratos/novo");
    if (liberado("vistorias") && podeOperar(papel)) add("Nova vistoria", "/vistorias/nova");
    if (liberado("imoveis") && podeEditarCadastros(papel)) add("Novo imóvel", "/imoveis/novo");
    if (liberado("financeiro") && podeGerenciarFinanceiro(papel))
      add("Novo lançamento", "/financeiro/novo");
    if (podeGerenciarUsuarios(papel)) add("Novo usuário", "/usuarios/novo");

    return [
      ...itens.map((n) => ({ label: n.label, href: n.href, grupo: "Páginas" as const })),
      ...acoes,
    ];
  }, [itens, papel]);

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return indice;
    return indice.filter((e) => normalizar(e.label).includes(termo));
  }, [busca, indice]);

  // Atalho global. Ctrl+K / ⌘+K abre e fecha.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberto((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function alternar(proximo: boolean) {
    setAberto(proximo);
    if (!proximo) {
      setBusca("");
      setIndiceAtivo(0);
    }
  }

  function ir(href: string) {
    alternar(false);
    router.push(href);
  }

  function onKeyDownLista(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => (resultados.length ? (i + 1) % resultados.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) =>
        resultados.length ? (i - 1 + resultados.length) % resultados.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = resultados[indiceAtivo];
      if (alvo) ir(alvo.href);
    }
  }

  let grupoAnterior: Grupo | null = null;

  return (
    <>
      {/* Um só componente, dois gatilhos: campo falso no desktop, ícone no
          mobile. Duas instâncias montariam dois listeners de Ctrl+K. */}
      <button
        type="button"
        onClick={() => alternar(true)}
        className="hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Pesquisar…</span>
        <kbd className="hidden shrink-0 items-center rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => alternar(true)}
        aria-label="Pesquisar"
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
      >
        <Search className="size-4" aria-hidden />
      </button>

      <Dialog open={aberto} onOpenChange={alternar}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Buscar no Loca</DialogTitle>

          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setIndiceAtivo(0);
              }}
              onKeyDown={onKeyDownLista}
              placeholder="Buscar páginas e ações…"
              aria-label="Buscar páginas e ações"
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {resultados.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nada encontrado para “{busca}”.
              </p>
            ) : (
              resultados.map((e, i) => {
                const novoGrupo = e.grupo !== grupoAnterior;
                grupoAnterior = e.grupo;
                return (
                  <div key={`${e.grupo}-${e.href}`}>
                    {novoGrupo ? (
                      <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                        {e.grupo}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => ir(e.href)}
                      onMouseEnter={() => setIndiceAtivo(i)}
                      className={cn(
                        "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                        i === indiceAtivo
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {e.label}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
