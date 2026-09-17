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
// Registros do banco (obras, fornecedores, equipamentos, funcionários,
// contratos, imóveis) entram na busca desde a Task 3 do plano de busca
// global. O filtro roda no servidor, não aqui: o PostgREST não expressa
// `unaccent` sobre coluna dentro de um `.or()`, então "joao" só encontra
// "João" filtrando em memória do lado de cá (ver `buscarGlobal` em
// `src/lib/data/busca.ts`). O palette chama esse servidor por uma server
// action (`buscarGlobalAction`) com debounce; a permissão de ver cada
// registro vem da RLS por trás da consulta, não de checagem alguma aqui.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { NavItem } from "@/lib/nav";
import { ENTIDADES, TERMO_MINIMO } from "@/lib/busca";
import type { GrupoBusca } from "@/lib/data/busca";
import {
  podeEditarCadastros,
  podeGerenciarFinanceiro,
  podeGerenciarUsuarios,
  podeOperar,
  type Papel,
} from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { buscarGlobalAction } from "./busca-global-action";

type Grupo = "Páginas" | "Ações" | string;
type Entrada =
  | { tipo: "simples"; label: string; href: string; grupo: Grupo }
  | {
      tipo: "registro";
      label: string;
      href: string;
      grupo: Grupo;
      detalhe: string | null;
      id: string;
    };

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
  const [resultadosServidor, setResultadosServidor] = useState<GrupoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const router = useRouter();
  // Guarda o termo que originou a chamada em curso, para descartar respostas
  // fora de ordem: se "and" voltar depois de o usuário já ter digitado
  // "anderson", comparar com o termo atual evita sobrescrever o resultado
  // certo com o velho.
  const termoEmVoo = useRef<string | null>(null);

  const indice = useMemo<Entrada[]>(() => {
    const liberado = (m: string) => itens.some((n) => n.modulo === m);
    const acoes: Entrada[] = [];
    const add = (label: string, href: string) =>
      acoes.push({ tipo: "simples", label, href, grupo: "Ações" });

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

    const paginas: Entrada[] = itens.map((n) => ({
      tipo: "simples",
      label: n.label,
      href: n.href,
      grupo: "Páginas",
    }));

    // Ordem fixa: Ações, Páginas, depois um grupo por entidade na ordem de
    // ENTIDADES — páginas antes dos registros porque são instantâneas e a
    // lista já é útil enquanto os registros ainda carregam do servidor.
    return [...acoes, ...paginas];
  }, [itens, papel]);

  const termoValidoAtual = normalizar(busca.trim()).length >= TERMO_MINIMO;

  const gruposPorEntidade = useMemo(() => {
    if (!termoValidoAtual) return [];
    const mapa = new Map(resultadosServidor.map((g) => [g.entidade, g]));
    return ENTIDADES.map((e) => mapa.get(e)).filter((g): g is GrupoBusca => g !== undefined);
  }, [resultadosServidor, termoValidoAtual]);

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    const locais = termo ? indice.filter((e) => normalizar(e.label).includes(termo)) : indice;

    const registros: Entrada[] = gruposPorEntidade.flatMap((g) =>
      g.itens.map<Entrada>((item) => ({
        tipo: "registro",
        label: item.titulo,
        href: item.href,
        grupo: g.rotulo,
        detalhe: item.detalhe,
        id: item.id,
      })),
    );

    return [...locais, ...registros];
  }, [busca, indice, gruposPorEntidade]);

  // Busca no servidor, com debounce de 200ms e descarte de resposta fora de
  // ordem.
  useEffect(() => {
    const termo = busca.trim();
    if (normalizar(termo).length < TERMO_MINIMO) {
      termoEmVoo.current = null;
      // Reseta buscando fora do corpo síncrono do efeito (mesma forma que o
      // `setBuscando(true)` abaixo, dentro do `setTimeout`): chamar setState
      // direto no corpo do efeito é o que o eslint (react-hooks/set-state-in-
      // effect) rejeita. Sem este reset, apagar o termo enquanto uma busca
      // está em voo deixava `buscando` preso em `true` pelo resto da sessão
      // — o `.finally()` da promise em voo nunca bate, porque compara com
      // `termoEmVoo.current`, que este branch acabou de zerar.
      queueMicrotask(() => setBuscando(false));
      return;
    }

    const timer = setTimeout(() => {
      termoEmVoo.current = termo;
      setBuscando(true);
      buscarGlobalAction(termo)
        .then((grupos) => {
          if (termoEmVoo.current !== termo) return; // resposta velha, descarta
          setResultadosServidor(grupos);
        })
        .finally(() => {
          if (termoEmVoo.current === termo) setBuscando(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [busca]);

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
      setResultadosServidor([]);
      setBuscando(false);
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
              placeholder="Buscar páginas, ações e registros…"
              aria-label="Buscar páginas, ações e registros"
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
                const grupoBusca =
                  e.tipo === "registro"
                    ? gruposPorEntidade.find((g) => g.rotulo === e.grupo)
                    : undefined;
                // `funcionario` é o único grupo cujo destino não filtra por
                // termo (`/termos/funcionarios` não lê `?q=`): o cabeçalho
                // mostra a contagem, mas sem virar link, para não prometer um
                // recorte que a página de destino não entrega.
                const linkVerTodos =
                  grupoBusca && grupoBusca.total > grupoBusca.itens.length
                    ? grupoBusca.entidade === "funcionario"
                      ? null
                      : grupoBusca.hrefTodos
                    : null;
                return (
                  <div key={`${e.grupo}-${e.tipo === "registro" ? e.id : e.href}`}>
                    {novoGrupo ? (
                      <div className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                        <span>{e.grupo}</span>
                        {grupoBusca && grupoBusca.total > grupoBusca.itens.length ? (
                          linkVerTodos ? (
                            <button
                              type="button"
                              onClick={() => ir(linkVerTodos)}
                              className="font-normal underline-offset-2 hover:underline"
                            >
                              ({grupoBusca.itens.length} de {grupoBusca.total})
                            </button>
                          ) : (
                            <span className="font-normal">
                              ({grupoBusca.itens.length} de {grupoBusca.total})
                            </span>
                          )
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => ir(e.href)}
                      onMouseEnter={() => setIndiceAtivo(i)}
                      className={cn(
                        "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                        i === indiceAtivo
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <span>{e.label}</span>
                      {e.tipo === "registro" && e.detalhe ? (
                        <span className="text-xs text-muted-foreground">{e.detalhe}</span>
                      ) : null}
                    </button>
                  </div>
                );
              })
            )}
            {buscando && gruposPorEntidade.length === 0 ? (
              <p className="px-3 py-2 text-center text-xs text-muted-foreground">Buscando…</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
