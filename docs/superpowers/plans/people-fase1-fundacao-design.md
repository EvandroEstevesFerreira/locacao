I've read the real files in both projects. Here is the Phase 1 plan.

---

# FASE 1 — Fundação de design: Loca → identidade People Plataform

## 0. Correções ao briefing (fatos verificados)

Antes do plano, sete pontos do seu briefing que precisam de ajuste:

| # | Você afirmou | Realidade verificada |
|---|---|---|
| 1 | `selectClasses` duplicado em "≥4 arquivos" | **21 arquivos**, com **5 strings distintas** (`h-9 rounded-lg…`, `flex h-9 w-full…shadow-xs…`, `h-8 rounded-md…text-xs`, etc.). É a maior duplicação do repo. |
| 2 | `font-heading` é aplicado em `components/page-header.tsx` | **Não.** `src/components/page-header.tsx:16` usa só `text-4xl font-semibold tracking-tight`; o Barlow Condensed chega via a regra `h1..h6` de `globals.css:151-154`. |
| 3 | Sonner do Loca precisa receber a customização do People | **Já tem.** `src/components/ui/sonner.tsx` já usa `useTheme()` + os 5 ícones Lucide (`CircleCheckIcon`, `InfoIcon`, `TriangleAlertIcon`, `OctagonXIcon`, `Loader2Icon animate-spin`). O que está errado ali é `toastOptions.classNames = { toast: "cn-toast" }` — `.cn-toast` **não existe em nenhum lugar do projeto** (classe morta). |
| 4 | `lib/cnpj.ts` pode usar brasilapi | **Não usa.** É validação puramente local (DV mód-11 alfanumérico). O Loca **não faz nenhuma chamada externa** além de Supabase e Resend — `grep` por `fetch("http` retorna zero. Logo o `connect-src` do People precisa ser **reduzido**, não só ajustado. |
| 5 | `manifest.webmanifest` tem `theme_color: #0f172a` que precisa ser atualizado | `hsl(222.2 47.4% 11.2%)` (o `--foreground`/`--primary` do People) **é exatamente `#0F172A`**. O manifest já está correto. O mesmo vale para `src/app/offline/page.tsx` (`#64748b` = `hsl(215.4 16.3% 46.9%)` = `--muted-foreground` do People) e para `public/icons/icon.svg` (`#0f172a`). Esses três **não mudam**. |
| 6 | O vermelho `#BE3A31` é o token `--brand` do People | O comentário do People diz `#BE3A31`, mas o valor do token é `--brand: 1 68% 48%`, que resolve para **`#CE2A27`** — que é o `#cf2927` dos SVGs, não o `#BE3A31` do Manual. `#BE3A31` = `hsl(4 59% 47%)`. **Há drift no People.** Recomendo usar `#BE3A31` literal no Loca (sua decisão nº 2) e não replicar o erro. |
| 7 | `tw-animate-css` pode já oferecer `fade-in`/`slide-in-left` | Oferece `fade-in` e `slide-in-from-left` como **modificadores** de `animate-in` (setam `--tw-enter-opacity` / `--tw-enter-translate-x`), **não** como animações nomeadas. `animate-fade-in` e `animate-slide-in-left` do People precisam ser declarados. Não há colisão de nome (`fade-in` ≠ `animate-fade-in`). |

Fatos seus que confirmei e que sustentam decisões: `@import "shadcn/tailwind.css"` resolve para `node_modules/shadcn/dist/tailwind.css` e define os `@custom-variant data-open / data-closed / data-checked / data-unchecked / data-selected / data-disabled / data-active / data-horizontal / data-vertical` + utilities `no-scrollbar`, `scroll-fade-*`, `shimmer`. `dialog.tsx` usa `data-open:`/`data-closed:`, `separator.tsx` usa `data-horizontal:`/`data-vertical:`, `select.tsx` usa ambos. **O import é obrigatório e `shadcn` está em `dependencies` (não devDependencies), então sobrevive a `npm ci --omit=dev`.** ✅

E dois fatos novos que mudam decisões de design:

- **`--surface`, `--chart-1..5` e todos os `--sidebar-*` têm ZERO consumidores.** `grep -rE '(bg|text|border|ring)-sidebar'` → nenhum; `grep -rE '(bg|text|fill|stroke)-chart-'` → nenhum; `surface` só aparece nas próprias declarações.
- **As páginas do Loca já foram escritas contra o Card clássico do shadcn, não contra o Card atual.** Provas: `CardContent className="pt-6"` × **21** (só faz sentido se `CardContent` for `p-6 pt-0`), `CardHeader className="pb-2"` × **15**, `CardHeader className="flex-row items-center justify-between space-y-0"` × **5** (só faz sentido se `CardHeader` for `flex flex-col space-y-1.5`), `CardContent className="p-0"` × **12**. E `CardAction` / `CardFooter` têm **zero** call sites. Isso inverte a decisão sobre `--card-spacing` (ver §3.2).

---

## 1. `src/app/globals.css` reescrito

### 1.1 Formato dos valores: cores completas, não triplets

**Decisão: `hsl(...)` completo, nunca triplet cru.** Justificativa mecânica:

No Tailwind v4, `bg-success/10` compila para
```css
background-color: color-mix(in oklab, var(--color-success) 10%, transparent);
```
`color-mix()` exige um `<color>` válido no primeiro termo. `--success: 142 71% 36%` (triplet) faz o `color-mix` ser inválido e a declaração inteira é descartada — `bg-success/10` **silenciosamente não pinta nada**. Isso quebraria: `bg-success/10`, `text-brand`, `border-destructive/30`, `bg-destructive/10`, `bg-muted/50`, `bg-warning/10`, `bg-info/10`, `hover:bg-primary/90`, `ring-ring/50`, `bg-input/30`, `ring-destructive/20` — ou seja, praticamente todo o vocabulário dos 14 primitivos e dos novos compartilhados.

Confirmação empírica no próprio Loca: hoje `--primary: #BE3A31` (cor completa) e `hover:bg-primary/80` funciona; `--border: color-mix(in srgb, …)` também funciona. O mecanismo é o mesmo.

**Manter `@theme inline`** (não `@theme`). Com `inline`, `bg-primary` emite `background-color: var(--primary)` — é isso que permite que `:root` / `.dark` / `[data-theme="light"]` sobrescrevam em cascata. Com `@theme` puro o valor seria capturado no root e `.dark` não propagaria.

### 1.2 Arquivo alvo completo

```css
@import "tailwindcss";
@import "tw-animate-css";
/* Obrigatório: fornece os @custom-variant data-open/data-closed/data-checked/
   data-horizontal/data-vertical que TODOS os primitivos Base UI usam
   (dialog, select, separator, avatar). Não remover. */
@import "shadcn/tailwind.css";

/* Variante dark ciente de escopo: um subtree marcado [data-theme="light"]
   dentro de .dark NÃO deve receber utilities dark:. O People sofre com isso
   (precisa evitar `dark:` manualmente nas regiões forçadas — ver comentário
   em app/(public)/carreiras/cadastro/form.tsx:189). Resolvemos no seletor. */
@custom-variant dark (&:is(.dark *):not(:is([data-theme="light"] *)));

@theme inline {
  /* ── Tipografia ───────────────────────────────────────────────── */
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);

  /* ── Superfícies ──────────────────────────────────────────────── */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);

  /* ── Primary + neutros ────────────────────────────────────────── */
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);

  /* ── Status ───────────────────────────────────────────────────── */
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);

  /* ── Marca ────────────────────────────────────────────────────── */
  /* Vermelho oficial Sistenge. USO RESTRITO: logo e badges de
     "crítico/urgente". NÃO usar em CTAs, links ou estados de foco. */
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);

  /* ── Bordas / inputs / foco ───────────────────────────────────── */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* ── Séries de gráfico (categórica, ver §1.5) ─────────────────── */
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  /* ── Raio: escala derivada estilo People (subtrativa, não
        multiplicativa). --radius = 0.625rem = 10px.
        xs 4px · sm 6px · md 8px · lg 10px · xl 14px               */
  --radius-xs: calc(var(--radius) - 6px);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  /* 2xl/3xl/4xl ficam nos defaults do Tailwind v4 (1rem/1.5rem/2rem).
     Após esta fase nenhum arquivo do Loca usa rounded-4xl (o badge migra
     para rounded-full). */

  /* ── Animações ────────────────────────────────────────────────── */
  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-slide-in-left: slide-in-left 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  --animate-progress-indeterminate:
    progress-indeterminate 1.4s ease-in-out infinite;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-in-left {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }
  @keyframes progress-indeterminate {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Design System Sistenge (alinhado ao Sistenge People)
   - Primary: preto/cinza profundo slate-900 (#0F172A)
   - Neutros: rampa slate
   - Cards brancos com shadow-sm sobre fundo branco/quase-branco
   - Marca: vermelho #BE3A31 restrito a logo e badges de crítico
   - Tipografia: Inter (sans) + JetBrains Mono (mono/tabular)
   Valores em hsl() COMPLETO (não triplet): o Tailwind v4 compila
   `bg-x/10` para color-mix(), que exige um <color> válido.
   ═══════════════════════════════════════════════════════════════════ */
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 47.4% 11.2%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222.2 47.4% 11.2%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222.2 47.4% 11.2%);

  --primary: hsl(222.2 47.4% 11.2%);
  --primary-foreground: hsl(210 40% 98%);

  --secondary: hsl(210 40% 96.1%);
  --secondary-foreground: hsl(222.2 47.4% 11.2%);
  --muted: hsl(210 40% 96.1%);
  --muted-foreground: hsl(215.4 16.3% 46.9%);
  --accent: hsl(210 40% 96.1%);
  --accent-foreground: hsl(222.2 47.4% 11.2%);

  --destructive: hsl(0 72% 51%);
  --destructive-foreground: hsl(0 0% 98%);
  --success: hsl(142 71% 36%);
  --success-foreground: hsl(0 0% 98%);
  --warning: hsl(38 92% 50%);
  --warning-foreground: hsl(0 0% 98%);
  --info: hsl(199 89% 48%);
  --info-foreground: hsl(0 0% 98%);

  /* #BE3A31 — vermelho oficial do Manual de Identidade Visual.
     (O People usa `1 68% 48%` ≈ #CE2A27, que é o vermelho dos SVGs,
      não o do Manual. Aqui usamos o valor correto.) */
  --brand: hsl(4 59% 47%);
  --brand-foreground: hsl(0 0% 100%);

  --border: hsl(214.3 31.8% 91.4%);
  --input: hsl(214.3 31.8% 91.4%);
  --ring: hsl(222.2 47.4% 11.2%);

  --radius: 0.625rem;

  --chart-1: hsl(222.2 47.4% 11.2%);
  --chart-2: hsl(199 89% 48%);
  --chart-3: hsl(142 71% 36%);
  --chart-4: hsl(38 92% 50%);
  --chart-5: hsl(215.4 16.3% 46.9%);
}

/* Força tokens light dentro de uma região específica (ex.: card branco
   sobre hero escuro no /login). Duplica :root de propósito. Com o
   @custom-variant dark ciente de escopo (topo do arquivo), utilities
   `dark:` também são neutralizadas aqui. */
[data-theme="light"] {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 47.4% 11.2%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222.2 47.4% 11.2%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222.2 47.4% 11.2%);
  --primary: hsl(222.2 47.4% 11.2%);
  --primary-foreground: hsl(210 40% 98%);
  --secondary: hsl(210 40% 96.1%);
  --secondary-foreground: hsl(222.2 47.4% 11.2%);
  --muted: hsl(210 40% 96.1%);
  --muted-foreground: hsl(215.4 16.3% 46.9%);
  --accent: hsl(210 40% 96.1%);
  --accent-foreground: hsl(222.2 47.4% 11.2%);
  --destructive: hsl(0 72% 51%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: hsl(214.3 31.8% 91.4%);
  --input: hsl(214.3 31.8% 91.4%);
  --ring: hsl(222.2 47.4% 11.2%);
}

/* Dark: elevação por luminosidade — o card é MAIS CLARO que o fundo. */
.dark {
  --background: hsl(222.2 47% 5%);
  --foreground: hsl(210 40% 98%);
  --card: hsl(222.2 47% 8%);
  --card-foreground: hsl(210 40% 98%);
  --popover: hsl(222.2 47% 8%);
  --popover-foreground: hsl(210 40% 98%);

  /* Primary invertido — branco sobre fundo escuro */
  --primary: hsl(210 40% 98%);
  --primary-foreground: hsl(222.2 47.4% 11.2%);

  --secondary: hsl(217.2 32.6% 14%);
  --secondary-foreground: hsl(210 40% 98%);
  --muted: hsl(217.2 32.6% 14%);
  --muted-foreground: hsl(215 20.2% 65.1%);
  --accent: hsl(217.2 32.6% 14%);
  --accent-foreground: hsl(210 40% 98%);

  --destructive: hsl(0 62.8% 50%);
  --destructive-foreground: hsl(210 40% 98%);
  --success: hsl(142 71% 45%);
  --success-foreground: hsl(0 0% 98%);
  --warning: hsl(38 92% 55%);
  --warning-foreground: hsl(0 0% 98%);
  --info: hsl(199 89% 55%);
  --info-foreground: hsl(0 0% 98%);

  --brand: hsl(0 84% 60%);
  --brand-foreground: hsl(0 0% 100%);

  --border: hsl(217.2 32.6% 17.5%);
  --input: hsl(217.2 32.6% 17.5%);
  --ring: hsl(212.7 26.8% 83.9%);

  --chart-1: hsl(210 40% 98%);
  --chart-2: hsl(199 89% 55%);
  --chart-3: hsl(142 71% 45%);
  --chart-4: hsl(38 92% 55%);
  --chart-5: hsl(215 20.2% 65.1%);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  html {
    @apply font-sans;
  }
  code, kbd, samp, pre {
    font-family: var(--font-mono), ui-monospace, SFMono-Regular, monospace;
  }
}

/* ── Tabelas: números alinhados em colunas ──────────────────────── */
table tbody td.font-mono,
table tbody td .font-mono {
  font-variant-numeric: tabular-nums;
}

/* ── Scrollbar discreta global ──────────────────────────────────── */
/* Atenção: os tokens já são cores completas — NÃO envolver em hsl()
   como faz o People (lá os tokens são triplets). */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--muted); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklab, var(--muted-foreground) 50%, transparent);
}

/* ── scrollbar-sutil: quase invisível, aparece no hover do pai.
      Usar em painéis estreitos (sidebar, listas internas). ─────── */
@utility scrollbar-sutil {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 200ms ease;

  &:hover {
    scrollbar-color:
      color-mix(in oklab, var(--muted-foreground) 25%, transparent) transparent;
  }
  &::-webkit-scrollbar { width: 6px; height: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 9999px;
    transition: background-color 200ms ease;
  }
  &:hover::-webkit-scrollbar-thumb {
    background: color-mix(in oklab, var(--muted-foreground) 20%, transparent);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklab, var(--muted-foreground) 40%, transparent);
  }
}
```

### 1.3 O que **remover** explicitamente

| Remover | Por quê |
|---|---|
| `.blueprint` + `.blueprint > .corner*` (`globals.css:157-180`) | motivo visual do Loca; sai junto com os 4 `<i class="corner">` do Card |
| `.eyebrow` (`globals.css:182-188`) | idem. **Atenção:** `eyebrow` em `src/lib/pdf.tsx` e `src/lib/templates.ts` é um conceito de PDF (`documentoInfo().eyebrow`), **sem relação** — não tocar |
| regra `h1,h2,…,h6 { font-family: Barlow Condensed; letter-spacing: -0.015em }` | tipografia via componente (`tracking-tight` em `PageHeader`/`CardTitle`), como no People |
| `font-family: var(--font-barlow)` dentro de `body` | substituído por `@apply font-sans` em `html` + `--font-sans: var(--font-inter)` |
| `--font-heading` (token) | ver §2 |
| `--surface` (light + dark) | 0 consumidores |
| `--accent-300/600/700/800`, `--neutral-100/200/300` | 0 consumidores; rampa vermelha morta |
| **todos** os `--sidebar-*` (8 tokens × 2 escopos) e os 8 `--color-sidebar-*` do `@theme` | 0 consumidores. A sidebar do Loca (`(app)/layout.tsx:39`) usa `bg-card`/`border-r` — nunca `bg-sidebar` |
| escala `--radius-sm/md/lg/xl/2xl/3xl/4xl` multiplicativa (`* 0.6 … * 2.6`) | substituída pela subtrativa estilo People |
| `--radius: 0px` | → `0.625rem` |
| `--chart-1..5` rampa monocromática vermelha | substituída pela categórica de §1.5 |

### 1.4 O que **não portar** do People

- **`[data-radix-popper-content-wrapper] > *`** (`People globals.css:150-158`): esse wrapper é gerado pelo `@radix-ui/react-popper`. Base UI usa `Select.Positioner` / `Dialog.Portal`, que renderizam um `div` comum **sem** esse atributo — o seletor nunca casaria. E o equivalente é desnecessário: `select.tsx:86` já tem `bg-popover text-popover-foreground` e `select.tsx:120` já tem `focus:bg-accent focus:text-accent-foreground` diretamente no `SelectItem`. **Não criar substituto.** Se um dia aparecer um popup translúcido, o alvo correto é `[data-slot="select-content"], [data-slot="dropdown-menu-content"]`.
- **`table tbody tr { transition: background-color 120ms ease }`**: redundante — `TableRow` (`table.tsx:60`) já tem `transition-colors`.

### 1.5 Nova paleta de gráfico

O `BarChart` atual (`src/components/bar-chart.tsx:38`) é **série única** e usa `bg-primary` / `bg-primary/55`. Nenhum arquivo consome `--chart-*`. Duas saídas:

- **Mínima (defensável):** apagar `--chart-1..5` e os 5 `--color-chart-*`. Reintroduzir quando existir um gráfico multi-série.
- **Recomendada:** manter 5 tokens, mas **categóricos e derivados das famílias de status**, para que qualquer uso futuro já nasça na identidade (valores no bloco acima): `chart-1` = slate-900 (série principal, igual ao `bg-primary` que o BarChart já usa), `chart-2` = info, `chart-3` = success, `chart-4` = warning, `chart-5` = slate-500 (residual/"outros"). Em `.dark`, `chart-1` inverte para slate-50 e os demais sobem de luminosidade, exatamente como as famílias de status.

Escolhi a recomendada acima porque custa 10 linhas e evita que a próxima pessoa invente uma paleta ad-hoc. `bar-chart.tsx` **não muda nesta fase** (continua `bg-primary`, que passa a ser slate-900 — barras preto-cinza sobre card branco: o look do People).

---

## 2. Fontes

### 2.1 `src/app/layout.tsx`

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
```
e
```tsx
<html
  lang="pt-BR"
  suppressHydrationWarning
  className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
>
  <body className="min-h-full">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
    <Toaster richColors position="top-right" />
  </body>
</html>
```

**Divergência deliberada do People:** o People nomeia as variáveis `--font-sans` e `--font-mono` diretamente (`app/layout.tsx:8,14`). Isso funciona no v3 porque `tailwind.config.ts` faz `sans: ["var(--font-sans)"]`. No v4 isso criaria `@theme inline { --font-sans: var(--font-sans) }` — **auto-referência circular**. Por isso os nomes `--font-inter` / `--font-jetbrains-mono`, mapeados no `@theme`. Vale um comentário no arquivo explicando, senão alguém "conserta" para o padrão People e quebra a fonte.

**Também nesse arquivo:** `suppressHydrationWarning` no `<html>` é obrigatório com `next-themes` (o script injetado muda a `className`); `viewport.themeColor` de `"#BE3A31"` → `"#0F172A"` (ver §7); manter o `<Toaster />` no root (o People **nunca monta o dele** — não copiar essa falha).

### 2.2 `--font-heading`: **remover o token e as classes**

Não remapear para Inter. Um alias `font-heading → Inter` seria um no-op que mente sobre a intenção e apodrece: a próxima pessoa vai supor que existe uma fonte de display. E o custo de remover é trivial — **9 ocorrências da classe**:

| Arquivo:linha | Trecho atual | Ação |
|---|---|---|
| `src/components/ui/button.tsx:7` | `bg-clip-padding font-heading text-sm` | remover `font-heading` |
| `src/components/ui/card.tsx:48` | `font-heading text-base leading-snug font-medium` | vira `text-2xl font-semibold leading-none tracking-tight` (§3.2) |
| `src/components/ui/dialog.tsx:125` | `font-heading text-base leading-none font-medium` | vira `text-lg font-semibold leading-none tracking-tight` (§3.7) |
| `src/app/(app)/error.tsx:24` | `font-heading text-2xl font-semibold` | `text-2xl font-semibold tracking-tight` |
| `src/app/(app)/layout.tsx:41` | `font-heading text-xl leading-none font-semibold tracking-wide` | substituído pelo `<Logo />` (§5.7) |
| `src/app/(app)/layout.tsx:97` | `font-heading text-lg font-semibold tracking-wide md:hidden` | substituído pelo `<Logo variant="icon" />` |
| `src/app/(app)/page.tsx:175` | `font-heading text-5xl leading-none font-semibold` | `text-2xl font-semibold tracking-tight tabular-nums` (vira `KpiCard`, §5.4) |
| `src/app/(app)/financeiro/fluxo/page.tsx:61` | `font-heading text-4xl leading-none font-semibold` | `text-2xl font-semibold tracking-tight tabular-nums` |
| `src/app/(app)/financeiro/fluxo/page.tsx:73` | idem | idem |

Mais o token em `globals.css:12` e a regra `h1..h6` em `globals.css:151-154`.

**Efeito colateral da remoção da regra `h1..h6`:** o `<h1 className="text-4xl font-semibold tracking-tight">` de `page-header.tsx:16` perde o Barlow Condensed **e** o `letter-spacing: -0.015em`. Como o `PageHeader` é reescrito na §5.2 para `text-xl sm:text-2xl font-semibold tracking-tight`, isso está coberto. Nenhum outro `<h1>`–`<h6>` do Loca depende dessa regra para tamanho (só para família).

---

## 3. Os 14 primitivos em `src/components/ui/`

**Princípio transversal:** trocamos **cor, raio, densidade e peso tipográfico**; mantemos **a API Base UI** (`render=`, `data-open:`, `useRender`, `data-slot`) e **o tratamento de foco base-nova** (`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`) em vez do `ring-2 ring-offset-2` do People. Justificativa: o anel inset de 3px é mecanismo de acessibilidade, não identidade; é consistente nos 14 arquivos; e o padrão do People exige `ring-offset-background` em todo lugar, o que é 14 arquivos de churn por zero ganho visual. **Documentar esse desvio** no topo de `button.tsx`.

Também mantemos as regras `aria-invalid:` (base-nova) — o People não tem equivalente e elas são úteis nos 119 `<Input>`.

### 3.1 `button.tsx`

Base (linha 7) — três mudanças: `rounded-lg` → `rounded-md`, remover `font-heading`, remover `active:not-aria-[haspopup]:translate-y-px`:

```
"group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
```

O `active:translate-y-px` sai: é o único elemento de "press físico" do Loca e briga com o flat do People.

Variants:
```ts
default: "bg-primary text-primary-foreground hover:bg-primary/90",   // /80 → /90
destructive:                                                         // tonal → SÓLIDO
  "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/40",
outline / secondary / ghost / link: inalterados
```
`outline`/`ghost` usam `hover:bg-muted hover:text-foreground` e o People usa `hover:bg-accent hover:text-accent-foreground`. Como `--accent` e `--muted` têm **valor idêntico** nos dois temas (`210 40% 96.1%` / `217.2 32.6% 14%`), é cosmeticamente indistinguível. **Não mexer** — 0 ganho, risco de typo.

Sizes — retunados para a escala People preservando o ramp de ícone:
```ts
default:      "h-10 gap-2 px-4 py-2 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
xs:           "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
sm:           "h-9 gap-1.5 rounded-md px-3",
lg:           "h-11 gap-2 rounded-md px-8",
icon:         "size-10",
"icon-xs":    "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
"icon-sm":    "size-9 rounded-md",
"icon-lg":    "size-11",
```
Note que os hacks `rounded-[min(var(--radius-md),10px)]` e `in-data-[slot=button-group]:rounded-lg` saem: existiam para compensar `--radius: 0px`.

**Impacto medido nos call sites** (contagem exata via `grep -rhoE 'size="…"'`):
- `size="sm"` — **32 ocorrências em 20 arquivos**. `h-7 → h-9` (+2px de padding-x). Aparecem quase todos em toolbars de listagem e ações de linha de tabela. Como `TableCell` também vai de `p-2` para `p-4`, os dois crescem juntos — visualmente coerente.
- `size="icon-sm"` — **15 ocorrências**, incluindo `dialog.tsx:69` (botão de fechar). `size-7 → size-9`. Isso é exatamente o `h-9 w-9` que o People usa nos ícones de header. Bom sinal.
- `size="xs"`, `size="lg"`, `size="icon"`, `size="icon-xs"`, `size="icon-lg"` — **zero** ocorrências.
- Único size dinâmico: `src/components/confirm-delete.tsx:47` `size={rotulo ? "default" : "icon-sm"}` — esse arquivo é **substituído** pelo `ConfirmDialog` (§5.5).
- `variant="destructive"` em `<Button>`: **1** (`src/app/(app)/imoveis/contrato-imovel-acoes.tsx:180`). Vira botão vermelho sólido. Verificar essa tela.

### 3.2 `card.tsx` — **adotar o modelo People inteiro, aposentar `--card-spacing`**

Esta é a decisão que eu invertei em relação ao seu briefing, com base nos dados. Você sugeriu manter `--card-spacing`. Mas os call sites do Loca **já foram escritos contra o Card clássico**:

- `CardContent className="pt-6"` × **21** — só é idiomático se `CardContent` for `p-6 pt-0`. No modelo atual (`px-(--card-spacing)`, sem py) resulta em `px-4 pt-6`, um híbrido sem sentido.
- `CardHeader className="flex-row items-center justify-between space-y-0"` × **5** — só é idiomático se `CardHeader` for `flex flex-col space-y-1.5`. O `CardHeader` atual é `grid`, então `flex-row`/`space-y-0` são inertes.
- `CardHeader className="pb-2"` × **15** e `CardContent className="p-0"` × **12** — funcionam nos dois modelos.
- `<CardAction>` e `<CardFooter>`: **zero** call sites → nada depende de `has-data-[slot=card-footer]:pb-0` nem do grid `has-data-[slot=card-action]`.
- Todos os **42** `<CardTitle>` passam className com `text-*` explícito → o tamanho base do `CardTitle` é irrelevante na prática.

Ou seja: migrar para o People **conserta 26 call sites** que hoje são no-ops ou híbridos, e mata a complexidade de `[--card-spacing]` / `data-size` / `has-data-[slot=…]` de uma vez. O `--card-spacing` era um sistema construído para o `--radius: 0px` + `bg-transparent` que estamos removendo.

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

Mudanças em resumo: fora `.blueprint`, fora os 4 `<i className="corner">`, fora a prop `size?: "default" | "sm"` (0 call sites), fora `CardAction` (0 call sites, remover do export), fora `--card-spacing` / `gap-(--card-spacing)` / `py-(--card-spacing)` / `rounded-t-xl` / `rounded-b-xl` / `border-t bg-muted/50` no footer; entra `rounded-lg bg-card shadow-sm` + `p-6`.

**Consequências a verificar:**
- Os **12** `<CardContent className="p-0">` (tabelas) agora ficam **flush** com a borda do card, porque o `Card` deixa de ter `py-4`. Esse é exatamente o `<div className="rounded-md border">` do People, e o Loca ganha de graça — não precisa introduzir esse wrapper.
- Os **21** `<CardContent className="pt-6">` viram `p-6` (correto, o objetivo original).
- Os ~25 `<CardContent>` e ~21 `<CardHeader>` **sem** className vão de padding 16px para 24px. É o aumento de respiro que caracteriza o People. Intencional.
- Os **7** `<Card className="border-dashed">` são estados vazios → substituídos por `<EmptyState>` (§5.3).
- Os 6 `<Card className="order-N">` continuam funcionando (`order-*` age no filho de um flex/grid pai).

### 3.3 `table.tsx`

```
TableHead: "h-12 px-4 text-left align-middle font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0"
TableCell: "p-4 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0"
```
Sai: `h-10`, `px-2`, `text-xs`, `tracking-wider`, `uppercase`; `p-2`.
Fica (desvio deliberado do People): `whitespace-nowrap` em ambos, e o wrapper `overflow-x-auto` (o People usa `overflow-auto`, que também permite scroll vertical e pode clipar dropdowns).

**Este é o maior risco visual da fase.** `p-2 → p-4` dobra a altura de linha e, com `whitespace-nowrap`, alarga as tabelas → mais scroll horizontal. As 12 telas de tabela a inspecionar: `/contratos`, `/financeiro`, `/financeiro/fluxo`, `/imoveis`, `/imoveis/[id]`, `/itens`, `/obras`, `/fornecedores`, `/usuarios`, `/vistorias`, `/relatorios`, `/configuracoes/auditoria`. **Fallback se ficar largo demais:** `TableHead px-3` + `TableCell p-3` (compromisso), mantendo `h-12`. Decidir olhando `/contratos` (7 colunas) e `/relatorios`.

`TableRow`, `TableHeader`, `TableBody`, `TableFooter`, `TableCaption`: **inalterados** — já são idênticos ao People (`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted`; o `has-aria-expanded:bg-muted/50` extra do Loca é útil, manter).

### 3.4 `input.tsx`

```
"h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
```
`h-8 → h-10`, `rounded-lg → rounded-md`, `px-2.5 → px-3`, `py-1 → py-2`, `file:h-6 → file:h-7`.

**Desvio deliberado:** manter `bg-transparent` + `dark:bg-input/30` em vez do `bg-background` do People. Motivo: no dark do People o `--card` (8%) é **mais claro** que o `--background` (5%); um input `bg-background` dentro de um card fica mais escuro que o card, e o Loca tem 119 inputs quase todos dentro de cards. O `bg-transparent` + tint sutil lê melhor. **Comentar essa decisão no arquivo.**

**Impacto: 119 `<Input>`.** É a mudança de maior alcance numérico da fase, mas totalmente uniforme (+2px de altura, +2px de padding). Ver §8.

### 3.5 `textarea.tsx`

```
"flex field-sizing-content min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ..."
```
`min-h-16 → min-h-20` (= `min-h-[80px]` do People), `rounded-lg → rounded-md`, `px-2.5 → px-3`. Manter `field-sizing-content` (o People não tem; é melhor). **12 call sites.**

### 3.6 `badge.tsx`

Reduzir para os 4 variants do People — `ghost` e `link` têm **zero** call sites (`grep 'Badge variant="ghost\|link"'` → nada). Os 4 que os mapas de domínio precisam (`default | secondary | outline | destructive`) ficam. Confirmei os mapas: `STATUS_CONTRATO` (`lib/locacao.ts:14-21`, usa default/secondary/outline), `TIPO_MUDANCA_INFO` (`lib/changelog.ts:20-28`, usa os 4). Há **17** `<Badge variant={…}>` dinâmicos alimentados por esses mapas — nenhum quebra.

Base:
```
"group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!"
```
`rounded-4xl → rounded-full`, `h-5` removido (o `py-0.5` do People dá a altura), `px-2 → px-2.5`, `font-medium → font-semibold`.

Variants:
```ts
default:     "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
secondary:   "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
destructive: "bg-destructive text-destructive-foreground [a]:hover:bg-destructive/80",  // SÓLIDO
outline:     "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
```
Manter a API `useRender` / `render`. **3 `<Badge variant="destructive">` explícitos** (`contratos/[id]/page.tsx:394,563`, `vistorias/page.tsx:130`) + o `seguranca` de `/novidades` viram vermelho sólido em vez de vermelho tonal — inspecionar.

**Nova capacidade para a Fase 2:** com `--brand` disponível, badges de "crítico/urgente" podem usar `bg-brand text-brand-foreground` — mas **não adicionar um variant `brand` na Fase 1** (não há caso de uso ainda; e o People restringe o uso por comentário, não por variant).

### 3.7 `dialog.tsx`

- `DialogOverlay`: `bg-black/10 … backdrop-blur-xs` → `bg-black/50` (o `bg-black/80` do People é pesado demais; `/50` fica entre os dois e ainda lê como modal). Manter as variantes `data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`.
- `DialogContent` (linha 56): `rounded-xl → rounded-lg`, `p-4 → p-6`, `ring-1 ring-foreground/10 → border shadow-lg`, `sm:max-w-sm → sm:max-w-lg`. Manter `data-open:`/`data-closed:` e a estrutura `DialogPortal > DialogOverlay > DialogPrimitive.Popup`.
- Botão de fechar (linha 68): `top-2 right-2 → top-4 right-4`; `size="icon-sm"` agora é `size-9` (mantém).
- `DialogHeader`: `flex flex-col gap-2` → `flex flex-col space-y-1.5 text-center sm:text-left`.
- `DialogFooter`: **remover o motivo Loca** `-mx-4 -mb-4 … rounded-b-xl border-t bg-muted/50 p-4` → `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end` (People). Necessário porque o novo `ConfirmDialog` (§5.5) usa `DialogFooter` e a barra cinza não existe no People.
- `DialogTitle` (linha 125): `font-heading text-base leading-none font-medium` → `text-lg font-semibold leading-none tracking-tight`.
- `DialogDescription`: inalterado.

### 3.8 `sonner.tsx`

Já está 95% no lugar (correção nº 3). Mudanças:
- Remover `toastOptions={{ classNames: { toast: "cn-toast" } }}` — `.cn-toast` não existe em nenhum arquivo (classe morta).
- Manter o mapeamento por CSS vars (`--normal-bg: var(--popover)` etc.), que é a API moderna do sonner e superior aos hacks `group-[.toaster]:` do People. Adicionar `--normal-border` já presente. **Não portar** as `classNames` do People.
- `useTheme()` → passar a usar `resolvedTheme` em vez de `theme`? Não: `theme` pode ser `"system"` e o sonner trata `"system"` nativamente. **Manter `theme`.**
- Cuidado com `richColors` (setado em `layout.tsx:54`): com `richColors`, success/error usam a paleta interna do sonner, não os tokens. Se quiser fidelidade total, adicionar `"--success-bg": "var(--success)"`, `"--error-bg": "var(--destructive)"` etc. no `style`. **Opcional** — anotar como follow-up, não bloqueia a fase.

### 3.9 `label.tsx`, `separator.tsx`, `avatar.tsx` — **sem mudanças**

- `label.tsx`: `text-sm leading-none font-medium` já é o People (`text-sm font-medium leading-none`). O `group-data-[disabled=true]` extra do base-nova é útil.
- `separator.tsx`: `bg-border` + `data-horizontal:`/`data-vertical:` — equivalente ao People; depende dos custom variants do `shadcn/tailwind.css`.
- `avatar.tsx`: sem equivalente no People. `rounded-full`, `bg-muted`, `size-8` já são neutros. O `after:mix-blend-darken` / `dark:after:mix-blend-lighten` funciona sobre `bg-card` opaco (hoje o card é `transparent`, então isso na prática **melhora**). Único uso: `layout/user-menu.tsx:65`. Deixar.

### 3.10 `dropdown-menu.tsx` (268 LOC) e `select.tsx` — **zero imports**

Confirmei: `grep -rn 'components/ui/dropdown-menu' src` → nada; `grep -rn 'components/ui/select' src` → nada. `layout/user-menu.tsx` implementa dropdown à mão (comentário na linha 16: "Dropdown próprio (sem Base UI Menu)").

**Recomendação: não atualizar nenhum dos dois nesta fase.** Eles não afetam nada visualmente e mexer neles é ~470 LOC de risco sem retorno. Duas alternativas:
- **(a) Deletar os dois** e re-adicionar via `npx shadcn@latest add` quando houver necessidade. Reduz superfície de manutenção e evita que alguém os "atualize" achando que estão em uso.
- **(b) Deixar como estão** com um comentário `// Não utilizado — mantido para adoção futura` no topo.

Prefiro **(a) para `dropdown-menu.tsx`** (268 LOC mortas, e `user-menu.tsx` já resolve o caso) e **(b) para `select.tsx`** (ver §4.2 — ele é a base do caminho de longo prazo).

---

## 4. Novos primitivos

### 4.1 `src/components/ui/skeleton.tsx` — criar

Direto do People, no estilo do Loca:
```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```
Consumidor imediato: `src/app/(app)/loading.tsx` (hoje existe e provavelmente é texto). Também `Suspense` fallbacks das tabelas.

### 4.2 `select` — **manter `<select>` nativo, extrair um `NativeSelect`**

Este é o item onde o caminho do People **não** transporta, e a razão é técnica, não estética.

Dos 22 arquivos com `<select>`, **4 são Server Components**: `src/app/(app)/financeiro/page.tsx`, `src/app/(app)/imoveis/page.tsx`, `src/app/(app)/relatorios/page.tsx`, `src/app/(app)/vistorias/[id]/page.tsx`. São filtros GET (`<form>` sem `action` de client, submit nativo). O `Select` do Radix/Base UI é **obrigatoriamente client** (`"use client"` no topo de ambos os arquivos) e não renderiza um `<select>` nativo — trocar exigiria transformar 4 páginas de listagem em client components ou fatiar cada filtro num componente cliente. Nos outros 18 (client), o `<select>` participa de `<form action={serverAction}>` com `name=`/`defaultValue` — o Base UI Select exige `name` + hidden input e não tem o comportamento nativo de `defaultValue` em form uncontrolled.

**Plano:**
1. Criar `src/components/ui/native-select.tsx` com uma **única** fonte de verdade, alinhada ao novo `Input` (`h-10 rounded-md px-3`):

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * <select> nativo estilizado. Server-safe de propósito: 4 páginas de
 * listagem (financeiro, imoveis, relatorios, vistorias/[id]) usam filtros
 * GET renderizados no servidor, e os 18 forms client dependem do
 * defaultValue/name nativo dentro de <form action={serverAction}>.
 * O ui/select.tsx (Base UI) exige "use client" e input hidden — não serve.
 * Antes desta versão a mesma string de classe estava duplicada em 21
 * arquivos, em 5 variações divergentes.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "flex h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent bg-[length:1rem] bg-[right_0.625rem_center] bg-no-repeat py-2 pr-9 pl-3 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
```
(chevron: usar `bg-[url(...)]` com um data-URI SVG em `currentColor`, ou um wrapper `relative` com `<ChevronDown className="pointer-events-none absolute right-3 …">` — o wrapper é mais simples de manter e funciona no dark sem duplicar o SVG. Escolher um e documentar.)

2. **Substituir as 21 declarações de `const selectClasses`** por `import { NativeSelect }` e trocar `<select className={selectClasses}>` → `<NativeSelect>`. Os dois sites com sufixo (`lancamento-form.tsx:133` `${selectClasses} max-w-48`; `financeiro/page.tsx` e `imoveis/page.tsx` sem `w-full`) passam `className="max-w-48"` / `className="w-auto"`.
3. **Manter `ui/select.tsx`** (Base UI) como está, com o comentário de (b) em §3.10, para quando houver um filtro que precise de busca/multi-seleção em client.

Isso resolve a duplicação (21 arquivos, 5 variações) sem tocar na arquitetura server-first do Loca. É o item de maior payoff por linha de código da fase.

---

## 5. Novos compartilhados em `src/components/`

### 5.1 Onde colocar: **`src/components/shared/`**

Recomendo criar o diretório, como o People. Justificativa concreta: `src/components/` tem hoje 13 arquivos soltos + `layout/` + `ui/`, misturando três categorias — primitivos de domínio genéricos (`page-header`, `pagination`, `list-search`, `sort-header`, `back-button`, `confirm-delete`, `empty…`), componentes de domínio Loca (`obra-filter`, `atividade-timeline`, `pii-text`, `bar-chart`) e infraestrutura (`sw-register`, `sistenge-logo`). Com 7 novos arquivos entrando, a raiz vira sopa.

**Estrutura alvo:**
```
src/components/
  ui/            (primitivos shadcn/Base UI — não editar por capricho)
  shared/        (compartilhados agnósticos de domínio)
    page-header.tsx
    empty-state.tsx
    kpi-card.tsx
    confirm-dialog.tsx
    theme-toggle.tsx
    logo.tsx
    progress-bar.tsx
    back-button.tsx      ← mover
    pagination.tsx       ← mover
    list-search.tsx      ← mover
    sort-header.tsx      ← mover
  layout/        (sidebar, user-menu)
  <domínio>      (obra-filter, atividade-timeline, pii-text, bar-chart, sw-register)
```
**Mas:** mover `back-button`/`pagination`/`list-search`/`sort-header` toca ~40 imports. **Recomendo fazer isso num commit separado, puramente mecânico, DEPOIS do commit visual** — ou postergar para a Fase 2. Na Fase 1, criar apenas os 7 novos em `shared/` e mover só `page-header.tsx` (que já vai ser reescrito) e deletar `confirm-delete.tsx`. Isso mantém o commit visual auditável.

### 5.2 `src/components/shared/page-header.tsx` — reescrever

O atual (`src/components/page-header.tsx`) tem prop `eyebrow` usada em **~24 páginas** e prop `children` para ações. A versão People usa `acoes`. Duas rotas:

**Recomendada — API People, migração mecânica:**
```tsx
// PageHeader — cabeçalho padrão de página interna.
// Padroniza spacing, tipografia e slot de ações. Wrap responsivo em mobile.
//
// A prop `eyebrow` (rótulo em maiúsculas no vermelho da marca) foi removida
// na v0.20: era o único uso da classe .eyebrow, um motivo visual que não
// existe na identidade Sistenge 2026. O contexto que ela carregava
// ("Locação", "Financeiro", "Configurações") passa a vir do breadcrumb /
// da navegação, não de um rótulo repetido em cada página.
//
// Uso:
//   <PageHeader
//     titulo="Contratos"
//     descricao="Contratos de locação por obra e fornecedor."
//     acoes={<Button render={<Link href="/contratos/novo" />}>Novo</Button>}
//   />

import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {titulo}
        </h1>
        {descricao && (
          <div className="mt-1 text-sm text-muted-foreground">{descricao}</div>
        )}
      </div>
      {acoes && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>
      )}
    </div>
  );
}
```
**Migração:** remover `eyebrow="…"` de 24 call sites (lista completa via `grep -rn 'eyebrow=' src/app`, excluindo os 3 de `api/**/route.tsx` que são de PDF e **não** tocam) e converter `<PageHeader …>{children}</PageHeader>` → `acoes={…}` nos ~8 sites que passam children (`/`, `/contratos`, `/imoveis`, `/imoveis/[id]`, `/itens`, `/obras`, `/usuarios`, `/vistorias`). O TypeScript pega 100% disso: `eyebrow` deixa de existir no tipo e `children` também → `npx tsc --noEmit` lista cada erro. **Rede de segurança de tipo, que compensa a ausência de testes de UI.**

Nota: `titulo` também cai de `text-4xl` para `text-xl sm:text-2xl`. É uma redução grande e intencional (o `text-4xl` em Barlow Condensed era o motivo do Loca).

### 5.3 `src/components/shared/empty-state.tsx` — criar

Portar do People com uma única adaptação: `<Button asChild><Link/></Button>` (Radix) → `<Button render={<Link/>}>` (Base UI).

```tsx
// EmptyState — estado vazio padronizado.
// Substitui os 7 blocos `<Card className="border-dashed">` + CardContent
// centralizado espalhados pelas listagens.

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: { label: string; href: string } | { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {descricao && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{descricao}</p>
      )}
      {acao && (
        <div className="mt-4">
          {"href" in acao ? (
            <Button size="sm" render={<Link href={acao.href} />}>
              {acao.label}
            </Button>
          ) : (
            <Button size="sm" onClick={acao.onClick}>
              {acao.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```
A união discriminada estreitada com `"href" in acao` é o padrão do People — manter, funciona igual.

**Nota de arquitetura:** `EmptyState` não é `"use client"`, mas o ramo `onClick` só funciona dentro de um client component. Como os 7 sites atuais (`<Card className="border-dashed">`) são todos server, na prática só o ramo `href` será usado na Fase 1. Deixar sem `"use client"` (correto: um server component pode renderizá-lo se passar só `href`).

### 5.4 `src/components/shared/kpi-card.tsx` — criar

Portar do People praticamente 1:1 (só o `Card`/`CardContent` mudam de import path, que é o mesmo). Consumidores imediatos:
- `src/app/(app)/page.tsx:162-183` — os 4 KPIs com `<Link><Card><CardHeader flex-row><CardTitle uppercase>…<CardContent><div className="font-heading text-5xl">` viram 4 `<KpiCard href icon label value />`. Mata o `font-heading text-5xl` e o `Link` externo (o `href` do KpiCard já embrulha).
- `src/app/(app)/financeiro/fluxo/page.tsx:61,73` — os dois `font-heading text-4xl`.
- Candidatos: os blocos "Pendente/Vencido" de `page.tsx:221-233`, os totais de `/relatorios`.

Manter tudo: os 6 variants via `VARIANT_STYLES`, `DeltaBadge` com `invertido`, `tabular-nums`, `href` opcional. Adaptação: `hover:border-primary/30 hover:shadow-sm` — como o `Card` agora já tem `shadow-sm`, trocar por `hover:border-primary/30 hover:shadow-md`.

O `variant="brand"` (`bg-brand/10 text-brand`) só deve ser usado em KPI de criticidade — não em CTA. Coerente com a restrição do token.

### 5.5 `src/components/shared/confirm-dialog.tsx` — criar; `components/confirm-delete.tsx` — deletar

Hoje `confirm-delete.tsx` usa `window.confirm()` (linha 31) — sem estilo, sem tema, bloqueante, e não mostra o erro no contexto (mostra num toast, linha 39). São **29 call sites em 9 arquivos**.

Portar o `ConfirmDialog` do People com a adaptação Base UI (`DialogTrigger asChild` → `render=`), e adicionar um wrapper que preserve o contrato `action(formData)` dos 29 call sites para que a migração não precise reescrever 29 chamadas de server action:

```tsx
"use client";

// ConfirmDialog — confirmação de ações destrutivas.
// Substitui window.confirm() do antigo confirm-delete.tsx: sem estilo, sem
// tema, e o motivo da recusa só aparecia num toast fora de contexto.
//
// onConfirm pode retornar:
//   - undefined / void → fecha o dialog
//   - string           → mostra como erro inline (NÃO fecha)

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  trigger, titulo, descricao,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  destrutivo = false,
  onConfirm,
}: {
  trigger: React.ReactNode;
  titulo: string;
  descricao?: React.ReactNode;
  confirmarLabel?: string;
  cancelarLabel?: string;
  destrutivo?: boolean;
  onConfirm: () => Promise<string | void> | string | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setErro(null);
  }

  async function handleConfirm() {
    setErro(null);
    setPending(true);
    try {
      const result = await onConfirm();
      if (typeof result === "string") { setErro(result); return; }
      setOpen(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelarLabel}
          </Button>
          <Button
            type="button"
            variant={destrutivo ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmarLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Ponto de atenção Base UI:** `DialogTrigger` do Base UI usa `render={<Elemento/>}`, não `asChild`. Como `trigger` chega como `ReactNode`, a conversão precisa de `render={trigger as React.ReactElement}` ou mudar a prop para `trigger: React.ReactElement`. **Prefira mudar o tipo da prop para `React.ReactElement`** — o cast é uma mentira ao TypeScript. E confirmar na doc do Base UI 1.6 se `DialogTrigger` propaga `data-open` para o filho renderizado.

**Wrapper de compatibilidade** (`src/components/shared/confirm-delete-button.tsx`), para os 29 call sites que hoje passam `action`/`id`/`hidden`/`rotulo`:
```tsx
"use client";
export function ConfirmDeleteButton({ action, id, hidden, rotulo, mensagem }: {...}) {
  return (
    <ConfirmDialog
      destrutivo
      titulo="Excluir registro?"
      descricao={mensagem ?? "Esta ação não pode ser desfeita."}
      confirmarLabel="Excluir"
      trigger={
        <Button
          type="button"
          variant={rotulo ? "outline" : "ghost"}
          size={rotulo ? "default" : "icon-sm"}
          aria-label={rotulo ? undefined : "Excluir"}
          className={rotulo ? "text-destructive" : "text-muted-foreground hover:text-destructive"}
        >
          <Trash2 />{rotulo}
        </Button>
      }
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("id", id);
        for (const [k, v] of Object.entries(hidden ?? {})) fd.set(k, v);
        const r = await action(fd);
        if (r?.error) return r.error;   // string → dialog fica aberto com o erro
      }}
    />
  );
}
```
Assim os 29 call sites mudam só o nome do import/componente (find-replace `ConfirmDelete` → `ConfirmDeleteButton`), e o erro do servidor passa a aparecer **dentro** do dialog em vez de num toast.

### 5.6 `src/components/shared/theme-toggle.tsx` — criar

Portar do People sem mudanças de lógica (o guard `mounted` com placeholder do mesmo tamanho é essencial contra hydration mismatch). Ajuste: `className="h-9 w-9"` + `size="icon"` — com o novo ramp, `size="icon-sm"` já **é** `size-9`, então:
```tsx
<Button variant="ghost" size="icon-sm" aria-label="Alternar tema" …>
  {isDark ? <Sun /> : <Moon />}
</Button>
```
(sem override de classe — mais limpo que o People, que sobrescreve `h-10 w-10` para `h-9 w-9`).

Montar em `src/app/(app)/layout.tsx`, no header (linha 100), à esquerda do `<UserMenu/>`.

**Pré-requisito:** o `<ThemeProvider>` de §2.1. Hoje `next-themes` está instalado mas **nunca é montado** (`grep` confirma: só `useTheme` em `ui/sonner.tsx`) — ou seja, `useTheme()` no sonner hoje sempre devolve o default. Sem o provider, o toggle não funciona.

### 5.7 `src/components/shared/logo.tsx` + `public/brand/`

**Copiar os 5 SVGs** de `People/public/brand/` para `Loca/public/brand/`: `icon.svg` (920×920, `fill: #be3a31`), `icon-mono-black.svg`, `icon-mono-white.svg`, `logo-light.svg` (1920×392, `.cls-1: #1c1c1c` + `.cls-2: #be3a31`), `logo-dark.svg` (`.cls-1: #ffffff` + `.cls-2: #be3a31`). São exports do material oficial — idênticos ao viewBox do `SistengeLogo` inline atual do Loca (`0 0 1920 392.19`).

Portar `logo.tsx` do People sem mudanças (usa `next/image` + `resolvedTheme` + guard `mounted`; `icon.svg` fica vermelho nos dois temas).

**Destino de `src/components/sistenge-logo.tsx`:** o `<SistengeLogo>` inline (SVG com `#cf2927` + wordmark em `currentColor`) — verificar consumidores. Se só for usado na sidebar/login, **deletar** e trocar por `<Logo/>`. **Atenção:** `src/lib/pdf.tsx` tem sua própria cópia dos paths (`LOGO_VIEWBOX`, `ICONE_VERMELHO = "#cf2927"`, `WORDMARK_COR = "#1f2933"`, linhas 21-24) porque `@react-pdf/renderer` não consome `next/image` nem CSS vars — **essa cópia fica**, mas os hexes atualizam (§7).

Substituições em `src/app/(app)/layout.tsx`:
- linha 40-45: o bloco `<div className="font-heading text-xl…">SISTENGE</div><div className="eyebrow…">Locações de obra</div>` → `<Logo variant="full" width={140} height={29} />` + (opcional) `<p className="mt-1.5 text-xs text-muted-foreground">Locações de obra</p>`.
- linha 97-99: `<span className="font-heading text-lg…md:hidden">SISTENGE</span>` → `<Logo variant="icon" width={28} height={28} className="md:hidden" />`.

### 5.8 `src/components/shared/progress-bar.tsx` — criar (opcional)

Portar do People. Depende de `--animate-progress-indeterminate` (§1.2) — mas trocar a classe arbitrária `animate-[progress-indeterminate_1.4s_ease-in-out_infinite]` por `animate-progress-indeterminate`, senão o Tailwind v4 não detecta o `@keyframes` dentro do `@theme` e tree-shaka. Consumidores potenciais: `contratos/anexo-uploader.tsx`, `imoveis/imovel-upload.tsx`, `imoveis/biblioteca-uploader.tsx`, `contratos/contrato-docs-uploader.tsx`. **Baixa prioridade** — pode ficar para a Fase 2.

---

## 6. Config a portar

### 6.1 `next.config.ts` (hoje vazio)

```ts
import type { NextConfig } from "next";

/**
 * Headers de segurança em todas as rotas. `unsafe-inline`/`unsafe-eval`
 * em script-src são necessários porque o Next injeta scripts de hidratação
 * inline; CSP estrita exigiria nonce no middleware.
 *
 * connect-src: só os serviços que o Loca realmente chama.
 *  - *.supabase.co  → @supabase/ssr + supabase-js (auth, dados, storage)
 *  - api.resend.com → src/lib/email.ts
 * O People lista brasilapi/anthropic/huggingface/upstash — nada disso é
 * usado aqui (src/lib/cnpj.ts é validação local, sem rede).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    // camera=(self): o signature-pad e o upload de fotos de vistoria
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.resend.com",
      "worker-src 'self'",          // public/sw.js (PWA)
      "manifest-src 'self'",        // public/manifest.webmanifest
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

Três divergências do People, todas verificadas:
1. `connect-src` reduzido a Supabase + Resend (correção nº 4). **Verificar antes de aplicar:** se `NEXT_PUBLIC_SUPABASE_URL` aponta para um domínio custom, adicionar; e se o storage do Supabase servir imagens de outro host, `img-src https:` já cobre.
2. `worker-src` e `manifest-src` adicionados — o Loca é PWA (`public/sw.js`, `src/components/sw-register.tsx`, `manifest.webmanifest`) e o People não é. Sem eles o service worker é bloqueado.
3. `Permissions-Policy` com `camera=(self)` em vez de `camera=()` — `src/app/(app)/vistorias/signature-pad.tsx` e os uploaders de foto podem precisar. Confirmar se algum usa `getUserMedia`; se não, deixar `camera=()`.

**Atenção operacional:** `Strict-Transport-Security` + CSP num app já em produção na Vercel — testar em preview deploy antes de merge. `X-Frame-Options: DENY` quebra qualquer embed (verificar se o PDF é servido em iframe em algum lugar).

### 6.2 `eslint.config.mjs` (flat config, ESLint 9)

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "@next/next/no-html-link-for-pages": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```
Violações atuais verificadas:
- `no-var`: **zero**.
- `eqeqeq`: todos os `==`/`!=` do repo são `== null` / `!= null` — cobertos pelo `{ null: "ignore" }`. **Zero** violações.
- `no-console`: **1 violação real** — `src/lib/logger.ts:22` `console.log(linha)`, que é intencional. Duas saídas: `// eslint-disable-next-line no-console` na linha, ou um override de arquivo permitindo `log` em `src/lib/logger.ts`. Prefiro o override (documenta que o logger é o ponto único de saída).

### 6.3 `package.json` — script `typecheck`

```json
"typecheck": "tsc --noEmit"
```
`tsconfig.json` já tem `"noEmit": true`, então funciona. **Isso é a rede de segurança principal desta fase** (§8) — sem ele, a migração do `PageHeader` e a remoção de `CardAction` não têm verificação automatizada.

### 6.4 `container` do Tailwind — **não portar**

`grep -rn 'className="container' src` → **zero** ocorrências no Loca. As páginas usam `mx-auto max-w-5xl` / `max-w-6xl` diretamente (ex.: `(app)/page.tsx:153`, `contratos/page.tsx:81`). Portar `container { center, padding: 1rem, screens: { 2xl: 1400px } }` para v4 exigiria `@utility container { … }` custom (o v4 removeu `theme.container`) — trabalho para zero consumidores. **Deixar de fora**, anotar como reconsiderável se um dia houver páginas públicas como as `/carreiras` do People.

### 6.5 `vitest.config.ts` — sem mudança nesta fase

Continua node-only. **Não** introduzir jsdom/testing-library na Fase 1: seria uma segunda fundação (deps, setup, matchers) misturada com o refactor visual. Registrar como item de Fase 2 e usar `tsc --noEmit` como rede de segurança agora.

---

## 7. Hex hard-coded: lista completa

**Valores de referência calculados** dos tokens People:

| Token | HSL | Hex |
|---|---|---|
| `--background` (light) | `0 0% 100%` | `#FFFFFF` |
| `--foreground` / `--primary` (light) | `222.2 47.4% 11.2%` | **`#0F172A`** (slate-900) |
| `--muted-foreground` (light) | `215.4 16.3% 46.9%` | **`#64748B`** (slate-500) |
| `--muted`/`--secondary`/`--accent` (light) | `210 40% 96.1%` | `#F1F5F9` (slate-100) |
| `--border`/`--input` (light) | `214.3 31.8% 91.4%` | `#E2E8F0` (slate-200) |
| `--primary-foreground` | `210 40% 98%` | `#F8FAFC` (slate-50) |
| `--destructive` (light) | `0 72% 51%` | `#DC2828` (≈ red-600) |
| `--brand` | `4 59% 47%` | **`#BE3A31`** (Manual Sistenge) |
| `--background` (dark) | `222.2 47% 5%` | `#070A13` |
| `--card`/`--popover` (dark) | `222.2 47% 8%` | `#0B111E` |

### Alterar

| Arquivo:linha | Valor atual | Valor novo | Nota |
|---|---|---|---|
| `src/app/layout.tsx:39` | `viewport.themeColor = "#BE3A31"` | `"#0F172A"` | agora casa com `manifest.theme_color` |
| `src/app/global-error.tsx:25` | `background: "#f2f2f3"` | `"#FFFFFF"` | style inline: não pode usar CSS var (globals.css pode não ter carregado) |
| `src/app/global-error.tsx:26` | `color: "#1d1f20"` | `"#0F172A"` | |
| `src/app/global-error.tsx:32` | `color: "#5d5d60"` | `"#64748B"` | |
| `src/app/global-error.tsx:38` | `background: "#BE3A31"` | `"#0F172A"` | botão vira preto-cinza, não vermelho |
| `src/app/global-error.tsx:39` | `color: "#f2f2f3"` | `"#F8FAFC"` | |
| `src/app/global-error.tsx:43` | `padding: "8px 16px"` sem radius | + `borderRadius: 8` | alinhar com `rounded-md` |
| `src/components/sistenge-logo.tsx:3,16` | `#cf2927` | `#BE3A31` | **ou deletar o arquivo** e usar `shared/logo.tsx` (§5.7). Se for mantido, corrigir também o comentário do JSDoc |
| `src/app/(app)/vistorias/signature-pad.tsx:31` | `#1d1f20` (traço do canvas) | `#0F172A` | traço do canvas 2D — não aceita CSS var; **verificar se o dark mode exige inverter** (traço preto sobre canvas escuro fica invisível). Provável follow-up: ler `resolvedTheme` |
| `src/lib/pdf.tsx:23` | `ICONE_VERMELHO = "#cf2927"` | `"#BE3A31"` | |
| `src/lib/pdf.tsx:24` | `WORDMARK_COR = "#1f2933"` | `"#0F172A"` | |
| `src/lib/pdf.tsx:177` | `ACENTO = "#BE3A31"` | `"#0F172A"` | ACENTO é usado nos `eyebrow` dos documentos (linhas 181, 366) — deve virar o primary preto-cinza, não o brand vermelho |
| `src/lib/pdf.tsx:62` | `borderTop: "1 solid #BE3A31"`, `backgroundColor: "#f7e9e8"` | `"1 solid #0F172A"`, `"#F1F5F9"` | linha de total: tint slate em vez de tint rosa |
| `src/lib/pdf.tsx:68` | `gBar backgroundColor: "#BE3A31"` | `"#0F172A"` | barra de gráfico no PDF |
| `src/lib/pdf.tsx:61` | `rowSubtotal "#f2f2f3"` | `"#F8FAFC"` | |
| `src/lib/pdf.tsx:57` | `"#f2f2f2"` | `"#F1F5F9"` | |
| `src/lib/pdf.tsx:180,212,364,375` | `#1d1f20` | `#0F172A` | texto base / linha de assinatura |
| `src/lib/pdf.tsx:183,199,276,290,370` | `#5d5d60` | `#64748B` | |
| `src/lib/pdf.tsx:184,198,368` | `#cfcfd2` | `#E2E8F0` | bordas de frame |
| `src/lib/pdf.tsx:187,214,215,310,377` | `#8a8a8d` | `#94A3B8` (slate-400) | labels/rodapé |
| `src/lib/pdf.tsx:193` | `#ededf0` | `#F1F5F9` | |
| `src/lib/pdf.tsx:52,67` | `#eee` | `#E2E8F0` | |
| `src/lib/pdf.tsx:51,164` | `#666` | `#64748B` | |
| `src/lib/pdf.tsx:55` | `#333` | `#0F172A` | |
| `src/lib/pdf.tsx:201-203` | `#b45309`/`#fef3c7`/`#92400e` (aviso) | manter, ou `#B45309`/`#FEF3C7`/`#92400E` | é a família amber; corresponde ao `--warning` — **manter** |
| `src/lib/email.ts:65` | `#BE3A31` (botão CTA) | `#0F172A` | HTML de email: hex literal obrigatório (clientes de email não suportam CSS vars) |
| `src/lib/email.ts:69` | `#1d1f20` / `#f2f2f3` | `#0F172A` / `#F8FAFC` | |
| `src/lib/email.ts:88,118,137,183,190` | `#5d5d60` | `#64748B` | |
| `src/lib/email.ts:70,153` | `#d4d4d7` | `#E2E8F0` | |
| `src/lib/email.ts:162` | `#f7e9e8` / `#f2f2f3` | `#F1F5F9` / `#F8FAFC` | |
| `src/lib/email.ts:25,78,172` | `#eee` | `#E2E8F0` | |
| `src/lib/email.ts:40,42,45,55,94` | `#111`/`#555`/`#f5f5f5`/`#888`/`#fff` | `#0F172A`/`#64748B`/`#F1F5F9`/`#94A3B8`/`#FFFFFF` | |

### **Não** alterar

| Arquivo | Valor | Motivo |
|---|---|---|
| `public/manifest.webmanifest:8` | `theme_color: "#0f172a"` | **já é** `--foreground`/`--primary` do People |
| `public/manifest.webmanifest:7` | `background_color: "#ffffff"` | **já é** `--background` light |
| `public/icons/icon.svg:2` | `#0f172a` | idem — o ícone do PWA já está na paleta |
| `src/app/offline/page.tsx:8` | `#64748b` | **já é** `--muted-foreground` |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | `#666`/`#000`/`#fff` | assets boilerplate do `create-next-app`, não usados. **Candidatos a deleção** |
| `src/lib/pdf.tsx:201-203` | amber de aviso | corresponde ao `--warning` |

**Nota sobre `lib/email.ts` e `lib/pdf.tsx`:** os 30+ hexes ali são **legítimos** — HTML de email e `@react-pdf/renderer` não resolvem CSS custom properties. A ação certa não é eliminá-los, é **centralizá-los**: criar `src/lib/brand-colors.ts` exportando `SLATE_900 = "#0F172A"`, `SLATE_500 = "#64748B"`, `BRAND_RED = "#BE3A31"` etc., e importar nos dois. Isso transforma "30 hexes espalhados" em "um arquivo de constantes". **Recomendo fazer** — é cheap e evita o próximo drift.

---

## 8. Ordem de execução, verificação e riscos

### 8.1 Sequência (8 commits)

O princípio é: **cada commit compila, passa lint/typecheck/test e roda**, e o commit visual grande vem depois de toda a infraestrutura estar no lugar.

| # | Commit | Arquivos | Verificação |
|---|---|---|---|
| **0** | `chore: adiciona script typecheck e regras de lint` | `package.json` (+`typecheck`), `eslint.config.mjs`, `src/lib/logger.ts` (disable de `no-console`) | `npm run typecheck` **passa antes de qualquer mudança visual** — estabelece o baseline |
| **1** | `feat: security headers e CSP` | `next.config.ts` | `npm run build`; **deploy de preview na Vercel** e navegar /login → /painel → /contratos → gerar um PDF → checar console do browser por bloqueios de CSP; confirmar que o service worker registra |
| **2** | `feat: tokens de design Sistenge (People) + Inter/JetBrains Mono` | `src/app/globals.css` (reescrito), `src/app/layout.tsx`, `src/components/providers/theme-provider.tsx` (novo) | `npm run build`; abrir 3 telas em light **e** dark. Neste ponto o app já muda de cara: cinza-slate, cantos de 10px, Inter. Os primitivos ainda estão com densidade antiga — **é esperado ficar estranho** |
| **3** | `refactor: remove font-heading, .eyebrow e .blueprint` | `ui/button.tsx`, `ui/card.tsx`, `ui/dialog.tsx`, `(app)/error.tsx`, `(app)/layout.tsx`, `(app)/page.tsx`, `financeiro/fluxo/page.tsx` | `npm run typecheck`; `grep -rn 'font-heading\|className="eyebrow\|blueprint' src` → só os falsos-positivos de `lib/pdf.tsx`/`lib/templates.ts` |
| **4** | `feat: primitivos alinhados ao People` | os 9 arquivos de `ui/` (button, card, table, input, textarea, badge, dialog, sonner) + `ui/skeleton.tsx` novo; deletar `ui/dropdown-menu.tsx` | `npm run typecheck` (pega `CardAction` e a prop `size` do Card); `npm run build`. **Este é o commit de maior risco visual** — inspeção manual completa (§8.3) |
| **5** | `feat: NativeSelect substitui 21 cópias de selectClasses` | `ui/native-select.tsx` novo + 21 arquivos | `npm run typecheck`; `grep -rn 'const selectClasses' src` → vazio; submeter um form de cada tipo (`/obras/novo`, `/imoveis/novo`, `/contratos/novo`) e um filtro GET (`/relatorios`, `/imoveis`) |
| **6** | `feat: compartilhados (PageHeader, EmptyState, KpiCard, ConfirmDialog, ThemeToggle, Logo)` | `src/components/shared/*` (7 novos), `public/brand/*` (5 SVGs), deletar `components/page-header.tsx` e `components/confirm-delete.tsx`, atualizar ~40 imports + 24 `eyebrow=` + 29 `ConfirmDelete`, `(app)/layout.tsx` (Logo + ThemeToggle) | `npm run typecheck` **é a rede de segurança**: `eyebrow` e `children` saem do tipo do `PageHeader` → cada call site vira erro. Testar cada exclusão (9 arquivos com `ConfirmDelete`) |
| **7** | `refactor: hex hard-coded na paleta Sistenge` | `global-error.tsx`, `layout.tsx` (themeColor), `sistenge-logo.tsx` (ou deletar), `signature-pad.tsx`, `lib/pdf.tsx`, `lib/email.ts`, novo `lib/brand-colors.ts` | `npm test` (há `financeiro.test.ts`, `locacao.test.ts`, `relatorios.test.ts`, `templates.test.ts`, `modulos.test.ts`); gerar os 3 PDFs (`/api/contratos/[id]/pdf`, `/api/imoveis/[id]/contrato-pdf`, `/api/imoveis/[id]/termo-pdf`); disparar um email de teste; forçar um erro para ver `global-error` |
| **8** | `chore: bump 0.20.0` | `src/lib/changelog.ts` (`APP_VERSION` + `Release` no topo de `CHANGELOG`), `CHANGELOG.md`, `package.json` | AGENTS.md obriga os três em sincronia. MINOR (0.19.4 → **0.20.0**): mudança grande sem quebra de contrato de dados. Texto do `Release` voltado ao usuário: "Nova identidade visual", "Modo escuro", "Confirmação de exclusão em janela em vez de alerta do navegador" |

Alternativa: agrupar 3-7 num único `Release` 0.20.0 e ir acrescentando itens em `changelog.ts` conforme cada commit entra (a "regra prática" do AGENTS.md permite isso explicitamente).

### 8.2 Comandos de verificação por commit

```
npx tsc --noEmit        # ou npm run typecheck após o commit 0
npm run lint
npm test                # 5 arquivos .test.ts, todos de lógica de domínio — não cobrem UI
npm run build           # pega erros de RSC/client boundary e de resolução de módulo
```
Mais dois greps de regressão específicos desta fase:
```
grep -rn 'font-heading\|className="eyebrow\|blueprint\|--card-spacing' src   # deve ficar vazio
grep -rn 'const selectClasses' src                                            # deve ficar vazio
grep -rnE '\bhsl\(var\(--' src/app/globals.css                                # deve ficar vazio (armadilha do People)
```

### 8.3 Telas para abrir manualmente (light **e** dark)

Sem testes de UI, essa lista **é** a suíte. Priorizada por risco:

1. **`/contratos`** — tabela de 7 colunas dentro de `Card > CardContent p-0`, `Badge` dinâmico via `STATUS_CONTRATO`, `Button size="icon-sm"` na coluna "Abrir", `PageHeader` com `acoes`. Cobre 5 mudanças de uma vez. **Aqui se decide se `TableCell p-4` cabe ou vira `p-3`.**
2. **`/`** (painel) — 4 `KpiCard`, `BarChart` (`bg-primary` agora slate-900), 2 cards de resumo, `ObraFilter` (`NativeSelect`).
3. **`/relatorios`** — 6 `NativeSelect` num Server Component (filtros GET) + tabela larga. Se o `NativeSelect` quebrar em server, quebra aqui.
4. **`/imoveis/[id]`** — a tela mais densa do app: múltiplos Cards aninhados, tabelas, `ConfirmDeleteButton`, `Badge` de status, `contrato-imovel-acoes.tsx` (o único `<Button variant="destructive">`).
5. **`/financeiro`** + **`/financeiro/fluxo`** — `NativeSelect` server, `CardContent p-0`, os dois `font-heading text-4xl` que viram `KpiCard`.
6. **`/vistorias/[id]`** — `signature-pad` (canvas com hex hard-coded — **checar visibilidade do traço no dark**), `NativeSelect` server, upload de fotos.
7. **`/novidades`** — `TIPO_MUDANCA_INFO` exercita os 4 variants de `Badge`, incluindo o `destructive` que virou sólido.
8. **Qualquer `<Dialog>`** — verificar `p-6`, `rounded-lg`, `shadow-lg`, o `DialogFooter` sem a barra `bg-muted/50`, e o botão de fechar em `top-4 right-4`.
9. **`/login`** — fora do `(app)/layout`, `bg-muted/40` + `<Card className="w-full max-w-sm">`. Card branco sobre cinza-100.
10. **Um estado vazio** (ex.: `/itens` filtrado sem resultado) — `EmptyState` substituindo `<Card className="border-dashed">`.
11. **`global-error`** — forçar um throw no root.
12. **Um PDF de cada tipo** — os 3 endpoints de `/api`.
13. **Mobile (< 768px)** — a `<nav>` inferior de `(app)/layout.tsx:112` reusa a `Sidebar` num `overflow-x-auto`; com `--radius: 0.625rem` e Inter os itens mudam de largura.

### 8.4 Pontos de maior risco de regressão

Ordenados por probabilidade × impacto:

1. **`TableCell p-2 → p-4` + `whitespace-nowrap` = tabelas muito mais largas.** 12 telas. É o item nº 1 a inspecionar. Mitigação pronta: `p-3`/`px-3`.
2. **119 `<Input>` de `h-8` para `h-10`.** Uniforme, mas 12 formulários ficam significativamente mais altos. Verificar se algum form em dialog passa a precisar de scroll (`imoveis/conta-consumo-form.tsx`, `financeiro/baixa-form.tsx`).
3. **Card: `bg-transparent` → `bg-card` no dark.** Hoje o card é transparente sobre `#1a1d1f`; passa a ser `#0B111E` sobre `#070A13`. Se alguma tela empilhava cards, a hierarquia visual muda completamente. Como o dark mode **nunca foi realmente exercitado** (o `ThemeProvider` não existia), tudo em dark é território novo — trate o dark como *feature nova*, não como regressão.
4. **`~46 <CardHeader>/<CardContent>` sem className vão de 16px para 24px de padding.** Intencional, mas em telas com muitos cards pequenos (`/configuracoes`, `/perfil`) pode ficar solto. Inspecionar.
5. **`Badge` e `Button` destructive tonal → sólido.** 4 sites. Vermelho sólido chama muito mais atenção; verificar se algum é meramente informativo (`vistorias/page.tsx:130` "Pendente" — talvez devesse ser `warning`, não `destructive`; anotar para Fase 2).
6. **`DialogTrigger render={}` vs `asChild`.** O `ConfirmDialog` do People usa `asChild`; a conversão para Base UI é o único ponto do plano com risco de **API real** (não visual). Ler `node_modules/@base-ui/react/dialog` antes de escrever, e testar as 29 exclusões.
7. **`[data-theme="light"]` + `@custom-variant dark` com `:not(:is(…))`.** Ganho real sobre o People, mas o seletor fica `&:is(.dark *):not(:is([data-theme="light"] *))` — se der problema de especificidade em algum primitivo, o fallback é voltar ao `&:is(.dark *)` simples e seguir a convenção do People (não usar `dark:` dentro dessas regiões).
8. **CSP em produção.** `Strict-Transport-Security` é difícil de reverter (cache do browser). Preview deploy obrigatório antes de merge.
9. **`animate-progress-indeterminate` sendo tree-shakado.** Se o `@keyframes` estiver dentro de `@theme` e a classe for arbitrária (`animate-[progress-indeterminate_…]`), o Tailwind não detecta. Usar sempre a classe nomeada.
10. **`signature-pad.tsx` no dark.** Traço `#0F172A` sobre canvas escuro = invisível. Precisa de `resolvedTheme` — ou trate como bug conhecido de Fase 2 e force `data-theme="light"` no container do canvas (que é exatamente para isso que o token de §1.2 serve).

### 8.5 Rede de segurança, explicitamente

Não há testes de componente. As três compensações desta fase, em ordem de valor:

1. **`tsc --noEmit`** — a remoção de props (`eyebrow`, `children` do `PageHeader`, `size` do `Card`) e a remoção de exports (`CardAction`) transformam a migração em erros de compilação enumerados. **Por isso o commit 0 vem primeiro e por isso `PageHeader` remove props em vez de aceitá-las e ignorá-las.**
2. **Greps de regressão** (§8.2) — mecânicos, cobrem os motivos removidos.
3. **A checklist de 13 telas** (§8.3) — executada duas vezes (light/dark), duas vezes (depois do commit 4 e depois do 6).

Se quiser mais rede: rodar `npm run build` e comparar o CSS gerado antes/depois com um diff do arquivo em `.next/static/css/*.css` para confirmar que nenhuma utility com modificador de opacidade desapareceu — é o teste mais direto contra a armadilha do triplet HSL de §1.1.

---

### Arquivos críticos para a implementação

- `c:\Projetos_Sistenge\Loca\src\app\globals.css` — reescrita completa; toda a fundação de tokens
- `c:\Projetos_Sistenge\Loca\src\components\ui\card.tsx` — 89 call sites; mudança de modelo (`--card-spacing` → `p-6`)
- `c:\Projetos_Sistenge\Loca\src\components\ui\button.tsx` — ramp de sizes + `destructive` sólido; 47 sites com `size=` explícito
- `c:\Projetos_Sistenge\Loca\src\components\page-header.tsx` — reescrita com quebra de API proposital (24 `eyebrow=` + 8 `children`)
- `c:\Projetos_Sistenge\Loca\src\app\layout.tsx` — fontes, `ThemeProvider`, `themeColor`
- `C:\Projetos_Sistenge\People Plataform\sistenge-people\app\globals.css` + `tailwind.config.ts` — fonte dos valores a traduzir
- `C:\Projetos_Sistenge\People Plataform\sistenge-people\components\shared\` — fonte dos 7 compartilhados