import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature, Pencil } from "lucide-react";

import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import {
  obterPeca,
  listarPossesDaPeca,
  listarObrasEFornecedores,
} from "@/lib/data/custodia";
import { descreverDetentor, montarLinhaDoTempo } from "@/lib/custodia";
import { SITUACAO_INFO, PROPRIEDADE_INFO, ESTADO_INFO } from "@/lib/frota";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { Campo } from "@/components/shared/campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PecaLinhaDoTempo } from "./_components/peca-linha-do-tempo";
import { PecaMover } from "./_components/peca-mover";
import { PecaEditar } from "./_components/peca-editar";
import { PecaSituacao } from "./_components/peca-situacao";
import { PecaReparos } from "./_components/peca-reparos";
import { PecaApontamentos } from "./_components/peca-apontamentos";
import { PecaCertificados } from "./_components/peca-certificados";
import { listarApontamentosDaPeca } from "@/lib/data/apontamentos";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import {
  listarPendenciasDaPeca,
  listarCertificadosDaPeca,
} from "@/lib/data/certificados";
import { assinarUrls } from "@/lib/data/storage";

export const metadata = { title: "Peça — Loca" };

/**
 * Detalhe da peça: onde está, com quem, desde quando, e o histórico inteiro.
 *
 * `hoje` é resolvido AQUI, com `hojeISOSaoPaulo()`, e desce como prop para o
 * cálculo. Nunca `new Date()`: as datas de posse vêm de coluna `date`, o Vercel
 * roda em UTC, e das 21h à meia-noite em Brasília o tempo de posse sairia um
 * dia maior.
 */
export default async function PecaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [peca, posses, destinos, perfil] = await Promise.all([
    obterPeca(id),
    listarPossesDaPeca(id),
    listarObrasEFornecedores(),
    getCurrentPerfil(),
  ]);
  if (!peca) notFound();

  // Só busca o histórico e a lista de obras quando a peça TEM horímetro: para
  // toda betoneira e escora do sistema, seriam duas consultas para desenhar
  // nada.
  const [apontamentos, obrasParaApontamento] = peca.temHorimetro
    ? await Promise.all([listarApontamentosDaPeca(peca.id), listarObrasParaFiltro()])
    : [[], []];

  // As exigências do TIPO desta peça, e os certificados já lançados. As duas
  // consultas correm juntas; a de URLs assinadas espera, porque depende dos
  // caminhos que a segunda devolve.
  const [pendencias, certificados] = await Promise.all([
    listarPendenciasDaPeca(peca.id),
    listarCertificadosDaPeca(peca.id),
  ]);

  // UM lote de assinatura para todos os laudos, e não um por arquivo: uma peça
  // com quatro exigências renovadas três vezes são doze chamadas ao Storage
  // antes do primeiro byte de HTML.
  const urls = Object.fromEntries(
    await assinarUrls("certificados", certificados.map((c) => c.arquivoPath)),
  );

  const hoje = hojeISOSaoPaulo();
  const linha = montarLinhaDoTempo(posses, hoje);
  const atual = linha.find((p) => p.aberta) ?? null;

  const podeMover = podeOperar(perfil?.papel);
  const podeEditar = podeEditarCadastros(perfil?.papel);
  const info = SITUACAO_INFO[peca.situacao];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        titulo={peca.identificador}
        descricao={peca.itemDescricao}
        acoes={
          <>
            {/* Entregar a pessoa é o termo, com assinatura — não um botão de
                movimentação aqui. */}
            {podeMover && peca.situacao === "disponivel" ? (
              <Button variant="outline" render={<Link href="/termos/novo" />}>
                <FileSignature className="size-4" />
                Entregar a funcionário
              </Button>
            ) : null}
            {/* O formulário de cadastro fica no fim da página, depois da
                linha do tempo. Sem esta âncora quem chega ao topo conclui que a
                peça não é editável — foi o relato do Evandro em 03/09/2026. */}
            {podeEditar ? (
              <Button variant="outline" render={<Link href="#cadastro" />}>
                <Pencil className="size-4" />
                Editar
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href="/frota" />}>
              Voltar
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            label="Com quem está"
            destaque
            valor={atual ? descreverDetentor(atual) : "Sem registro de posse"}
          />
          <Campo label="Há" valor={atual ? atual.periodo : null} />
          <div>
            <p className="text-xs text-muted-foreground">Situação</p>
            <Badge variant={info.variant}>{info.label}</Badge>
          </div>
          <Campo label="Propriedade" valor={PROPRIEDADE_INFO[peca.propriedade].label} />
          <Campo label="Categoria" valor={peca.categoriaNome} />
          <Campo label="Número de série" valor={peca.numeroSerie} />
          <Campo label="Ano" valor={peca.ano} />
          <Campo
            label="Estado"
            valor={peca.estado ? ESTADO_INFO[peca.estado].label : null}
          />
          {peca.perfilCampos === "ti" ? (
            <>
              <Campo label="IMEI" valor={peca.imei} />
              <Campo label="IMEI 2" valor={peca.imei2} />
              <Campo label="Linha" valor={peca.linhaTelefonica} />
              <Campo label="Operadora" valor={peca.operadora} />
              <Campo label="Service tag" valor={peca.serviceTag} />
              <Campo
                label="Memória"
                valor={peca.memoriaGb ? `${peca.memoriaGb} GB` : null}
              />
              <Campo label="Configuração" valor={peca.configuracao} span />
            </>
          ) : null}
          {peca.observacoes ? (
            <Campo label="Observações" valor={peca.observacoes} span />
          ) : null}
        </CardContent>
      </Card>

      {/* Uso antes de Manutenção: é a leitura do horímetro que diz quando a
          revisão vence, então ela vem primeiro na ordem de leitura. */}
      <PecaApontamentos
        unidadeId={peca.id}
        temHorimetro={peca.temHorimetro}
        apontamentos={apontamentos}
        obras={obrasParaApontamento}
        hoje={hojeISOSaoPaulo()}
        podeEditar={podeEditar}
      />

      {/* Certificados ANTES da manutenção: reparo é histórico, certificado
          vencido é impedimento. O que impede a máquina de operar hoje vem
          primeiro. A seção some sozinha quando o tipo não exige nada. */}
      {perfil?.org_id ? (
        <PecaCertificados
          unidadeId={peca.id}
          orgId={perfil.org_id}
          pendencias={pendencias}
          certificados={certificados}
          urls={urls}
          podeEditar={podeMover}
        />
      ) : null}

      {/* Manutenção vem logo depois da custódia: as duas contam a vida da
          peça — com quem ela esteve e quantas vezes quebrou. */}
      <PecaReparos unidadeId={peca.id} podeEditar={podeEditar} />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de custódia</CardTitle>
        </CardHeader>
        <CardContent>
          <PecaLinhaDoTempo posses={posses} hoje={hoje} />
        </CardContent>
      </Card>

      {podeMover ? (
        <Card>
          <CardHeader>
            <CardTitle>Movimentar</CardTitle>
          </CardHeader>
          <CardContent>
            <PecaMover
              unidadeId={peca.id}
              obras={destinos.obras}
              fornecedores={destinos.fornecedores}
            />
          </CardContent>
        </Card>
      ) : null}

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle>Situação da peça</CardTitle>
          </CardHeader>
          <CardContent>
            <PecaSituacao pecaId={peca.id} atual={peca.situacao} />
          </CardContent>
        </Card>
      ) : null}

      {podeEditar ? (
        <Card id="cadastro" className="scroll-mt-6">
          <CardHeader>
            <CardTitle>Cadastro da peça</CardTitle>
          </CardHeader>
          <CardContent>
            <PecaEditar peca={peca} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
