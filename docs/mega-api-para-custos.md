# Conexão com o Mega — guia para extração de dados

Documento de trabalho para quem vai extrair dados do Mega ERP (Senior X) via
API. Tudo aqui foi **medido contra a produção da Sistenge** entre 28/08 e
11/09/2026, não lido em documentação — e onde a documentação oficial diverge do
comportamento real, o divergente está marcado.

Se você for usar isto com uma IA (Claude, ChatGPT, Copilot), o documento inteiro
serve como prompt: ele é autossuficiente.

---

## 1. Antes de qualquer coisa: cinco regras que não se negociam

Estas não são boas práticas. São as regras que evitam bloquear a conta de API da
empresa, que é **compartilhada entre sistemas**.

1. **Uma autenticação por vez.** Encadear tentativas de login com credencial
   real **já bloqueou a conta `120.apifin`** uma vez. Se a autenticação falhar,
   **pare e leia o erro** — não tente de novo "para ver se agora vai".
2. **Reaproveite o token.** Ele vale 2 horas. Guarde em arquivo e só renove
   depois de ~100 minutos.
3. **Nunca chame a API em paralelo** (`Promise.all`, `ForEach-Object -Parallel`,
   threads). Sempre sequencial.
4. **Nunca imprima a credencial nem o `TENANT`** em log, console, ticket ou
   conversa. O tenant é um GUID e é segredo tanto quanto a senha.
5. **Nada de escrita sem autorização explícita.** Há rotas `POST`/`DELETE` nos
   specs. Extração é leitura (`GET`). Não altere configuração de segurança nem
   desbloqueie usuário no ERP.

> **Se algo falhar, prefira parar e perguntar a insistir.** O custo de esperar é
> uma hora; o de bloquear a conta é o financeiro inteiro parado.

---

## 2. Autenticação

**Base:** `https://rest.megaerp.online`

```
POST /api/Auth/SignIn
Headers:
  grantType: Api
  tenantId: <TENANT>
  Content-Type: application/json
  Accept: application/json
Body:
  { "userName": "<USER>", "password": "<PASSWORD>" }
```

A resposta traz `accessToken`. **Toda chamada seguinte precisa dos DOIS
cabeçalhos**:

```
Authorization: Bearer <accessToken>
tenantId: <TENANT>
```

Esquecer o `tenantId` é o erro mais comum, e ele não se anuncia como falta de
cabeçalho — volta como erro genérico.

### A armadilha nº 1 da autenticação

**Erro de login volta com HTTP 200 e corpo `text/plain`.** O status não denuncia
nada. Nunca faça `response.json()` direto: leia o corpo como texto e só converta
se começar com `{` ou `[`.

---

## 3. As rotas que interessam para custos

### 3.1 Contas a pagar

| Rota | O que traz |
| --- | --- |
| `GET /api/FinanceiroMovimentacao/FaturaPagar/Saldo/{ini}/{fim}` | **todas** as parcelas com vencimento no período |
| `GET .../FaturaPagar/SaldoEmAberto/{ini}/{fim}` | idem, só as em aberto |
| `GET .../FaturaPagar/Saldo/Agente/{codigo}/{ini}/{fim}` | filtra por fornecedor |
| `GET .../FaturaPagar/Saldo/Filial/{filial}/{ini}/{fim}` | filtra por filial (`3` = Sistenge) |
| `GET .../FaturaPagar/Saldo/AcaoSequencia/{seq}` | um título, com mais campos |

Contas a **receber**: as mesmas quatro formas, trocando `FaturaPagar` por
`FaturaReceber`.

**Formato de data: ISO (`AAAA-MM-DD`) no path.** Mandar `dd/MM/yyyy` aqui
devolve erro.

**Limite de 2 anos entre as datas.** Passar disso devolve:
`"O intervalo máximo permitido entre as datas é 2 ano."` Para cobrir mais, parta
em janelas.

**O `{codigo}` do agente vai CRU** (`2630`), não `1-2630`. A documentação oficial
mostra `1-516` e **está errada para esta rota** — ela responde
`The value '1-2630' is not valid`. O formato com prefixo só vale nas rotas de
`globalagente`.

Cada parcela tem exatamente estes 10 campos:

```json
{
  "Filial":  { "Id": 3, "Nome": null, ... },
  "Agente":  { "Id": "1-2506", "Codigo": 2506, "Nome": null, "Cnpj": null, ... },
  "NumeroAP": 16691,
  "TipoDocumento": "NF MAT",
  "NumeroDocumento": "71050",
  "NumeroParcela": "001",
  "DataVencimento": "01/12/2024",
  "DataProrrogado": "01/12/2024",
  "ValorParcela": 693.4,
  "SaldoAtual": 0.0
}
```

**Sete coisas medidas sobre esses campos:**

1. **`SaldoAtual == 0` é o que significa "pago".** Não existe coluna chamada
   "data de pagamento" — mas ela existe sob outro nome, ver o item 2.
2. **`DataProrrogado` É a data de pagamento**, não `DataVencimento`. Confirmado
   com o dono do processo em **11/09/2026**: `DataVencimento` é o vencimento
   contratado do documento; quando o financeiro renegocia, a data que vale é a
   prorrogada. Com `SaldoAtual == 0` ela é o dia em que **foi** pago; com saldo
   em aberto, o dia em que **será**. Medido sobre 5.372 parcelas: **866 (16,1%)
   adiam de fato**, e **nunca** para antes. Usar o vencimento original nesses
   16% acusa atraso em título que está em dia.
3. **As datas voltam em `dd/MM/yyyy` no corpo**, embora o path seja ISO.
   Converter com `new Date("01/12/2024")` em JavaScript dá **12 de janeiro** —
   um erro de 11 meses que não se denuncia sozinho.
4. **`NumeroAP` vem como número**, não texto.
5. **Na rota por período, `Agente.Nome` e `Agente.Cnpj` vêm NULOS.** Só o código
   é útil. O nome sai de `/api/globalagente/Agente/{padrao}-{codigo}`.
6. **`NumeroDocumento` só é o número da nota quando o tipo é fiscal.** Medido
   em 11/09/2026 sobre os 465 títulos do espelho do Loca: em `NF` ele é
   confiável (9 genéricos em 183), mas em `RECIBO` vem como `"1"`/`"2"` em 92
   de 94 casos, em `CONTRATO` 7 de 7 e em `ALUGUEL` 20 de 22. Em título de
   aluguel de imóvel é **100% genérico** (106 de 106). Nunca case por esse
   número quando ele tiver 1 a 3 dígitos, e **nunca corrija com ele o número do
   documento do seu sistema** — divergência é fila de revisão humana.
7. **`AP + parcela` NÃO é chave única.** Retenções (ISS, INSS, IR) reaproveitam
   o número da AP com outro tipo de documento. A chave real é
   `AP + parcela + agente + tipoDoc + numDoc + vencimento + valor`.

### 3.2 Detalhe de um título (e o histórico)

`GET .../FaturaPagar/Saldo/AcaoSequencia/{seq}` traz ~37 campos, incluindo
`Complemento`, **que carrega o texto do Histórico da AP**. Exemplos reais:

```
"659 UNIMED CONTAGEM
 IMPRESSOES E PLOTAGENS"
"REF A LOCAÇÃO DE GEDSON JOSE DA SILVA"
```

**Mas use com parcimônia**, por dois motivos medidos:

- **A listagem não devolve a sequência.** Não há como ir de um título para o seu
  `seq` — só varrendo.
- **A densidade é baixa e o alcance é parcial.** Entre `seq` 70.000 (mar/2026) e
  80.000 (ago/2026) há 10.000 sequências para ~3.640 títulos (36%). E
  "AcaoSequencia" é *sequência de ação*: **títulos em aberto aparentemente não
  têm ação nenhuma**, então o histórico deles não é alcançável.

### 3.3 Contratos — o módulo mais útil para custos

`Mega.Erp.Construcao.AdmObra.AcompanhamentoContratoEngenhariaX`, 31 rotas.

**A rota que resolve quase tudo:**

```
GET /api/AcompanhamentoContratoEngenhariaX/Visoes/GetVisoesFornecedor
    ?data_inicio=01/01/2025&data_fim=31/12/2026
```

Sem filtro de fornecedor, ela devolveu **958 linhas, 664 contratos, 247
fornecedores, R$ 62.236.641,39 contratados — numa única chamada.** Campos:

```json
{
  "produto": "11927 - Sistema de Controle de Iluminação de Datacenter",
  "fornecedor": "735 - CCN AUTOMACAO LTDA",
  "cto_in_codigo": 1360,
  "cto_st_alternativo": "CONT ILUM DATACENTER",
  "projeto": "608 - RACIONAL - DANTE",
  "custo": "20 - ALOCAÇÃO DE CUSTO DIRETO OPERACIONAL",
  "usu_criacao": "120.aaraujo",
  "data_criacao": "2025-12-19T00:00:00",
  "total_contratado": 28821.18, "total_distratado": 0,
  "medicao": 28821.18, "saldo": 0, "nota": 28821.18,
  "desconto": 0, "adiantamento": 0
}
```

**Quatro coisas que só a medição ensinou:**

1. **A data aqui é `dd/MM/yyyy`** — o **oposto** da rota de contas a pagar.
   Mandar ISO devolve **HTTP 500 sem explicar**. Foi isso, e não permissão, que
   derrubou as primeiras tentativas.
2. **Cada linha é um ITEM, não um contrato.** 958 linhas para 664 contratos; o
   contrato 813 sozinho tem 15 itens. Para ter o contrato, **agrupe por
   `cto_in_codigo` e some**. Nem `(código, produto)` é único — colide 77 vezes.
3. **A soma confere com o próprio ERP**: somando as 19 linhas da CCN dá
   R$ 550.627,17, exatamente o que `BigNumbers/GetTotalContratado` responde
   para ela. Use isso como teste da sua extração.
4. **`nota` volta como número aqui e como texto** em `GetTabelaFornecedores`.
   Aceite os dois.

**Outras rotas do módulo** (todas aceitam os filtros `data_inicio`, `data_fim`,
`codigoFilial`, `codigoAgente`, `codigoCustoReduzido`, `codigoProjetoReduzido`,
`codigoGrupo`):

| Rota | O que traz |
| --- | --- |
| `BigNumbers/GetTotalContratado` | total contratado (um número) |
| `BigNumbers/GetTotalMedido` | total medido |
| `BigNumbers/GetSaldoContrato` | saldo |
| `BigNumbers/GetTotalAditivos` / `GetTotalDistrato` | aditivos e distratos |
| `BigNumbers/GetTotalNota` / `GetTotalAdiantamento` / `GetTotalDesconto` | complementos |
| `Destaques/GetTabelaFornecedores` | tabela por fornecedor: contratado, medição, saldo, nota |
| `Destaques/GetTabelaFiliais` / `GetTabelaGrupos` | idem por filial e por grupo |
| `Filtros/GetFornecedores` | **lista os fornecedores que TÊM contrato** |
| `Filtros/GetFiliais` / `GetCentrosCusto` / `GetProjetos` / `GetGrupos` | valores dos filtros |
| `Visoes/GetVisoesItem` / `GetVisoesFilial` | as mesmas visões por item e por filial |

As variantes `...Paginada` aceitam `Page`, `PageSize`, `CampoOrdenacao`,
`Ordenacao`. **Sem nenhum filtro, os BigNumbers devolvem o total da empresa** —
R$ 194.154.987,04 de contratado histórico.

> **Atenção:** `Visoes/...Paginada` e alguns `Destaques` devolveram HTTP 500 nas
> combinações testadas. Se precisar deles, teste variações de capitalização dos
> parâmetros (`data_inicio` vs `Data_Inicio`) — o comportamento **não segue o
> spec** de forma consistente.

### 3.4 Cadastro de agentes (fornecedores e clientes)

| Rota | Uso |
| --- | --- |
| `GET /api/globalagente/Agente/{padrao}-{codigo}` | ex.: `1-735`. **Aqui o prefixo é obrigatório** |
| `GET /api/globalagente/Agente/GetAgenteCnpj/{cnpj}` | busca por documento |
| `GET /api/globalagente/Organizacao/FiliaisAtivas` | filiais |
| `GET /api/globalagente/EnderecoAgente/{id}` | endereço |
| `GET /api/globalagente/AgenteParte/{cod}/Telefones` e `/Enderecos` | contatos |

**Três armadilhas:**

1. **As chaves vêm em minúscula** aqui (`nome`, `cnpj`, `codigo`), enquanto a
   rota de contas a pagar devolve em PascalCase (`Nome`, `Cnpj`). Mesma API,
   duas convenções.
2. **`GetAgenteCnpj` quer só dígitos.** Com máscara (`52.215.622/0001-30`)
   devolve **HTTP 500**.
3. **O campo `cnpj` nem sempre é um CNPJ.** Em agente de retenção (ISS, INSS,
   COFINS) e em **pessoa física**, ele volta com o **próprio código e padding**
   — `"735            "`. Só confie quando bater a máscara de CPF ou CNPJ.

**Não existe busca de agente por nome.** Só por id ou por documento.

### 3.5 Anexos — não servem

`GET /api/anexos?nome-tabela=&chave-tabela=` devolve **só metadados**
(`codigoAnexo`, `nomeTabela`, `nome`, `descricao`). **Não há campo de conteúdo
nem rota de download.** E o endpoint não valida o nome da tabela: tabela
inventada e tabela real devolvem igualmente `[]`, então varrer às cegas não
conclui nada — 33 candidatos foram testados sem retorno.

---

## 4. O catálogo completo: 63 especificações OpenAPI públicas

O portal (`api.xplatform.com.br/api-portal/`) é uma SPA e **não entrega o
catálogo por HTTP**. O caminho bom é outro:

```
https://storage.googleapis.com/br-com-mega-ecossistema-api/<Arquivo>.json
```

São **63 arquivos, 983 rotas no total**. Os maiores:

| Rotas | Arquivo |
| --- | --- |
| 281 | `Mega.Erp.Agro.MobAgro.Server.json` |
| 99 | `Mega.Erp.Agro.Integracao.Server.json` |
| 63 | `Mega.Erp.Manufatura.Server.json` |
| 39 | `Mega.Erp.Global.Server.json` |
| 36 | `Mega.Erp.Global.Agentes.Server.json` |
| 31 | `Mega.Erp.Carteira.Server.json` |
| 31 | `Mega.Erp.Construcao.AdmObra.AcompanhamentoContratoEngenhariaX.Server.json` |
| 30 | `Mega.Erp.Construcao.AdmObra.Server.json` |

Outros relevantes para custos: `Mega.Erp.Financeiro.Movimentacao.Server.json`,
`Mega.Erp.Financeiro.Cadastros.Server.json`,
`Mega.Erp.Construcao.Empreiteiros.Medicao.Server.json`,
`Mega.Erp.Construcao.OperacoesFinanceiras.json` (síntese, extrato e saldo do
contrato por id), `Mega.Erp.Contabilidade.Lancamentos.Server.json`,
`Mega.Erp.Estoque.Server.json`, `Mega.Erp.Materiais.PedidoCompra.Server.json`.

**Baixe todos e varra localmente** antes de perguntar a alguém se existe uma
rota. Foi assim que o módulo de contratos foi encontrado.

⚠️ **Os specs não declaram `servers`/`host`.** Todos parecem viver em
`https://rest.megaerp.online`, mas confirme antes de assumir.

⚠️ **Spec não é contrato.** Em vários pontos o comportamento real diverge do
declarado (capitalização de parâmetro, formato de data, tipo de campo). **Meça.**

---

## 5. Armadilhas de implementação (independentes do Mega)

### PowerShell 5.1

```powershell
# ERRADO: devolve UM elemento contendo o array inteiro.
$ap = @($resposta | ConvertFrom-Json)   # $ap.Count == 1

# CERTO: atribuir primeiro, envolver depois.
$dados = $resposta | ConvertFrom-Json
$ap = @($dados)
```

Com o jeito errado, a contagem sai 1 e somas estouram com `op_Addition`. Custou
uma rodada inteira de diagnóstico.

Outros pontos: `ConvertFrom-Json` devolve `PSCustomObject`, não hashtable
(`-AsHashtable` não existe na 5.1); evite `2>&1` em executável nativo; e arquivo
salvo com `Out-File`/`Set-Content` costuma sair **com BOM**, o que faz
`JSON.parse` falhar depois.

### Qualquer linguagem

- **Leia o corpo como texto e remova o BOM** antes de converter.
- **Uma resposta pode vir com BOM também pela API.** Trate.
- **Não parseie o array inteiro de uma vez com validação estrita.** Uma linha
  fora do formato derruba 5.371 boas. Valide linha a linha e conte as recusadas.
- **Datas `dd/MM/yyyy` nunca vão direto para `new Date()`** em JavaScript.

---

## 6. Roteiro sugerido para uma extração nova

1. **Baixe os 63 specs** e varra por palavra-chave (`contrato`, `medicao`,
   `estoque`, `pedido`) para achar o módulo certo.
2. **Autentique uma vez** e guarde o token.
3. **Comece pela rota mais ampla sem filtro** — quase sempre existe uma que traz
   tudo numa chamada. Filtrar depois, em memória, é mais barato e mais seguro
   que fazer N chamadas.
4. **Valide o total contra um `BigNumbers`** do próprio ERP. Se sua soma não
   bate com a dele, o erro é seu.
5. **Só então automatize.** E se for virar rotina, use **cron**, nunca consulta
   ao vivo por requisição de usuário: vários acessos simultâneos autenticam em
   paralelo e derrubam a conta.

---

## 7. O que este documento não cobre

- **Escrita** (criar/alterar títulos, medições, contratos). Existe nos specs,
  não foi testado, e exige autorização.
- **`POST /api/ApropriaMovimentos/Movimento/Listagem`** — o schema tem tudo que
  falta (rateios, financeiro, linha digitável), mas **devolve `[]`**. Seis
  variantes de filtro testadas em 28/08/2026; é job assíncrono Hangfire e voltou
  `Succeeded` em 227 ms sem dado. Ou o módulo AdmObra não tem movimento para a
  Sistenge, ou não está liberado para a conta de API.
- ~~**Data de pagamento.**~~ **Resolvido em 11/09/2026:** é `DataProrrogado`,
  por regra do dono do processo — ver §3.1, item 2. O que continua sem existir é
  um campo com esse nome, e o comprovante em si (que no projeto Financeiro vinha
  da estrutura de pastas do OneDrive).

---

## 8. Referências internas

- Guia original e credenciais:
  `C:\Users\evandro.ferreira\Projects\Financeiro\docs\CONEXAO-MEGA-API.md`
- Uso em produção (cron diário, espelho, conciliação): seção **"Pagamentos no
  Mega"** do `AGENTS.md` do projeto Loca.
- Script de consulta pronto: `scripts/mega-pagamentos.ps1` (Loca).

*Escrito em 11/09/2026. Toda medição citada tem data; ao reusar este documento
daqui a alguns meses, reconfira os números antes de tratá-los como verdade.*
