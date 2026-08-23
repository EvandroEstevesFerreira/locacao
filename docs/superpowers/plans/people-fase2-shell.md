Li todos os arquivos reais dos dois projetos. Antes do plano, **quatro correções ao briefing** — importantes porque mudam decisões de design.

---

## Correções ao estado que você descreveu

**1. O Loca NÃO passa `LucideIcon` do server para o client hoje.**
`src/app/(app)/layout.tsx:47` passa só `isMaster={isMaster} modulos={modulos}` (boolean + `string[]|null`, ambos serializáveis). `src/components/layout/sidebar.tsx:1` é `"use client"` e importa `NAV_ITEMS` **ele mesmo** (linha 5). Ou seja: `src/lib/nav.ts` é compilado para dentro do bundle do client e os componentes Lucide são resolvidos inteiramente no client — **o boundary nunca é cruzado**. Não há "aparentemente funciona": funciona por construção.

Verifiquei também o motivo técnico do comentário do People: `node_modules/lucide-react/package.json` → versão `1.26.0`, e o dist **não tem** diretiva `"use client"` (o CJS começa em `'use strict'`). Logo os ícones não são client references; se o layout server passasse `icon={HardHat}` como prop, o React recusaria a serialização em runtime. O comentário do People está correto — só não se aplica ao código atual do Loca.

**Consequência para o plano:** o padrão string-icon não é um bugfix no Loca, é uma escolha de arquitetura. Recomendo adotá-lo mesmo assim (motivos na seção 2), mas com essa justificativa honesta.

**2. `src/app/(app)/error.tsx` e `src/app/(app)/loading.tsx` já existem.** O `loading.tsx` atual já é skeleton (`mx-auto max-w-5xl` + barras `animate-pulse`), e o `error.tsx` já tem `AlertTriangle` + dois botões — falta só o `error.digest` e o painel `border-destructive/30 bg-destructive/5`. São alinhamentos, não criações.

**3. O People NÃO agrupa o nav em seções.** `app/(dashboard)/nav-items.ts` é um `readonly NavItem[]` plano de 17 itens, sem campo de grupo, e o layout renderiza um único `<nav className="flex flex-col gap-0.5">` (linhas 81-90). Não existe padrão de grupos para copiar.

**4. Os PDFs já são imunes ao tema.** `src/lib/pdf.tsx` usa **só** hex literais (`#cf2927`, `#BE3A31`, `#1d1f20`, `#f2f2f2`…) e **zero** `var(--…)` — conferi com grep. `@react-pdf/renderer` também não resolve custom properties. Não há nada a fazer além de registrar a regra "não introduzir tokens aqui".

**Bônus (risco real que não estava no briefing):** `src/app/globals.css:60` tem `--card: transparent`. Todo o shell do People depende de `bg-card` para a superfície da sidebar e do drawer. Se a Fase 1 não der um valor opaco a `--card`, a sidebar expandida no hover vai deixar o conteúdo da página aparecer atrás dela e o drawer mobile vai ficar translúcido. **Dependência bloqueante da Fase 1.**

**Bônus 2 (inconsistência existente):** `src/app/layout.tsx:39` declara `viewport.themeColor = "#BE3A31"`, mas `public/manifest.webmanifest` já declara `"theme_color": "#0f172a"`. A meta tag ganha. Já que a nova identidade tira o vermelho, alinhar os dois em slate resolve de graça.

---

## Diferenças de API que mudam o código copiado do People

| People (Radix/shadcn) | Loca (Base UI) |
|---|---|
| `<Button asChild><Link/></Button>` | **não existe `asChild`** → `<Button render={<Link href="…" />}>` |
| `size="icon" className="h-9 w-9"` | `size="icon-lg"` (`icon` = `size-8`) |
| `DialogContent` neutro | `DialogContent` já traz `sm:max-w-sm` + botão de fechar → palette precisa `showCloseButton={false} className="sm:max-w-lg"` |
| Drawer manual + `createPortal` | Base UI `Dialog` **já** portaliza, trava foco, restaura foco, trava scroll e trata Esc |
| — | `DropdownMenuContent` tem `w-(--anchor-width)` (dimensiona pelo trigger!) → precisa `className="w-64"` para não virar um menu de 32px |

Confirmei nos typings instalados: `DialogRoot` aceita `open` / `onOpenChange(open, details)` (passar `setOpen` direto funciona), `DialogPopup` aceita `initialFocus`, e `MenuItem` aceita `closeOnClick`. Tudo o que precisamos existe.

---

# FASE 2 — Plano de implementação

## Etapa 0 — Pré-requisitos da Fase 1 (verificar antes de começar)

Bloqueiam a Etapa 1:
- `--card` **opaco** em `:root` e `.dark` (hoje `transparent`).
- `--radius: 0.625rem`, `--border` visível, `--muted`/`--accent` slate.
- `.scrollbar-sutil`.
- Animações. Em Tailwind v4 não há `tailwind.config.ts`: precisa de `@keyframes fade-in/slide-in-left` + `--animate-fade-in`/`--animate-slide-in-left` no bloco `@theme`. **Fallback se não chegarem:** `tw-animate-css` já está instalado → `animate-in fade-in-0` e `animate-in slide-in-from-left-full duration-300`.
- `Logo`. **Atenção:** o Loca **não tem** `public/brand/` — só `public/icons/{icon.svg,icon-192.png,icon-512.png}`. Existe `src/components/sistenge-logo.tsx` (SVG inline, ícone `#cf2927` + wordmark em `currentColor`, viewBox `0 0 1920 392.19`). Ele já é theme-aware por `currentColor`, então serve como `variant="full"` **sem** precisar de dois SVGs nem de `useTheme()` — vantagem sobre o `Logo` do People. Falta a `variant="icon"`: extrair os dois `<path>` do grupo `fill="#cf2927"` num `SistengeIcon` com `viewBox="0 0 652 392"`.

---

## 1. `src/app/(app)/layout.tsx` reescrito

### Destino de cada elemento atual

| Hoje | Destino | Justificativa |
|---|---|---|
| Auth gate (`getUser` → `redirect`) + `perfil` select | **Preservado literalmente**, + `papel` passado ao `UserMenu`/palette | Zero mudança de contrato |
| `isMaster` / `modulos` | Preservados; passam a alimentar `navVisivel` **no server** | Deixa de vazar `/configuracoes` no bundle |
| Bloco de marca "SISTENGE" + `.eyebrow` "Locações de obra" | Vira o header da sidebar com cross-fade (ícone 26×26 ↔ wordmark). O eyebrow **morre**: não cabe em 72px nem na faixa de 64px expandida | Custo/benefício; a tagline reaparece no `/login` |
| Rodapé rico (avatar+nome+papel, "Meu perfil", form "Sair") | **Migra 100% para o `UserMenu`** do header, reconstruído sobre `ui/dropdown-menu.tsx` | É a resposta direta ao "não cabe em 72px": o conteúdo não é cortado, é movido para onde já existia um menu meia-boca |
| `Loca v{APP_VERSION} · Novidades` | Rodapé da sidebar padrão People (`h-12 border-t font-mono text-[11px]`), com `ChevronsRight` sempre visível e o texto (como `<Link href="/novidades">`) só no hover. Repetido no `UserMenu` | Preserva a informação **e** o link |
| `<BackButton/>` | Mantido, na zona esquerda, **antes** do breadcrumb, com `hidden md:inline-flex` | Breadcrumb responde "onde estou", não "como volto". Em mobile o espaço é do hambúrguer e o gesto nativo de voltar cobre o caso |
| Wordmark "SISTENGE" mobile-only no header | Vira `<Link href="/"><SistengeIcon width={28}/></Link>` `md:hidden` (padrão People) | Wordmark de 8 letras + hambúrguer + 3 ícones não cabe em 360px |
| `<nav className="md:hidden">` com `<Sidebar/>` em scroll-x | **Deletado.** Substituído pelo `MobileNav` (drawer) | É o ponto mais fraco, como você identificou |
| `<ServiceWorkerRegister/>` | **Preservado**, primeiro filho do wrapper | Sem alteração |
| `main` com `overflow-y-auto` | **`overflow-y-auto` removido** | Ver risco R1 |

### Sobre `main` full-bleed

**Sim, full-bleed — e não há conflito.** Verifiquei os 40 `page.tsx` de `(app)`: **todos** já trazem seu próprio `mx-auto max-w-*` (`max-w-2xl` ×17, `max-w-5xl` ×7, `max-w-3xl` ×6, `max-w-4xl` ×5, `max-w-6xl` ×4, `max-w-md` ×1). A convenção "a página decide sua largura" já é a do Loca; um `max-w` no layout seria uma segunda restrição empilhada. Único efeito colateral: a área útil cresce 168px (240→72), então as páginas `max-w-2xl` ficam mais centralizadas em telas largas — cosmético, e é exatamente o que o People faz. Padding: `p-4 sm:p-6 lg:p-8` (hoje `p-4 md:p-6`).

### Código

```tsx
// src/app/(app)/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronsRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_VERSION } from "@/lib/changelog";
import { NAV_ITEMS } from "@/lib/nav";
import { moduloLiberado } from "@/lib/modulos";
import type { Papel } from "@/lib/permissoes";
import { SistengeLogo, SistengeIcon } from "@/components/sistenge-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { BackButton } from "@/components/back-button";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { NavLink } from "@/components/layout/nav-link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfil").select("nome, email, papel, modulos").eq("id", user.id).single();

  const isMaster = perfil?.papel === "master";
  const modulos = (perfil?.modulos as string[] | null) ?? null;
  const papel = (perfil?.papel ?? "gestor") as Papel;

  // Filtragem no server (antes era no client). Itens já serializáveis
  // porque `icon` virou string — ver src/lib/nav.ts.
  const navVisivel = NAV_ITEMS.filter((item) => {
    if (item.apenasMaster && !isMaster) return false;
    if (item.modulo && !moduloLiberado(modulos, isMaster, item.modulo)) return false;
    return true;
  });

  return (
    <div className="min-h-dvh bg-background">
      <ServiceWorkerRegister />

      {/* Sidebar desktop — 72px, expande a 240px no hover E no focus-within
          (focus-within é um acréscimo nosso: sem ele, quem navega por Tab
          fica sem rótulos). */}
      <aside
        className="group/sidebar fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col
                   overflow-hidden border-r bg-card transition-[width,box-shadow]
                   duration-200 ease-out hover:w-60 hover:shadow-md
                   focus-within:w-60 focus-within:shadow-md md:flex"
      >
        <div className="relative flex h-16 shrink-0 items-center border-b px-[22px]">
          <div className="absolute left-[22px] flex items-center transition-opacity duration-150 group-hover/sidebar:opacity-0 group-focus-within/sidebar:opacity-0">
            <SistengeIcon className="h-[26px] w-auto" />
          </div>
          <div className="flex items-center opacity-0 transition-opacity delay-75 duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            <SistengeLogo className="h-[27px] w-auto" />
          </div>
        </div>

        <div className="scrollbar-sutil flex-1 overflow-x-hidden overflow-y-auto p-3.5">
          <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
            {navVisivel.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </nav>
        </div>

        <Link
          href="/novidades"
          className="flex h-12 shrink-0 items-center gap-3.5 border-t px-3.5 font-mono
                     text-[11px] whitespace-nowrap text-muted-foreground
                     hover:text-foreground focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          title={`Loca v${APP_VERSION} — novidades`}
        >
          <ChevronsRight className="h-[18px] w-[18px] shrink-0 opacity-70" aria-hidden="true" />
          <span className="opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            Loca · v{APP_VERSION}
          </span>
        </Link>
      </aside>

      <div className="flex min-h-dvh flex-col md:pl-[72px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b
                           bg-background/95 px-4 backdrop-blur
                           supports-backdrop-filter:bg-background/80 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav items={navVisivel} versao={APP_VERSION} />
            <Link href="/" aria-label="Loca — início" className="flex items-center md:hidden">
              <SistengeIcon className="h-7 w-auto" />
            </Link>
            <BackButton className="hidden md:inline-flex" />
            <Breadcrumb />
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <CommandPalette itens={navVisivel} papel={papel} />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
            <CommandPalette itens={navVisivel} papel={papel} apenasIcone className="md:hidden" />
            <ThemeToggle />
            <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground lg:inline">
              Olá, {(perfil?.nome ?? perfil?.email ?? "").split(" ")[0]}
            </span>
            <UserMenu
              nome={perfil?.nome ?? ""}
              email={perfil?.email ?? user.email ?? ""}
              papel={papel}
              versao={APP_VERSION}
            />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
```

**Nota sobre o duplo `<CommandPalette>`:** duas instâncias montariam dois listeners de Ctrl+K e dois Dialogs. Ver a solução na seção 3 (uma instância, dois triggers via `apenasIcone` + guard de `matchMedia`) — ou, mais simples e recomendado, renderizar **uma** instância e trocar só a aparência do trigger com `hidden md:flex` / `md:hidden` **dentro** do componente.

---

## 2. `src/lib/nav.ts` — string-icon: recomendo sim, com a justificativa certa

### Avaliação baseada em evidência

O padrão **não é necessário** para consertar nada: como mostrei na correção 1, o Loca nunca cruza o boundary com ícones. Mas ele **passa a ser necessário** no minuto em que o layout server calcula `navVisivel` e passa para `<NavLink icon={…}/>` e `<MobileNav items={…}/>` — que é justamente a arquitetura do People. As alternativas eram:

- **(A) Manter filtragem no client.** `MobileNav` e a `<nav>` do desktop importariam `NAV_ITEMS` e filtrariam com `moduloLiberado`. Zero refactor de `nav.ts`. Custo: a filtragem roda duas vezes (duas árvores), o bundle client continua carregando a entrada `/configuracoes` de todo mundo, e `lib/nav.ts` permanece impossível de importar em `src/proxy.ts` / edge (importa `lucide-react`).
- **(B) String-icon.** Filtra uma vez no server; `nav.ts` fica sem dependência de ícone, como `src/lib/modulos.ts` deliberadamente é ("SEM dependências de servidor nem de ícones, para poder ser importado no middleware"). Custo: um arquivo novo de 40 linhas e um `Record` a manter.

**Recomendo (B)** — coerência com a convenção que o próprio Loca já documenta em `modulos.ts`, uma única passagem de filtro, e `nav.ts` vira dado puro reaproveitável (labels para breadcrumb, auditoria, metadata) em qualquer runtime.

### Grupos: **não introduzir**

O People não tem grupos (correção 3). Com 11 itens em `gap-0.5` e `h-10`, o `<nav>` ocupa ~110px de 640px de altura útil — não há problema de densidade a resolver. Introduzir grupos criaria um eixo de design que o projeto de referência não tem, e os rótulos de grupo desaparecem no estado colapsado de 72px (viram um espaço morto inexplicável). Se quiser hierarquia visual barata: um `<div className="my-1.5 h-px bg-border" />` antes de Novidades/Configurações (a "cauda de sistema"). Opcional, sem rótulos.

### Novo `src/lib/nav.ts`

```ts
// Navegação principal do app. Dados puros e serializáveis: sem ícones-componente,
// sem imports de servidor — pode ser importado por Server Components, Client
// Components e (se preciso) pelo proxy/edge, igual a src/lib/modulos.ts.
//
// IMPORTANTE: não referenciar componentes Lucide aqui. O layout (server) filtra
// esta lista e passa os itens como props para componentes client; funções não são
// serializáveis nesse boundary. O lookup nome→componente vive em
// src/components/layout/nav-icon.tsx ("use client").

import type { ModuloKey } from "@/lib/modulos";

export type NavIconName =
  | "layout-dashboard" | "hard-hat" | "truck" | "package" | "file-text"
  | "building-2" | "clipboard-check" | "wallet" | "bar-chart-3"
  | "sparkles" | "settings";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconName;
  /** Visível apenas para o perfil master (ex.: Configurações). */
  apenasMaster?: boolean;
  /** Módulo controlável por usuário (Início/Novidades/Configurações não têm). */
  modulo?: ModuloKey;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Início",        href: "/",             icon: "layout-dashboard" },
  { label: "Obras",         href: "/obras",        icon: "hard-hat",         modulo: "obras" },
  { label: "Fornecedores",  href: "/fornecedores", icon: "truck",            modulo: "fornecedores" },
  { label: "Itens",         href: "/itens",        icon: "package",          modulo: "itens" },
  { label: "Contratos",     href: "/contratos",    icon: "file-text",        modulo: "contratos" },
  { label: "Imóveis",       href: "/imoveis",      icon: "building-2",       modulo: "imoveis" },
  { label: "Vistorias",     href: "/vistorias",   icon: "clipboard-check",  modulo: "vistorias" },
  { label: "Financeiro",    href: "/financeiro",   icon: "wallet",           modulo: "financeiro" },
  { label: "Relatórios",    href: "/relatorios",   icon: "bar-chart-3",      modulo: "relatorios" },
  { label: "Novidades",     href: "/novidades",    icon: "sparkles" },
  { label: "Configurações", href: "/configuracoes",icon: "settings", apenasMaster: true },
] as const;

/** Rótulos de rotas fora do NAV (para o breadcrumb e o palette). */
export const ROTAS_EXTRA: Record<string, string> = {
  "/usuarios": "Usuários",
  "/perfil": "Meu perfil",
  "/trocar-senha": "Trocar senha",
};

/** Rótulos de segmentos de 2º/3º nível (breadcrumb). */
export const ROTULOS_SEGMENTO: Record<string, string> = {
  novo: "Novo", nova: "Nova", editar: "Editar", baixa: "Baixa",
  fluxo: "Fluxo de caixa", recorrentes: "Recorrentes",
  documentos: "Documentos", empresa: "Empresa", templates: "Templates",
  auditoria: "Auditoria",
};
```

`implementado` **sai**: grep confirma que só `sidebar.tsx:26` lê o campo, todos os 11 itens são `true`, e o branch da pill "em breve" é morto. Menos 15 linhas.

**Arquivos deletados:** `src/components/layout/sidebar.tsx` (substituído por `nav-link.tsx` + a `<nav>` inline do layout).

---

## 3. Novos arquivos de shell

### `src/components/layout/nav-icon.tsx`

```tsx
"use client";

// Lookup nome→componente Lucide. Existe para não passar componentes Lucide como
// props no boundary Server→Client (lucide-react 1.26.0 não é "use client", então
// suas exports são funções comuns e o React recusa serializá-las).

import {
  LayoutDashboard, HardHat, Truck, Package, FileText, Building2,
  ClipboardCheck, Wallet, BarChart3, Sparkles, Settings, type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "hard-hat": HardHat,
  truck: Truck,
  package: Package,
  "file-text": FileText,
  "building-2": Building2,
  "clipboard-check": ClipboardCheck,
  wallet: Wallet,
  "bar-chart-3": BarChart3,
  sparkles: Sparkles,
  settings: Settings,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
```

### `src/components/layout/nav-link.tsx`

Regra de ativo preservada do Loca (`/` só casa exato — o People não tem esse caso porque a raiz dele é `/painel`):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icon";
import type { NavIconName } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: NavIconName }) {
  const pathname = usePathname();
  // "/" só casa exato — senão o Início ficaria ativo em toda rota.
  const ativo = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      title={label}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex h-10 items-center rounded-md text-sm whitespace-nowrap",
        "transition-[background-color,color,padding]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "justify-center px-0",
        "group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-2.5",
        "group-focus-within/sidebar:justify-start group-focus-within/sidebar:gap-3 group-focus-within/sidebar:px-2.5",
        ativo
          ? "bg-primary font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <NavIcon name={icon} className="h-5 w-5 shrink-0" />
      <span className="hidden group-hover/sidebar:inline group-focus-within/sidebar:inline">{label}</span>
    </Link>
  );
}
```

Nota: o `<span>` usa `hidden`, então o rótulo não é lido por leitor de tela no estado colapsado — daí o `title`. Se quiser rigor, troque por `sr-only group-hover/sidebar:not-sr-only` (mais verboso, mesma aparência, melhor semântica). Recomendo `sr-only`.

### `src/components/layout/breadcrumb.tsx`

O do People mostra 1 nível (`Home › Módulo`). O Loca tem rotas de 3 níveis (`/configuracoes/templates/[tipo]`, `/financeiro/[id]/baixa`, `/contratos/[id]/editar`) e 3 rotas fora do NAV (`/usuarios`, `/perfil`, `/trocar-senha`) que no algoritmo do People renderizariam **só a casinha**. Precisa de mais:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import { NAV_ITEMS, ROTAS_EXTRA, ROTULOS_SEGMENTO } from "@/lib/nav";

/** Parece um id (uuid ou numérico)? Vira "Detalhe" em vez de expor a chave. */
function ehId(seg: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg) || /^\d+$/.test(seg);
}

export function Breadcrumb() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  // Raiz: item do NAV com o prefixo mais longo que casa; senão ROTAS_EXTRA.
  const raiz =
    [...NAV_ITEMS]
      .filter((n) => n.href !== "/")
      .sort((a, b) => b.href.length - a.href.length)
      .find((n) => pathname === n.href || pathname.startsWith(n.href + "/")) ??
    (() => {
      const hit = Object.keys(ROTAS_EXTRA).find(
        (h) => pathname === h || pathname.startsWith(h + "/"),
      );
      return hit ? { href: hit, label: ROTAS_EXTRA[hit] } : null;
    })();

  if (!raiz) return null;

  // Segmentos além da raiz, no máximo 2 (3 crumbs no total + casinha).
  const resto = pathname
    .slice(raiz.href.length)
    .split("/")
    .filter(Boolean)
    .map((seg) => (ehId(seg) ? "Detalhe" : (ROTULOS_SEGMENTO[seg] ?? seg)))
    .slice(0, 2);

  const trilha = [{ href: raiz.href, label: raiz.label }, ...resto.map((label) => ({ href: null, label }))];

  return (
    <nav aria-label="Trilha de navegação" className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground md:flex">
      <Link href="/" className="flex items-center hover:text-foreground" aria-label="Início">
        <Home className="h-4 w-4" />
      </Link>
      {trilha.map((c, i) => {
        const ultimo = i === trilha.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            {ultimo || !c.href ? (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate hover:text-foreground">{c.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

Casos verificados contra as 40 rotas reais: `/obras/nova` → `Obras › Nova`; `/contratos/<uuid>/editar` → `Contratos › Detalhe › Editar`; `/financeiro/fluxo` → `Financeiro › Fluxo de caixa`; `/configuracoes/templates/aluguel` → `Configurações › Templates › aluguel` (segmento desconhecido cai no cru — aceitável, ou adicione os `[tipo]` a `ROTULOS_SEGMENTO`); `/usuarios/novo` → `Usuários › Novo`.

**Cuidado:** o `raiz` de `/` é excluído do match por prefixo — sem isso, `"/".length === 1` e `pathname.startsWith("/")` casaria tudo.

### `src/components/layout/command-palette.tsx` — índice recomendado

**Recomendo nav + ações rápidas.** Justificativa: o People é um app de consulta (17 módulos, muita leitura), então indexar só páginas basta. O Loca é transacional — o trabalho diário é *"lançar um contrato"*, *"abrir vistoria"*, *"dar baixa"*. Com 11 itens de nav, um palette que só navega compete com a sidebar e não ganha. Ações elevam-no a acelerador real.

Índice: os `navVisivel` (já filtrados por módulo no server) + estas ações, cada uma condicionada ao módulo **e** ao papel via `src/lib/permissoes.ts` (`podeEditarCadastros`, `podeOperar`, `podeGerenciarFinanceiro`):

| Ação | href | Gate |
|---|---|---|
| Nova obra | `/obras/nova` | `obras` + `podeEditarCadastros` |
| Novo fornecedor | `/fornecedores/novo` | `fornecedores` + `podeEditarCadastros` |
| Novo item | `/itens/novo` | `itens` + `podeEditarCadastros` |
| Novo contrato | `/contratos/novo` | `contratos` + `podeOperar` |
| Nova vistoria | `/vistorias/nova` | `vistorias` + `podeOperar` |
| Novo imóvel | `/imoveis/novo` | `imoveis` + `podeEditarCadastros` |
| Novo lançamento | `/financeiro/novo` | `financeiro` + `podeGerenciarFinanceiro` |
| Novo usuário | `/usuarios/novo` | `podeGerenciarUsuarios` |

Não indexar registros do banco (obras/contratos por nome) nesta fase: exigiria endpoint de busca + debounce e as listas já têm `list-search.tsx`.

Melhorias sobre o People (o dele não tem nenhuma): **navegação por ↑/↓** com índice destacado, e agrupamento visual "Páginas" / "Ações". Base UI Dialog já dá trap de foco, Esc, scroll lock e restauração de foco — nada manual.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/lib/nav";
import {
  type Papel, podeEditarCadastros, podeOperar,
  podeGerenciarFinanceiro, podeGerenciarUsuarios,
} from "@/lib/permissoes";
import { cn } from "@/lib/utils";

type Entrada = { label: string; href: string; grupo: "Páginas" | "Ações" };

export function CommandPalette({ itens, papel }: { itens: readonly NavItem[]; papel: Papel }) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const router = useRouter();

  const indice = useMemo<Entrada[]>(() => {
    const liberado = (m: string) => itens.some((n) => n.modulo === m);
    const acoes: Entrada[] = [];
    const add = (label: string, href: string) => acoes.push({ label, href, grupo: "Ações" });
    if (liberado("obras") && podeEditarCadastros(papel)) add("Nova obra", "/obras/nova");
    if (liberado("fornecedores") && podeEditarCadastros(papel)) add("Novo fornecedor", "/fornecedores/novo");
    if (liberado("itens") && podeEditarCadastros(papel)) add("Novo item", "/itens/novo");
    if (liberado("contratos") && podeOperar(papel)) add("Novo contrato", "/contratos/novo");
    if (liberado("vistorias") && podeOperar(papel)) add("Nova vistoria", "/vistorias/nova");
    if (liberado("imoveis") && podeEditarCadastros(papel)) add("Novo imóvel", "/imoveis/novo");
    if (liberado("financeiro") && podeGerenciarFinanceiro(papel)) add("Novo lançamento", "/financeiro/novo");
    if (podeGerenciarUsuarios(papel)) add("Novo usuário", "/usuarios/novo");
    return [...itens.map((n) => ({ label: n.label, href: n.href, grupo: "Páginas" as const })), ...acoes];
  }, [itens, papel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return indice;
    return indice.filter((e) => e.label.toLowerCase().includes(t));
  }, [q, indice]);

  useEffect(() => setI(0), [q]);

  function ir(href: string) {
    setAberto(false);
    setQ("");
    router.push(href);
  }

  return (
    <>
      {/* Trigger desktop: falso input de busca */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border bg-muted/40 px-3
                   text-sm text-muted-foreground transition-colors hover:bg-muted
                   focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Pesquisar...</span>
        <kbd className="hidden shrink-0 items-center rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
          Ctrl K
        </kbd>
      </button>

      {/* Trigger mobile: só ícone */}
      <Button variant="ghost" size="icon-lg" aria-label="Pesquisar"
              onClick={() => setAberto(true)} className="md:hidden">
        <Search />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Pesquisar</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar páginas e ações..."
              className="h-11 border-0 shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setI((p) => Math.min(p + 1, resultados.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setI((p) => Math.max(p - 1, 0)); }
                if (e.key === "Enter" && resultados[i]) ir(resultados[i].href);
              }}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label="Resultados">
            {(["Páginas", "Ações"] as const).map((grupo) => {
              const doGrupo = resultados.filter((r) => r.grupo === grupo);
              if (doGrupo.length === 0) return null;
              return (
                <div key={grupo}>
                  <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {grupo}
                  </div>
                  {doGrupo.map((r) => {
                    const idx = resultados.indexOf(r);
                    return (
                      <button
                        key={r.href} type="button" role="option" aria-selected={idx === i}
                        onMouseEnter={() => setI(idx)} onClick={() => ir(r.href)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left text-sm",
                          idx === i ? "bg-accent text-accent-foreground" : "hover:bg-accent",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {resultados.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Nada encontrado.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Com os dois triggers dentro do mesmo componente, monta-se **uma** instância no layout (na zona central) e o `md:hidden` do botão de ícone o coloca visualmente... na zona errada. Duas opções: (a) aceitar o botão mobile na zona central com `order`/`ml-auto`, ou (b) manter os dois triggers mas extrair o estado para um contexto `PaletteProvider` no layout. Para a Fase 2 recomendo (a) simplificada: uma instância na zona central, e o container central muda para `flex flex-1 justify-end md:justify-center` — assim o botão de ícone cai à direita no mobile e o input fica centralizado no desktop. Zero duplicação, zero contexto.

### `src/components/layout/mobile-nav.tsx` — usar Base UI Dialog, não o portal manual

O `createPortal` do People existe porque o Radix Dialog não estava sendo usado ali; a causa-raiz que ele documenta (`backdrop-filter` cria containing block para `position: fixed` — Filter Effects spec) é **real e vale para o Loca**, porque o header terá `backdrop-blur`. Mas Base UI Dialog **já** portaliza para o body (`Dialog.Portal`), e de graça traz trap de foco, restauração de foco, Esc e scroll lock — que a versão do People **não tem**.

Não dá para usar `ui/dialog.tsx`: seu `DialogContent` embute `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:max-w-sm`, e `tailwind-merge` não considera `top-1/2` conflitante com `inset-y-0`, então as duas viriam e o painel ficaria torto. Montar direto sobre os primitivos:

```tsx
"use client";

// Drawer de navegação mobile — substitui o bottom-nav horizontal.
//
// Por que Base UI Dialog e não `fixed inset-0` inline: o header tem
// `backdrop-blur`, e `backdrop-filter` cria um novo containing block para
// descendentes `position: fixed` (Filter Effects spec) — um overlay declarado
// dentro do header ficaria preso nele. Dialog.Portal move o conteúdo para o
// body e resolve isso, além de dar trap/restauração de foco, Esc e scroll lock.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Menu, X, ChevronsRight } from "lucide-react";
import { SistengeLogo } from "@/components/sistenge-logo";
import { Button } from "@/components/ui/button";
import { NavIcon } from "./nav-icon";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav({ items, versao }: { items: readonly NavItem[]; versao: string }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  // Fecha ao trocar de rota (o Link não fecha o Dialog sozinho).
  useEffect(() => setAberto(false), [pathname]);

  return (
    <Dialog.Root open={aberto} onOpenChange={setAberto}>
      <Dialog.Trigger
        render={<Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Abrir menu" />}
      >
        <Menu />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm
                                    data-open:animate-in data-open:fade-in-0
                                    data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r
                     bg-card shadow-xl outline-none
                     data-open:animate-in data-open:slide-in-from-left-full
                     data-closed:animate-out data-closed:slide-out-to-left-full
                     duration-300 md:hidden"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
            <Dialog.Title className="sr-only">Navegação</Dialog.Title>
            <Link href="/" aria-label="Loca — início" className="flex items-center">
              <SistengeLogo className="h-[27px] w-auto" />
            </Link>
            <Dialog.Close render={<Button variant="ghost" size="icon-lg" aria-label="Fechar menu" />}>
              <X />
            </Dialog.Close>
          </div>

          <div className="scrollbar-sutil flex-1 overflow-y-auto p-3">
            <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
              {items.map((item) => {
                const ativo = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href} href={item.href}
                    aria-current={ativo ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                      ativo
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <Link
            href="/novidades"
            className="flex h-12 shrink-0 items-center gap-3 border-t px-4 font-mono
                       text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronsRight className="h-4 w-4 opacity-70" aria-hidden="true" />
            Loca · v{versao}
          </Link>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

`slide-in-from-left-full` / `slide-out-to-left-full` vêm de `tw-animate-css`, já instalado — não dependem da Fase 1. Se preferir a curva do People (`cubic-bezier(0.32,0.72,0,1)`), use `animate-slide-in-left` da Fase 1.

**Se você preferir espelhar o People literalmente** (`createPortal` manual): funciona, mas então adicione trap de foco e `finalFocus` você mesmo, ou aceite que o Tab escapa do drawer para trás do overlay — regressão de acessibilidade em relação ao Base UI.

### `src/components/layout/user-menu.tsx` reescrito — sim, usar `ui/dropdown-menu.tsx`

Confirmado: `dropdown-menu.tsx` (268 LOC, Base UI Menu) não é importado em nenhum lugar do repo. Usá-lo aqui (a) elimina os 30 LOC de listeners manuais de mousedown/Esc, (b) traz navegação por setas + typeahead + trap, (c) justifica um arquivo que hoje é peso morto. **Uma pegadinha:** `DropdownMenuContent` tem `w-(--anchor-width)`, que dimensiona o popup pela largura do trigger — com um avatar de 32px o menu ficaria de 32px. Passar `className="w-64"` (`tailwind-merge` resolve o conflito de grupo `w-*` a favor do último).

Signout: o contrato é `POST /auth/signout` (`src/app/auth/signout/route.ts` → `signOut()` + redirect 303). Não trocar por server action. Um `<form>` dentro de `Menu.Item` é frágil porque o item desmonta no clique; usar `closeOnClick={false}` + `requestSubmit()` num form irmão:

```tsx
"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOut, UserRound, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PAPEL_INFO, type Papel } from "@/lib/permissoes";

export function UserMenu({ nome, email, papel, versao }: {
  nome: string; email: string; papel: Papel; versao: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const iniciais = (nome || email).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu do usuário"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8"><AvatarFallback>{iniciais}</AvatarFallback></Avatar>
        </DropdownMenuTrigger>

        {/* w-64 sobrescreve o w-(--anchor-width) do DropdownMenuContent, que
            senão dimensionaria o menu pela largura do avatar (32px). */}
        <DropdownMenuContent align="end" className="w-64">
          <div className="flex flex-col px-2 py-1.5">
            <span className="truncate text-sm font-medium">{nome || email}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
            <span className="mt-1 text-xs font-medium">{PAPEL_INFO[papel]?.label ?? papel}</span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/perfil" />}>
            <UserRound /> Meu perfil
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/novidades" />}>
            <Sparkles /> Novidades
            <span className="ml-auto font-mono text-xs text-muted-foreground">v{versao}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            closeOnClick={false}
            onClick={() => formRef.current?.requestSubmit()}
          >
            <LogOut /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fora do menu: o item desmonta no clique e levaria o form com ele. */}
      <form ref={formRef} action="/auth/signout" method="post" className="hidden" />
    </>
  );
}
```

`PAPEL_LABEL` duplicado no arquivo atual (linhas 8-13) morre — `PAPEL_INFO` de `lib/permissoes.ts` é a fonte única. Nota: `papel` vira `Papel` tipado em vez de `string`.

### `src/components/back-button.tsx`

Uma mudança só: aceitar `className` para o `hidden md:inline-flex`.

```tsx
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()}
            className={className} aria-label="Voltar para a tela anterior">
      <ChevronLeft className="size-4" /> Voltar
    </Button>
  );
}
```

---

## 4. Dark mode

### Onde montar

`next-themes@0.4.6` já está no `package.json` mas nenhum `ThemeProvider` existe — `useTheme()` em `ui/sonner.tsx:8` roda **fora** de provider. Não quebra (o destructuring `{ theme = "system" }` cobre o `undefined`), mas o toast nunca segue um toggle manual.

`src/components/providers/theme-provider.tsx` (novo, cópia do People, 13 linhas) e `src/app/layout.tsx`:

```tsx
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

// ...
<html lang="pt-BR" suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
  <body className="min-h-full bg-background font-sans">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  </body>
</html>
```

Três pontos:
1. **`<Toaster/>` entra DENTRO do `ThemeProvider`.** Hoje é irmão de `{children}` (linha 54) e ficaria fora se você só envolvesse `{children}`. Sem isso, o `useTheme()` de `ui/sonner.tsx` continua sem contexto.
2. `attribute="class"` gera `<html class="dark">`, que casa com `@custom-variant dark (&:is(.dark *))` de `globals.css:5`. **Cuidado:** essa variante casa `.dark *` (descendentes), não o próprio elemento `.dark`. Como a classe fica em `<html>` e todo conteúdo é descendente, funciona — mas `dark:` aplicado ao próprio `<html>` não. A Fase 1 pode querer `@custom-variant dark (&:where(.dark, .dark *))`.
3. `disableTransitionOnChange` importa aqui porque a sidebar tem `transition-[width,box-shadow]` e o header `backdrop-blur`: sem ele, o toggle pinta um flash de transição de cor em toda a árvore.

### `ThemeToggle`

Cópia direta do People em `src/components/theme-toggle.tsx`, com duas trocas: `size="icon-lg"` (não `size="icon" className="h-9 w-9"`) e `<Sun/>` sem className (o `buttonVariants` já força `[&_svg:not([class*='size-'])]:size-4`). O placeholder pré-`mounted` é essencial — sem ele, hydration mismatch.

### Auditoria de telas que assumem light

| Arquivo | Situação | Ação |
|---|---|---|
| `src/app/login/page.tsx` | `bg-muted/40` + Card → em dark fica cinza-escuro sem intenção | Reescrito na seção 5 |
| `src/app/auth/recuperar/page.tsx`, `src/app/auth/nova-senha/page.tsx` | Mesmo `bg-muted/40` do login | Mesmo shell do login (consistência) |
| `src/app/offline/page.tsx` | Inline styles, `#64748b`, sem dark | Ver abaixo |
| `src/app/global-error.tsx` | `#f2f2f3`/`#1d1f20`/`#BE3A31` inline | Ver seção 6 |
| `src/components/bar-chart.tsx` | `bg-primary` / `bg-primary/55` | Com o primary do People, as barras ficam **preto** no light e **branco** no dark. Funciona, mas branco puro no dark é agressivo. Trocar por `bg-foreground/85` / `bg-foreground/40`, ou `bg-chart-1` / `bg-chart-1/55` se a Fase 1 definir a rampa de charts. Não usar `bg-primary` |
| `src/lib/pdf.tsx` | Só hex, zero `var(--)` | **Nada a fazer** (correção 4). Registrar em `AGENTS.md`: "PDFs nunca usam tokens de tema" |
| `src/components/sistenge-logo.tsx` | Ícone `#cf2927` fixo + wordmark em `currentColor` | Já correto em ambos os temas — vermelho só no ícone, exatamente a regra do People |

**`offline/page.tsx`:** ela é servida do cache pelo SW quando não há rede. Os inline styles são deliberados (não dependem de a folha `/_next/static/css/*.css` estar em cache). Mantenha inline, mas adicione dark via `<style>` com `prefers-color-scheme` e `color-scheme: light dark` — não use `.dark`, porque o `ThemeProvider` (que injeta a classe) pode não ter script disponível offline:

```tsx
<style>{`
  :root { color-scheme: light dark; --bg:#ffffff; --fg:#0f172a; --dim:#64748b; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b1220; --fg:#e2e8f0; --dim:#94a3b8; } }
`}</style>
```

**Ao mexer em `/offline`, bumpe `CACHE = "loca-v1"` → `"loca-v2"` em `public/sw.js:7`**, senão o `install`/`addAll` reaproveita o cache antigo e o usuário continua vendo a página velha indefinidamente.

### `[data-theme="light"]` no card do login: **sim, portar**

O People escopa **todos** os tokens em `[data-theme="light"]` (`app/globals.css:64-88`) exatamente porque, sem isso, um card visualmente branco sobre fundo escuro herda os tokens `.dark` quando o usuário está em dark mode — e aí `Input`, `Button`, `Label` ficam com contraste invertido dentro dele. O Loca tem o mesmo problema pela mesma razão. Sintaxe Tailwind v4 (não há `@layer base` obrigatório):

```css
[data-theme="light"] {
  --background: #ffffff;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #0f172a;
  --primary-foreground: #f8fafc;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: #0f172a;
  --destructive: #dc2626;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #0f172a;
}
```

(valores exatos = os de `:root` que a Fase 1 definir; isto é ilustrativo). **Uma ressalva:** o `Input` do Loca tem `dark:bg-input/30` e o `Button` tem `dark:border-input dark:bg-input/30` — variantes `dark:` são resolvidas por **seletor** (`.dark *`), não por token, então `[data-theme="light"]` **não** as desliga. Dentro do card, com `<html class="dark">`, os inputs pegariam `dark:bg-input/30` sobre tokens light. Solução: o wrapper do card precisa de `data-theme="light"` **e** de neutralizar a classe dark. O jeito limpo é adicionar em `globals.css`:

```css
[data-theme="light"] { color-scheme: light; }
```
e ajustar a variante para não vazar: `@custom-variant dark (&:is(.dark *:not([data-theme="light"] *)))`. Alternativa mais simples e que recomendo para a Fase 2: **forçar `/login` a ser sempre light**, adicionando `forcedTheme="light"` num `ThemeProvider` local — mas `next-themes` não suporta provider aninhado bem. **Recomendação final e pragmática:** manter `data-theme="light"` como o People faz e aceitar o desvio residual nos `dark:` dos inputs (visualmente pequeno: `bg-input/30` sobre `--input` light = cinza claro), **e** abrir isso como item conhecido para a Fase 1 refinar a `@custom-variant`. Verificar visualmente com o toggle em dark antes de fechar a etapa.

---

## 5. `/login` estilo People adaptado ao Loca

**Refactor prévio necessário:** `src/app/login/login-form.tsx` hoje renderiza `<Card>` + `<CardHeader>` + `<SistengeLogo>` + `<CardDescription>` (linhas 45-51). O card do People é o próprio wrapper `data-theme="light"`. Extrair: `login-form.tsx` passa a devolver **só** o `<form>` (email, senha, link "Esqueci minha senha", botão) — remover `Card*` e `SistengeLogo` dos imports. A página assume logo, headline e card. `RecuperarForm`/`NovaSenhaForm` recebem o mesmo tratamento.

Adaptação de conteúdo (Loca ≠ People):
- `bg-[#0F1115]` e o gradiente `from-[#1A1D24] via-[#0F1115] to-[#0A0C0F]`: reaproveitar **iguais** (é fundo de marketing, não token — e não deve seguir tema).
- Orbs desfocados: `bg-[#BE3A31]/10` e `/5` — o vermelho Sistenge é o mesmo nos dois projetos (`--primary` antigo do Loca é literalmente `#BE3A31`). Reaproveitar.
- Logo: `<SistengeLogo className="h-[35px] w-auto text-white" />` — o wordmark é `currentColor`, então `text-white` já resolve o fundo escuro **sem precisar de `logo-dark.svg`** (o People precisa de dois arquivos; o Loca não). Vantagem real.
- Headline: `Locação de equipamentos,` / `<span className="text-[#FF5C58]">do contrato à devolução.</span>`
- Parágrafo: "Sistema da SISTENGE Engenharia para controlar materiais e equipamentos locados em obra — contratos, medições, devoluções e financeiro num só lugar."
- Bullets (pontos `bg-[#FF5C58]`), derivados dos módulos reais:
  1. "Contratos de locação com itens, medições e devoluções rastreadas."
  2. "Vistorias de imóveis com fotos, laudo em PDF e histórico."
  3. "Financeiro com fluxo de caixa, recorrentes e relatórios."
- Rodapé esquerdo: `Loca · v{APP_VERSION}` (`APP_VERSION` de `@/lib/changelog`, não `@/lib/version`).
- Card: `data-theme="light" rounded-2xl bg-card text-card-foreground border border-white/10 shadow-2xl shadow-black/40 p-7 sm:p-8`, com "Bem-vindo de volta" / "Entre com sua conta corporativa para continuar."
- Contato do rodapé: trocar `people@sistenge.com` pelo canal do Loca (confirmar com o usuário; sugestão `ti@sistenge.com`).
- **Diferença estrutural:** a página do People lê `searchParams` sincronamente (`searchParams: { next?, erro?, reset? }`). **No Next 16 `searchParams` é uma Promise** — se você portar o bloco de avisos, precisa `async` + `await searchParams`. O `/login` do Loca hoje não usa searchParams; o fluxo de reset dele é `/auth/recuperar` + `/auth/nova-senha`. **Recomendação: não portar o bloco de avisos** nesta fase — fica fora de escopo e o Loca não tem os mesmos códigos de erro.
- PWA: `display: standalone` + login em split-screen — testar em viewport de 360×640, onde o painel esquerdo desaparece (`hidden lg:flex`) e sobra o bloco de logo mobile + card.

---

## 6. `error.tsx` / `loading.tsx` / `global-error.tsx`

### `src/app/(app)/error.tsx` (existe — alinhar)

Adotar o painel do People: `flex min-h-[60vh] items-center justify-center px-4` → `max-w-md space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6`, `AlertTriangle` + `h1` em `text-destructive`, `error.message` em `text-muted-foreground`, **`error.digest` em `font-mono`** (falta hoje), e dois botões: `reset()` com `RefreshCcw`, e voltar ao início com `Home`. Trocar o `window.location.href = "/"` atual por `<Button variant="outline" render={<Link href="/" />}>` (Base UI, não `asChild`). Manter o `console.error` do `useEffect` mas com o shape do People (`{ message, digest }`).

### Estratégia de duas camadas de loading

O `(app)/loading.tsx` atual é um skeleton genérico com `mx-auto max-w-5xl` — ele cobre **toda** navegação dentro de `(app)`, inclusive páginas `max-w-2xl`, e a forma nunca casa. Adotar a divisão do People:

- **`src/app/(app)/loading.tsx`** → simplificar para o spinner (`Loader2` `h-8 w-8 animate-spin text-muted-foreground` em `flex min-h-[60vh] items-center justify-center`). Fallback neutro que nunca "mente" sobre a forma da página.
- **`loading.tsx` por rota**, com skeleton na forma real, onde o payload é grande:

| Criar | Forma |
|---|---|
| `(app)/loading.tsx` | *reescrever* → spinner |
| `(app)/obras/loading.tsx` | header + barra de busca + 8 linhas de tabela |
| `(app)/contratos/loading.tsx` | idem |
| `(app)/fornecedores/loading.tsx` | idem |
| `(app)/itens/loading.tsx` | idem |
| `(app)/imoveis/loading.tsx` | idem |
| `(app)/vistorias/loading.tsx` | idem |
| `(app)/financeiro/loading.tsx` | KPIs (3 cards) + tabela |
| `(app)/relatorios/loading.tsx` | filtros + gráfico |
| `(app)/page.tsx` → `(app)/loading.tsx`? **não** | o dashboard `/` é o payload mais pesado (KPIs + BarChart + timeline). Criar um `loading.tsx` só para ele exige mover `/` para um grupo — **não vale**; ele herda o spinner |
| `(app)/contratos/[id]/loading.tsx` | detalhe: header + 2 colunas de blocos |
| `(app)/obras/[id]/loading.tsx` | idem |
| `(app)/vistorias/[id]/loading.tsx` | idem |

Onze arquivos novos, ~15 linhas cada. Se quiser cortar escopo: faça os 6 de lista (o ganho percebido é maior em navegação lateral) e deixe os de detalhe para depois. Extrair um `<SkeletonLista/>` e `<SkeletonDetalhe/>` em `src/components/skeletons.tsx` evita 11 cópias.

### `src/app/global-error.tsx`

Fato técnico relevante: `global-error.tsx` substitui o root layout, então **`globals.css` não é aplicada** — inline styles são obrigatórios, não uma escolha ruim. Mudanças: trocar `#BE3A31` do botão por near-black (`#0f172a` com texto `#f8fafc`), `#f2f2f3`/`#1d1f20` por `#ffffff`/`#0f172a`, adicionar `error.digest` em `font-family: ui-monospace, monospace`, e um `<style>` com `prefers-color-scheme: dark` (mesmo truque do `/offline`, pela mesma razão: sem CSS não há classe `.dark`). Manter `lang="pt-BR"` e o `console.error`.

---

## 7. Ordem de execução, verificação e riscos

### Sequência (cada etapa deve compilar e rodar sozinha)

**E0 — Verificação de pré-requisitos** (sem código). Confirmar `--card` opaco, `--radius`, `.scrollbar-sutil`, animações. Sem `--card` opaco, **pare**.

**E1 — Dark mode e root layout.** `providers/theme-provider.tsx`, `theme-toggle.tsx`, `src/app/layout.tsx` (`suppressHydrationWarning`, Provider envolvendo children **e** Toaster, `viewport.themeColor` em array). *Ainda sem tocar no shell.*
Verificar: abrir `/`, mudar o SO para dark → o app deve ficar dark; `document.documentElement.className` contém `dark`; F5 sem flash branco; um `toast.success()` (ex.: salvar em `/perfil`) sai com skin dark; nada de warning de hydration no console.

**E2 — `nav.ts` string-icon + `nav-icon.tsx`.** Só os dois arquivos + adaptar `sidebar.tsx` para usar `NavIcon` (mantendo o layout antigo). Etapa puramente mecânica, verificável isolada.
Verificar: os 11 ícones da sidebar antiga aparecem iguais; `npx tsc --noEmit` limpo (o `Record<NavIconName, LucideIcon>` pega qualquer nome esquecido em tempo de compilação).

**E3 — `nav-link.tsx` + sidebar fixed + `md:pl-[72px]`.** Reescrever `layout.tsx` mantendo o header antigo (`h-14`, `BackButton`, `UserMenu` antigo) e o bottom-nav mobile. Isola o risco de layout (R1/R2) do risco de header.
Verificar em desktop: sidebar 72px; hover expande a 240px em 200ms com sombra; ícone→wordmark em cross-fade; Tab entra na sidebar e ela expande (`focus-within`); rodapé mostra `Loca · v0.19.4` só no hover e leva a `/novidades`; `/obras` tem "Obras" ativo, `/obras/nova` **também**, `/` **não** fica ativo em `/obras`; **um único scrollbar** na janela; scroll longo (`/novidades`, `/configuracoes/auditoria`) e a sidebar não sai da tela.

**E4 — Header sticky de 3 zonas + `breadcrumb.tsx` + `user-menu.tsx` novo.** Remover o rodapé rico da sidebar (já migrado) e o wordmark mobile.
Verificar: header cola no topo com blur ao rolar `/novidades`; breadcrumb nas 6 formas de rota (`/obras`, `/obras/nova`, `/contratos/<uuid>`, `/contratos/<uuid>/editar`, `/configuracoes/templates/aluguel`, `/financeiro/fluxo`, `/usuarios/novo`) e **em `/` não renderiza nada**; UserMenu abre com 256px (não 32px — regressão do `w-(--anchor-width)`), setas navegam, Esc fecha, foco volta ao avatar, "Sair" **efetivamente desloga** e cai em `/login`.

**E5 — `command-palette.tsx`.** Verificar: Ctrl+K e ⌘+K abrem de qualquer rota; Ctrl+K de novo fecha; ↑/↓ movem o destaque; Enter navega; foco entra no input e volta ao trigger ao fechar; Tab não escapa do dialog; logado como **operador**, "Novo lançamento" e "Novo usuário" **não** aparecem; logado como usuário com `modulos = ["obras"]`, só "Obras" + as rotas sem módulo aparecem.

**E6 — `mobile-nav.tsx` + remover o bottom-nav.** Verificar em 360×640 (DevTools **e** um telefone real): hambúrguer abre o drawer da esquerda; **o drawer cobre o viewport inteiro, não fica preso no header** (é o teste do R3); overlay clicável fecha; Esc fecha; clicar num link fecha e navega; body não rola atrás; Tab circula dentro do drawer; ao fechar, o foco volta ao hambúrguer; rotação de tela para landscape ≥768px → o drawer some (`md:hidden`) e a sidebar aparece.

**E7 — `error.tsx` / `loading.tsx` / `global-error.tsx` / `/offline`** (+ bump `CACHE` do SW).
Verificar: `throw new Error("teste")` num Server Component → painel com digest em mono; `reset()` recupera; DevTools offline + reload → nova `/offline` (só depois do bump do cache e de um ciclo de update do SW); navegar entre listas → spinner/skeleton correto.

**E8 — `/login` + `/auth/recuperar` + `/auth/nova-senha`.**
Verificar: split-screen em ≥1024px; stack em mobile; card legível **com o SO em dark**; login funcional e redirect para `/`; "Esqueci minha senha" funcional.

**E9 — `bar-chart.tsx`** (tokens de chart) + varredura visual das 40 rotas em light e dark.

**E10 — Versionamento.** `AGENTS.md` exige os três pontos em sincronia: `src/lib/changelog.ts` (`APP_VERSION` + `Release` no topo, itens em linguagem de usuário), `CHANGELOG.md` e `package.json`. Um único `Release` MINOR (0.19.4 → **0.20.0**) para toda a Fase 2, com itens do tipo "novo"/"melhoria". Não esquecer: `APP_VERSION` aparece na sidebar, no drawer e no UserMenu — três lugares que a Fase 2 cria.

### Riscos

**R1 — `main` com `overflow-y-auto` × sidebar `fixed` × header `sticky`.** É o risco estrutural principal. Hoje `main` (linha 109) é o container de scroll. No modelo do People o **documento** rola. Se você mantiver `overflow-y-auto`:
- `main` vira scroll container → duas barras de rolagem (a do html e a do main), com a do html inerte;
- `sticky top-0` no header funciona (é irmão de `main`), mas o conteúdo rola "dentro de uma janela", quebrando o momentum scroll do iOS e o `scroll-into-view` de anchors;
- `min-h-dvh` na coluna + filho com scroll próprio produz a clássica barra dupla.
**Mitigação:** remover `overflow-y-auto` de `main` (já está no código proposto) e confirmar visualmente na E3 que existe **uma só** barra. Verificar também que nenhuma página assume que `main` é o scroller — grep por `scrollTo`/`scrollIntoView`/`overflow-y-auto` em `src/app/(app)` antes da E3.

**R2 — Sidebar expandida cobre o conteúdo.** `fixed` + `z-40` + `hover:w-60` com `md:pl-[72px]` fixo: no hover a sidebar sobrepõe 168px da coluna. É o padrão Linear/Vercel e o People aceita explicitamente ("Sidebar sobre o conteudo no hover"). Impacto real no Loca: tabelas largas (`/financeiro`, `/configuracoes/auditoria`) ficam parcialmente encobertas ao mirar o mouse na sidebar. Aceitar. Se incomodar, a alternativa é `md:pl-[72px] md:has-[aside:hover]:pl-60 transition-[padding]` — mas isso reflui a tabela a cada passagem do mouse, pior.

**R3 — `backdrop-filter` × `position: fixed`.** O header terá `backdrop-blur`, que cria containing block para descendentes `fixed`. Qualquer coisa `fixed`/`absolute inset-0` declarada **dentro** do header fica presa nele. Afeta: drawer mobile, palette e o popup do UserMenu. Mitigado por construção, porque os três portalizam (Base UI `Dialog.Portal` / `Menu.Portal`). **Não** declare overlays inline no header. Se houver falha visual em iOS Safari (onde `backdrop-filter` é notoriamente irregular), o fallback é `supports-backdrop-filter:` já usado — sem suporte, cai em `bg-background/95` opaco.

**R4 — PWA / service worker.** `public/sw.js` usa network-first para navegação, então o shell novo aparece no primeiro reload online: **não há risco de shell velho**. Estáticos são SWR com nomes hasheados: sem staleness. O único ponto é `PRECACHE` (`/offline` + ícones + manifest) — **precisa do bump de `CACHE`** para `/offline` novo. Verificar em modo standalone (app instalado) que o header sticky de 64px não conflita com a safe-area do iOS; se conflitar, `pt-[env(safe-area-inset-top)]` no header.

**R5 — Hydration mismatch de tema.** `suppressHydrationWarning` no `<html>` e `mounted` guard no `ThemeToggle` (e em qualquer coisa que leia `resolvedTheme`) são obrigatórios. O `SistengeLogo` do Loca **não** lê tema (usa `currentColor`), então está imune — diferente do `Logo` do People, que precisa do guard.

**R6 — `/trocar-senha` dentro de `(app)`.** No People, `/trocar-senha` fica fora do layout do dashboard; no Loca está em `src/app/(app)/trocar-senha/page.tsx`, então herda sidebar + palette + drawer. Não é falha de segurança: `src/lib/supabase/middleware.ts:70` redireciona qualquer GET de volta quando `senha_temporaria`. Mas o usuário forçado a trocar a senha vê 11 links que rebotam — UX ruim que o shell novo **amplifica** (antes o layout era menos convidativo). Recomendação: mover `trocar-senha` para um grupo próprio numa fase seguinte; nesta, registrar como conhecido.

**R7 — Fail-open do middleware.** `updateSession` é documentadamente fail-open e o filtro de nav é cosmético. A Fase 2 **não** muda isso; passar a filtrar no server (E2/E3) só melhora — antes o bundle client listava `/configuracoes` para todos. A segurança real continua sendo RLS + os predicados de `permissoes.ts` nas mutações. Não tratar o shell como controle de acesso.

**R8 — Acessibilidade da sidebar colapsada.** Rótulos escondidos em 72px são um problema de teclado, não de mouse. Mitigado com `focus-within:w-60` + `group-focus-within/sidebar:` (acréscimo nosso — o People não tem) + `title`. Verificar: `Tab` da URL até a sidebar deve expandi-la e mostrar os rótulos. Também confirmar `aria-current="page"` no item ativo e que o ring de foco é visível sobre `bg-primary` (contraste: usar `ring-inset`, como no código proposto, porque `ring-offset` sobre a borda de um item de 72px é cortado pelo `overflow-hidden` do `<aside>`).

### Arquivos por operação

**Criar (11):** `src/components/providers/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/layout/nav-icon.tsx`, `src/components/layout/nav-link.tsx`, `src/components/layout/breadcrumb.tsx`, `src/components/layout/command-palette.tsx`, `src/components/layout/mobile-nav.tsx`, `src/components/skeletons.tsx`, + os `loading.tsx` por rota (6 a 11).

**Reescrever (8):** `src/app/(app)/layout.tsx`, `src/lib/nav.ts`, `src/components/layout/user-menu.tsx`, `src/app/layout.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/loading.tsx`, `src/app/global-error.tsx`, `src/app/login/page.tsx`.

**Editar (7):** `src/app/globals.css` (`[data-theme="light"]`, revisão da `@custom-variant dark`), `src/app/login/login-form.tsx` (tirar o `Card`), `src/components/back-button.tsx` (`className`), `src/components/sistenge-logo.tsx` (+`SistengeIcon`), `src/components/bar-chart.tsx`, `src/app/offline/page.tsx`, `public/sw.js` (bump de `CACHE`), + `src/lib/changelog.ts`/`CHANGELOG.md`/`package.json`.

**Deletar (1):** `src/components/layout/sidebar.tsx`.

---

### Critical Files for Implementation
- `c:\Projetos_Sistenge\Loca\src\app\(app)\layout.tsx`
- `c:\Projetos_Sistenge\Loca\src\lib\nav.ts`
- `c:\Projetos_Sistenge\Loca\src\app\layout.tsx`
- `c:\Projetos_Sistenge\Loca\src\components\layout\user-menu.tsx`
- `c:\Projetos_Sistenge\Loca\src\app\globals.css`

Referências no People que devem ficar abertas ao lado: `C:\Projetos_Sistenge\People Plataform\sistenge-people\app\(dashboard)\layout.tsx`, `nav-items.ts`, `nav-link.tsx`, `mobile-nav.tsx`, `command-palette.tsx`, `breadcrumb.tsx` e `app\(auth)\login\page.tsx`.