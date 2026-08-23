// Moldura das telas de autenticação (/login, /auth/recuperar, /auth/nova-senha).
//
// Split-screen no estilo do Sistenge People: painel de apresentação escuro à
// esquerda, formulário à direita. Abaixo de lg o painel desaparece e sobra o
// logotipo com o cartão, centralizados.
//
// Os hex são literais de propósito. Este é fundo de apresentação, não interface:
// não deve seguir o tema do usuário nem os tokens, porque a intenção é ser
// sempre escuro. É o mesmo raciocínio do People — e é por isso que o cartão
// carrega `data-theme="light"`, que força os tokens claros dentro dele. Sem
// isso, quem estiver em modo escuro veria um cartão visualmente branco com
// campos e rótulos de contraste invertido.

import { SistengeLogo } from "@/components/sistenge-logo";

const DESTAQUES = [
  "Contratos de locação com itens, medições e devoluções rastreadas.",
  "Vistorias com fotos, laudo em PDF e histórico de avarias.",
  "Financeiro com fluxo de caixa, recorrentes e relatórios.",
];

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
  return (
    <main className="flex min-h-dvh flex-col bg-[#0F1115] lg:flex-row">
      {/* Apresentação — só em telas largas. */}
      <section className="relative hidden overflow-hidden bg-linear-to-br from-[#1A1D24] via-[#0F1115] to-[#0A0C0F] p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between xl:w-[55%] xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-[#BE3A31]/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-[#BE3A31]/5 blur-3xl"
        />

        {/* `self-start` é necessário: num flex column os filhos esticam por
            padrão, o SVG ficaria com a largura da coluna e o
            preserveAspectRatio centralizaria o desenho no meio dela. */}
        <SistengeLogo className="relative h-8 w-auto self-start text-white" />

        <div className="relative max-w-xl">
          <h1 className="text-4xl leading-[1.1] font-bold text-white xl:text-5xl">
            Locação de equipamentos,
            <br />
            <span className="text-[#FF5C58]">do contrato à devolução.</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-400">
            Sistema da Sistenge Engenharia para controlar materiais,
            equipamentos e imóveis locados em obra — contratos, medições,
            devoluções e financeiro num só lugar.
          </p>
          <ul className="mt-8 space-y-3">
            {DESTAQUES.map((d) => (
              <li key={d} className="flex gap-3 text-sm text-slate-300">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FF5C58]"
                />
                {d}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-slate-600">
          Loca · v{versao}
        </p>
      </section>

      {/* Formulário. */}
      <section className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* O logotipo aparece aqui só quando o painel de apresentação está
              escondido — senão apareceria duas vezes. */}
          <SistengeLogo className="mx-auto mb-8 h-8 w-auto text-white lg:hidden" />

          <div
            data-theme="light"
            className="rounded-xl border border-white/10 bg-card p-7 text-card-foreground shadow-2xl shadow-black/40 sm:p-8"
          >
            <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">{descricao}</p>
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Problemas para entrar? Fale com a TI da Sistenge.
          </p>
        </div>
      </section>
    </main>
  );
}
