// Moldura das telas de autenticação (/login, /auth/recuperar, /auth/nova-senha).
//
// Coluna única centralizada sobre fundo claro, no padrão do SST Manager: logo,
// nome do produto, cartão do formulário e rodapé. Antes era split-screen com
// painel escuro de apresentação à esquerda — bonito, mas era vitrine para quem
// já sabe o que o sistema faz. Quem chega aqui é empregado da Sistenge indo
// trabalhar, não visitante a ser convencido.
//
// TEMA FORÇADO CLARO. `data-theme="light"` no elemento raiz da tela, e não só no
// cartão como antes. Aqui não há usuário logado, logo não há preferência de tema
// conhecida — sobraria o `prefers-color-scheme` do sistema operacional, que
// deixaria metade das pessoas vendo uma tela escura enquanto a outra vê clara.
// A tela de entrada é a mesma para todo mundo, e a identidade da Sistenge é
// sobre fundo claro.
//
// O `SistengeLogo` é theme-aware por `currentColor`: o ícone é sempre o vermelho
// da marca e o wordmark segue a cor do texto. Com o tema claro forçado, ele sai
// escuro sobre claro sem precisar de segundo arquivo.

import { SistengeLogo } from "@/components/sistenge-logo";
import { hojeISOSaoPaulo } from "@/lib/locacao";

export function AuthShell({
  titulo,
  descricao,
  versao,
  children,
}: {
  /** Título dentro do cartão (ex.: "Bem-vindo de volta"). */
  titulo: string;
  descricao: string;
  versao: string;
  children: React.ReactNode;
}) {
  // `hojeISOSaoPaulo()` e não `new Date()`: isto renderiza no servidor, que roda
  // em UTC, e das 21h à meia-noite de 31 de dezembro o rodapé mostraria o ano
  // seguinte. Detalhe pequeno, mas é o mesmo erro que cobrava um dia extra de
  // locação na 0.22.0 — não vale abrir exceção para ele.
  const ano = hojeISOSaoPaulo().slice(0, 4);

  return (
    <main
      data-theme="light"
      className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-6 py-12"
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          {/* `w-auto` com altura fixa: num flex column o filho estica por
              padrão, e o preserveAspectRatio centralizaria o desenho dentro de
              uma caixa larga demais. */}
          <SistengeLogo className="h-9 w-auto text-foreground" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Loca</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Locações de obra — contratos, vistorias e imóveis
          </p>
        </div>

        <div className="mt-8 rounded-xl border bg-card p-7 text-card-foreground shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{descricao}</p>
          {children}
        </div>

        <div className="mt-8 space-y-1 text-center text-xs text-muted-foreground">
          <p>© {ano} SISTENGE Engenharia</p>
          <p>
            Loca v{versao} · Problemas para entrar? Fale com a TI da Sistenge.
          </p>
        </div>
      </div>
    </main>
  );
}
