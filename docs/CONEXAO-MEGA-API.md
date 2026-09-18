# Conexão com a API do Mega ERP

Guia portátil. Escrito a partir do que foi **medido** contra a API em
17/09/2026, não do que a documentação do fornecedor promete — onde os dois
divergem, está marcado.

Base: `https://rest.megaerp.online`

---

## 1. Autenticação

```
POST /api/Auth/SignIn
Headers:  grantType: Api
          tenantId: <GUID do tenant>
          Content-Type: application/json
Body:     { "userName": "...", "password": "..." }
```

A resposta traz `accessToken` e `expirationToken` (ISO 8601, com offset).

### Cinco regras que não são estilo — são proteção da conta

**1. Uma autenticação por vez.** Encadear tentativas **já bloqueou** a conta
`120.apifin`. Se um SignIn falhar, pare e leia o corpo antes de repetir. Não
monte laço de retry em cima do login.

**2. Erro de autenticação volta HTTP 200 com `text/plain`.** Não é 401. Um
`ConvertFrom-Json` direto no corpo estoura com uma mensagem que não tem nada a
ver com a causa. Leia o texto e só converta se começar com `{` ou `[`.

**3. A expiração sai de `expirationToken`, nunca de constante sua.** O token
dura cerca de 2 h hoje. Assumir 2 h fixas rende 401 intermitente no dia em que
o fornecedor mudar a política, e ninguém liga o sintoma à causa. Use a
constante só como fallback para quando o campo não vier.

**4. Reaproveite o token.** Grave em arquivo e só reautentique perto do fim da
validade. Um script que autentica a cada execução é o caminho para o bloqueio.

**5. O corpo do SignIn nunca vai para log nem para mensagem de erro.** Ele pode
ecoar a credencial enviada. O `tenantId` é GUID e é segredo — não imprima.

### O 401 depois de autenticado

Renove **uma** vez e refaça a chamada. O segundo 401 propaga. Não existe
terceiro login.

---

## 2. Chamadas autenticadas

```
Headers:  Authorization: Bearer <accessToken>
          tenantId: <GUID>
          Accept: application/json
```

Ponha timeout em **toda** chamada (30 s serve). Sem teto, uma rota travada
consome a janela inteira de um job e as outras consultas nem saem.

---

## 3. As rotas que existem (medidas)

| Rota | O que devolve |
| --- | --- |
| `/api/global/CentroCusto` | os centros de custo (33 na Sistenge) |
| `/api/global/Projeto` | os projetos (162 na Sistenge) |
| `/api/globalagente/Agente/{padrao}-{codigo}` | um agente: nome, CNPJ |
| `/api/globalagente/Agente/GetAgenteCnpj/{doc}` | resolve o agente pelo CPF/CNPJ (só dígitos; com máscara devolve 500) |
| `/api/FinanceiroMovimentacao/FaturaPagar/Saldo/{ini}/{fim}` | todas as parcelas do contas a **pagar** no período |
| `/api/FinanceiroMovimentacao/FaturaPagar/Saldo/Agente/{cod}/{ini}/{fim}` | idem, de um agente só |
| `/api/FinanceiroMovimentacao/FaturaReceber/Saldo/{ini}/{fim}` | o contas a **receber**, simétrico ao pagar |

O padrão de nomes que emerge é `{Modulo}Movimentacao/{Entidade}/...` para
movimento e `global{entidade}/{Entidade}` para cadastro. Use-o para adivinhar
antes de perguntar ao fornecedor.

Rotas testadas que dão **404** — registradas para ninguém repetir a busca:

| Tema | Testadas |
| --- | --- |
| organização | `/api/global/Empresa`, `/Filial`, `/Organizacao`, `/CentroResultado`, `/UnidadeNegocio` |
| centro de custo | `/api/globalcentrocusto/CentroCusto` (o certo é `/api/global/CentroCusto`) |
| contabilidade | `/api/global/PlanoConta`, `/ContaContabil`, `/Conta`, `/LancamentoContabil`, `/api/globalplanoconta/PlanoConta`, `/api/globalcontabil/PlanoConta`, `/api/globalconta/Conta`, `/api/ContabilMovimentacao/Lancamento` |
| banco | `/api/FinanceiroMovimentacao/Extrato/{ini}/{fim}`, `/MovimentoBancario/{ini}/{fim}`, `/ContaCorrente` |

**Cuidado ao concluir.** Oito 404 em contabilidade não provam que ela não é
exposta — provam que não está nos nomes chutados. Antes de planejar uma
migração contábil sem API, peça a lista de endpoints ao fornecedor ou observe
as chamadas que a interface web do Mega faz no DevTools. Isso custa uma sessão
e resolve; adivinhar nomes não.

**Existe filial no dado, sem rota que a liste.** As respostas de contas a pagar
e a receber trazem `Filial: { Id: 3, ... }`. Se o seu modelo precisa de filial,
ela está lá — só não é consultável.

### 3.1 Formato dos códigos — a pegadinha que custa uma rodada

A rota de **contas a pagar** quer o código **cru** (`2630`). Com o prefixo
(`1-2630`) a API responde `The value '1-2630' is not valid`.

O formato `padrao-codigo` só vale em `/api/globalagente/Agente/{id}`.

### 3.2 As chaves mudam de caixa entre rotas

`/api/globalagente/Agente/{...}` devolve **minúsculas** (`nome`, `cnpj`).
A rota de contas a pagar devolve **PascalCase** (`Agente`, `SaldoAtual`).
Na rota de contas a pagar, `Agente.Nome` e `Agente.Cnpj` vêm **nulos** — o nome
precisa de uma segunda chamada.

---

## 4. A estrutura de custo: duas dimensões, não uma

Este é o ponto que mais confunde quem chega, e o que mais importa modelar
certo. O Mega classifica o custo em **duas dimensões independentes**:

### Centro de custo — árvore de 3 níveis

O campo `extenso` **é o caminho**: `1` → `11` → `111`. O `reduzido` é o número
que as pessoas usam no dia a dia.

```
1  CENTRO DE CUSTO ADMINISTRATIVO          (reduzido 3)
  11  ADMINISTRATIVO                       (4)
     111 DIRETORIA (5)      114 COMERCIAL (8)     117 OBRIGAÇÕES FISCAIS (11)
     112 ADMINISTRATIVO (6) 115 ORCAMENTO (9)     118 DEPOSITO (12)
     113 ENGENHARIA (7)     116 SUPRIMENTOS (10)  119 OCIOSIDADE OBRA (13)
2  CENTROS DE ALOCAÇÃO DIRETA               (14)
  21  ALOCAÇÃO DE RECEITAS                  (15)  → 16, 17, 18
  22  ALOCAÇÃO DE CUSTO DIRETO DE PRODUÇÃO  (19)
     221 CUSTO DIRETO OPERACIONAL (20)      223 GARANTIA DE OBRA (22)
     222 CONTRATO DE MANUTENÇÃO (21)        224 SERVIÇOS PJ (34)
3  IMPOSTOS E CONTRIBUIÇÕES     4  ALOCAÇÕES FINANCEIRAS
5  FATURAMENTO DIRETO           9  NÃO UTILIZADO
```

### Projeto — árvore própria, numeração própria

```
1 OBRA          → 101 SETOR PUBLICO / 102 SETOR PRIVADO → 605, 608, 680, 691, 695…
2 MANUTENÇÃO    → 201 SETOR PUBLICO / 202 SETOR PRIVADO → 686, 705…
8 SISTENGE-ADM  → 8001 → 38 SISTENGE
9 NÃO UTILIZADO
```

### A confusão a evitar

Os números circulam misturados nas conversas. **5, 6, 7, 8, 9, 20, 21 são
centro de custo. 38, 605, 686, 691 são projeto.** Um campo único no seu sistema
para "o código do Mega" significa coisas diferentes conforme a linha — e é
assim que uma chave de conciliação casa com a tabela errada sem ninguém notar.
Modele **duas colunas** desde o começo.

### Cardinalidade: um para muitos, nos dois sentidos

Um código da folha pode cobrir **dois** centros de custo do Mega. Na Sistenge,
o `801` da ADP é Engenharia (7) **e** Suprimentos (10); o `803` é Comercial (8)
**e** Orçamento (9). Uma coluna não guarda dois valores, e gravar `"7,10"`
inventa um formato que nenhum dos dois sistemas lê. Deixe nulo e concilie à
mão, ou modele a relação N:N de verdade.

---

## 5. Contas a pagar

A rota de saldo traz **todas** as parcelas do período (≈458 num mês, de 224
agentes). Filtre **em memória** pelos agentes que interessam.

Isso é decisão de propósito, não economia de chamada: a resposta traz tudo que
a empresa paga — folha, vale-transporte, impostos, veículos. Guardar tudo isso
no seu sistema seria coletar muito além do propósito dele.

**O Mega recusa intervalo maior que 2 anos.** Três anos exigem duas janelas.

### Os quatro campos que importam

- **`SaldoAtual == 0` é o que significa "pago".**
- **`DataProrrogado` É a data de pagamento** — regra de negócio confirmada com
  o dono do processo, não inferência. `DataVencimento` é o vencimento
  contratado; quando o financeiro renegocia, quem manda é a prorrogada. Medido:
  nenhuma parcela vem sem prorrogação, nenhuma prorroga para trás, 12% adiam de
  fato. Ler a data original faz a tela acusar atraso em título em dia.

  | `SaldoAtual` | O que `DataProrrogado` é |
  | --- | --- |
  | `0` | o dia em que **foi** pago |
  | `> 0` | o dia em que **será** pago |

- **`NumeroDocumento` só é confiável quando o tipo é fiscal.** Em `NF` ele é o
  número da fatura (9 genéricos em 183). Em `RECIBO` não é (92 de 94), nem em
  `CONTRATO` (7 de 7) ou `ALUGUEL` (20 de 22) — ali vem `"1"`, `"2"`, `"3"`,
  que é o lançador numerando à mão. Em imóvel é 100% genérico: 106 de 106.

  **Regra: case por documento só em título fiscal, e nunca quando o valor tiver
  1 a 3 dígitos.**

- **`AP | parcela` NÃO é chave única.** A chave é
  `AP | parcela | agente | tipoDoc | numDoc | vencimento | valor`. Retenções
  (ISS, INSS, IR, GUIA) ficam em agente próprio — o do órgão —, então filtrar
  pelo código do fornecedor já as exclui, mas em consulta por período elas
  aparecem.

---

## 6. Regras de integração que valem para qualquer ERP deste porte

**Nunca chame em paralelo.** Consultas sequenciais, reaproveitando uma
autenticação só. A conta costuma ser compartilhada entre projetos.

**Fail-closed.** Sem credencial configurada, a rota devolve 503 e não tenta
nada. E sincronize apenas a organização que tiver uma linha **ativa** numa
tabela de configuração — subir código, sozinho, não deve fazer o sistema
começar a chamar o ERP.

**O espelho é só leitura.** Se você copiar dados do ERP para o seu banco,
dê-lhe policy de SELECT e mais nada. Editar o espelho não muda o ERP — só faz o
seu sistema mentir até a próxima sincronização. Quem escreve é o job.

**Divergência é fila de revisão humana, não correção automática.** Quando o seu
dado e o do ERP discordam, não "corrija" o seu a partir do dele. Corrigir
destrói o dado bom. O sistema propõe; a pessoa confirma.

**Cron na nuvem roda em UTC.** `30 10 * * *` é 07:30 em Brasília. Quem
"corrigir" para `30 7` move a rodada para as 04:30 da manhã, e nada na tela
denuncia. Escreva um teste que cobre o horário.

**Guarde a data de conferência, não só o número.** Um número copiado do ERB
diverge com o tempo; quem lê precisa saber quando ele foi visto pela última
vez.

---

## 7. PowerShell — três armadilhas específicas

**`@($s | ConvertFrom-Json)` devolve UM elemento** contendo o array inteiro no
PowerShell 5.1: a contagem sai 1 e a soma estoura com `op_Addition`. Atribua
primeiro e envolva depois:

```powershell
$d = $s | ConvertFrom-Json
$a = @($d)          # agora desenrola certo
```

**Leia o corpo pelo stream, não por `.Content`**, para não perder acentuação:

```powershell
$r = Invoke-WebRequest $url -Headers $h -UseBasicParsing -TimeoutSec 30
$txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
```

**Em Git Bash, `docker cp /tmp/x.sql` vira `C:\tmp\x.sql`.** Prefixe
`MSYS_NO_PATHCONV=1` ou trabalhe com caminhos relativos.

---

## 8. Script de referência

Autentica **uma vez**, reaproveita o token, nunca imprime segredo.

```powershell
param([Parameter(Mandatory=$true)][string]$Rota)

$ErrorActionPreference = 'Stop'
$arqCred = 'C:\temp\mega_cred.txt'   # TENANT=... USER=... PASSWORD=...
$arqTok  = 'C:\temp\mega_token.txt'
$base    = 'https://rest.megaerp.online'

$cred = @{}
Get-Content $arqCred | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { $cred[$matches[1].Trim()] = $matches[2].Trim() }
}

function Autenticar {
  $h = @{ grantType='Api'; tenantId=$cred['TENANT']
          'Content-Type'='application/json'; Accept='application/json' }
  $b = (@{ userName=$cred['USER']; password=$cred['PASSWORD'] } | ConvertTo-Json -Compress)
  $r = Invoke-WebRequest "$base/api/Auth/SignIn" -Method POST -Headers $h `
         -Body $b -UseBasicParsing -TimeoutSec 40
  $t = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  # Erro de auth volta 200 com text/plain. NUNCA converter direto.
  if (-not $t.Trim().StartsWith('{')) {
    Write-Host 'FALHA NA AUTENTICACAO. Pare e leia o corpo antes de repetir.'
    exit 1
  }
  $j = $t | ConvertFrom-Json
  $j.accessToken | Set-Content $arqTok -NoNewline
  return $j.accessToken
}

$tok = $null
if (Test-Path $arqTok) {
  # Margem de 20 min sobre as 2 h, para a consulta terminar depois do check.
  if (((Get-Date) - (Get-Item $arqTok).LastWriteTime).TotalMinutes -lt 100) {
    $tok = Get-Content $arqTok -Raw
  }
}
if (-not $tok) { $tok = Autenticar }

$hh = @{ Authorization = ('Bearer ' + $tok); tenantId = $cred['TENANT']
         Accept = 'application/json' }
$resp = Invoke-WebRequest ($base + $Rota) -Headers $hh -UseBasicParsing -TimeoutSec 30
[System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
```

Uso:

```powershell
.\mega.ps1 -Rota '/api/global/CentroCusto'
.\mega.ps1 -Rota '/api/global/Projeto'
```

---

## 9. Volume e paginação — medido

**Não existe paginação. A API devolve tudo de uma vez.** Medido em 17/09/2026,
janela de 12 meses (2025-10-01 a 2026-09-30):

| Rota | Registros | Tamanho | Tempo |
| --- | --- | --- | --- |
| `FaturaPagar/Saldo` | 8.102 | 3.415 KB | 5,7 s |
| `FaturaReceber/Saldo` | 141 | 57 KB | 0,2 s |

Nenhum header de `page`, `total`, `count` ou `link`. O que o filtro de data
pede é o que vem, inteiro.

**O risco não é paginação — é tamanho de resposta.** 3,4 MB numa chamada. Numa
função serverless com teto de memória isso pesa mais que o tempo. Se você for
ler janelas anuais, planeje janelas menores por conta própria; a API não vai
obrigar, e é justamente por isso que ninguém percebe até estourar.

**Pagar e receber têm ordens de grandeza diferentes** — 57 para 1 nesta
empresa. Tratar os dois com a mesma estratégia super-dimensiona um e
sub-dimensiona o outro.

**Atenção à taxa mensal.** Uma medição de um mês específico deu ≈458 parcelas;
os 12 meses deram ~675/mês. Um mês não é taxa.

### Os campos das duas rotas são idênticos

```
Filial, Agente, TipoDocumento, NumeroDocumento, NumeroParcela,
DataVencimento, DataProrrogado, ValorParcela, SaldoAtual
```

O campo do valor é **`ValorParcela`**, não `Valor`.

**A simetria é estrutural, não semântica.** `DataProrrogado` existe e adia dos
dois lados, mas no receber quem prorroga é o **cliente**, não o seu financeiro.
Mesma estrutura, dono diferente — confirme a regra de negócio antes de
reaproveitar a lógica do pagar.

### A rota NÃO filtra filial — e o que ela devolve diz muito da empresa

Medido na mesma janela de 12 meses:

| | registros | agentes distintos | filiais | tipos de documento |
| --- | --- | --- | --- | --- |
| pagar | 8.102 | 885 | `3` (7.932), `10` (166), `100` (4) | NF MAT, NF, BOLETO, RECIBO, GUIA… |
| receber | 141 | 26 | `3` (141) | NFS (97), NFE (44) |

**O pagar devolve três filiais**, logo a rota entrega o universo e não um
recorte silencioso. Se o receber traz uma filial só, isso é característica do
dado, não da consulta — vale testar isso cedo em qualquer integração nova,
porque uma rota que filtra sem dizer transforma "o universo" em "o que eu vi".

**O receber só conhece nota fiscal.** Dois tipos, NFS e NFE, ambos fiscais —
contra a casa toda de instrumentos do pagar. Onde essa assimetria aparecer,
desconfie de que o ERP não é o sistema de faturamento: ele registra a nota já
emitida, e o que decide **quando** faturar (medição, empenho, marco físico) vive
fora dele. Isso muda um projeto de migração de "substituir o que existe" para
"construir o que hoje é planilha".

**Filial com pouquíssimos lançamentos merece pergunta, não suposição.** A `100`
tem 4 títulos num ano: ou é empresa recém-criada, ou desativada, ou erro de
cadastro que ninguém olhou. As três importam para quem modela filial.

### Formato de data: `dd/MM/yyyy`, não ISO

As respostas trazem `01/10/2025`. Um parser que assume ISO ou month-first
estoura no dia 13 do mês — e passa despercebido nos doze primeiros.

---

## 10. O que ainda não foi medido

Honestidade sobre os limites deste guia:

- **Escrita:** tudo aqui é leitura. Nenhum `POST`/`PUT` de dado foi exercitado.
- **Rate limit:** não há número conhecido. As regras deste guia são
  conservadoras porque o custo de descobrir o limite é o bloqueio de uma conta
  que costuma ser compartilhada entre projetos.
- **Contabilidade:** doze nomes testados, todos 404 (ver seção 3). Isso prova
  que os nomes chutados estão errados, não que o recurso não exista.
