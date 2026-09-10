# Consulta os pagamentos de um fornecedor no Mega (contas a pagar).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mega-pagamentos.ps1 -Codigo 2630
#   ... -Codigo 2630 -Inicio 2026-01-01 -Fim 2026-12-31
#   ... -Codigo 2630 -Json          # saida crua, para o agente processar
#
# `-Codigo` e o `fornecedor.codigo_mega` do Loca, sem prefixo. Ver a secao
# "Pagamentos no Mega" do AGENTS.md.
#
# NAO imprime credencial nem TENANT. Reaproveita o token salvo enquanto valido:
# o guia do Mega registra que encadear autenticacao ja bloqueou a conta
# `120.apifin` uma vez.

param(
  [Parameter(Mandatory = $true)][string]$Codigo,
  [string]$Inicio = (Get-Date -Format 'yyyy-01-01'),
  [string]$Fim = (Get-Date -Format 'yyyy-12-31'),
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

$arqCred = 'C:\temp\mega_cred.txt'
$arqTok = 'C:\temp\mega_token.txt'
$base = 'https://rest.megaerp.online'

if (-not (Test-Path $arqCred)) {
  Write-Host "Credencial nao encontrada em $arqCred."
  Write-Host "Ver: C:\Users\evandro.ferreira\Projects\Financeiro\docs\CONEXAO-MEGA-API.md"
  exit 1
}

$cred = @{}
Get-Content $arqCred | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { $cred[$matches[1].Trim()] = $matches[2].Trim() }
}

function Autenticar {
  $h = @{ grantType = 'Api'; tenantId = $cred['TENANT']; 'Content-Type' = 'application/json'; Accept = 'application/json' }
  $b = (@{ userName = $cred['USER']; password = $cred['PASSWORD'] } | ConvertTo-Json -Compress)
  $r = Invoke-WebRequest "$base/api/Auth/SignIn" -Method POST -Headers $h -Body $b -UseBasicParsing -TimeoutSec 40
  # Erro de auth volta HTTP 200 com text/plain. Nunca converter direto.
  $t = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  if (-not $t.Trim().StartsWith('{')) { Write-Host "FALHA NA AUTENTICACAO. Pare e leia o corpo antes de repetir."; exit 1 }
  $tk = ($t | ConvertFrom-Json).accessToken
  $tk | Set-Content $arqTok -NoNewline
  return $tk
}

$tok = $null
if (Test-Path $arqTok) {
  # Token vale 2 h; 100 min deixa margem para a consulta terminar.
  $idade = (Get-Date) - (Get-Item $arqTok).LastWriteTime
  if ($idade.TotalMinutes -lt 100) { $tok = Get-Content $arqTok -Raw }
}
if (-not $tok) { $tok = Autenticar }

$hh = @{ Authorization = ('Bearer ' + $tok); tenantId = $cred['TENANT']; Accept = 'application/json' }
# O codigo vai CRU na rota de contas a pagar. O formato "1-2630" que o guia
# menciona so vale em /globalagente/Agente/{id}; aqui a API recusa.
$rota = "/api/FinanceiroMovimentacao/FaturaPagar/Saldo/Agente/$Codigo/$Inicio/$Fim"

try {
  $x = Invoke-WebRequest ($base + $rota) -Headers $hh -UseBasicParsing -TimeoutSec 60
} catch {
  $msg = $_.ErrorDetails.Message; if (-not $msg) { $msg = $_.Exception.Message }
  Write-Host ("FALHA: " + $msg)
  exit 1
}
$s = [System.Text.Encoding]::UTF8.GetString($x.RawContentStream.ToArray())
if (-not ($s.Trim().StartsWith('[') -or $s.Trim().StartsWith('{'))) {
  Write-Host ("NAO-JSON: " + $s); exit 1
}

if ($Json) { Write-Output $s; exit 0 }

# ATRIBUIR ANTES DE EMBRULHAR. No PowerShell 5.1,
# `@($s | ConvertFrom-Json)` devolve UM elemento contendo o array inteiro -- a
# contagem sai 1 e a soma estoura com "op_Addition". Atribuir primeiro e
# envolver depois desenrola certo.
$dados = $s | ConvertFrom-Json
$ap = @($dados)
Write-Host ("Fornecedor " + $Codigo + " | " + $Inicio + " a " + $Fim + " | " + $ap.Count + " parcelas")
if ($ap.Count -eq 0) { exit 0 }

$pago = 0.0; $aberto = 0.0
foreach ($p in $ap) {
  # SaldoAtual zerado = parcela quitada. A rota NAO devolve data de pagamento:
  # da para saber SE pagou, nao QUANDO.
  $situacao = if ($p.SaldoAtual -eq 0) { 'PAGA  ' } else { 'ABERTA' }
  if ($p.SaldoAtual -eq 0) { $pago += $p.ValorParcela } else { $aberto += $p.SaldoAtual }
  Write-Host ("  " + $situacao + " AP " + $p.NumeroAP + " | " + $p.TipoDocumento +
    " | doc " + $p.NumeroDocumento + " | parc " + $p.NumeroParcela +
    " | venc " + $p.DataVencimento + " | R$ " + $p.ValorParcela)
}
Write-Host ("  ----")
Write-Host ("  pago: R$ " + [math]::Round($pago, 2) + " | em aberto: R$ " + [math]::Round($aberto, 2))
