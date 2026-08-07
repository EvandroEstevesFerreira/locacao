/**
 * Logotipo horizontal da Sistenge (ícone + wordmark).
 * O ícone usa o vermelho oficial da marca (#BE3A31); as letras herdam
 * `currentColor`, então acompanham o tema (claro/escuro) de onde é usado.
 * Fonte: Manual de Identidade Visual — "Versão Fundo Claro".
 *
 * Ser theme-aware por `currentColor` é uma vantagem sobre o Logo do Sistenge
 * People, que precisa de dois arquivos SVG e de um guard de hidratação para
 * escolher entre eles.
 */
export function SistengeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1920 392.19"
      role="img"
      aria-label="Sistenge"
      className={className}
    >
      {/* Ícone (vermelho da marca) */}
      <g fill="#BE3A31">
        <path d="M95.63,305.28h276.21c23.7,0,47.95-19.22,54.16-42.9,6.21-23.69-7.97-42.9-31.68-42.9H118.11l-22.48,85.81Z" />
        <path d="M555.81,76.75h-276.21c-23.7,0-47.95,19.22-54.16,42.9-6.21,23.7,7.97,42.91,31.68,42.91h276.21l22.48-85.82Z" />
      </g>
      {/* Wordmark "SISTENGE" (acompanha o tema) */}
      <g fill="currentColor">
        <path d="M643.58,205.45c-33.51,0-39.7-14.53-31.66-44.61,7.73-28.87,20.96-43.61,55.29-43.61h94.26l-8.87,33.11h-86.19c-9.09,0-13.31,3.64-15.84,13.12-2.49,9.3-.23,12.93,8.86,12.93h47.64c33.52,0,39.67,13.92,31.67,43.8-7.95,29.67-21.64,44.61-55.35,44.61h-97.92l8.81-32.9h90.04c8.89,0,13.34-3.84,15.94-13.53,2.71-10.08-.38-12.91-8.84-12.91h-47.85.01Z" />
        <polygon points="829.48 117.24 789.96 264.79 750.4 264.79 789.92 117.24 829.48 117.24" />
        <path d="M873.32,205.45c-33.51,0-39.7-14.53-31.66-44.61,7.73-28.87,20.96-43.61,55.29-43.61h94.26l-8.87,33.11h-86.19c-9.1,0-13.31,3.64-15.84,13.12-2.49,9.3-.23,12.93,8.86,12.93h47.65c33.52,0,39.67,13.92,31.67,43.8-7.95,29.67-21.64,44.61-55.35,44.61h-97.92l8.81-32.9h90.05c8.88,0,13.33-3.84,15.93-13.53,2.71-10.08-.38-12.91-8.84-12.91h-47.85Z" />
        <polygon points="1054.6 149.14 1002.31 149.14 1010.85 117.24 1154.99 117.24 1146.46 149.14 1094.17 149.14 1063.19 264.79 1023.61 264.79 1054.6 149.14" />
        <polygon points="1287.32 205.25 1191.01 205.25 1183.61 232.9 1280.72 232.9 1272.17 264.8 1135.5 264.8 1175.04 117.24 1311.3 117.24 1302.75 149.14 1206.05 149.14 1198.65 176.79 1294.95 176.79 1287.32 205.25" />
        <polygon points="1430.47 221.81 1458.48 117.24 1495.01 117.24 1455.49 264.79 1407.45 264.79 1362.6 163.88 1335.57 264.79 1298.82 264.79 1338.36 117.24 1385.2 117.24 1430.47 221.81" />
        <path d="M1620.49,264.8h-75.7c-43.61,0-62.05-12.51-45.67-73.66,16.39-61.17,41.61-73.89,85.21-73.89h75.3l-8.7,32.51h-75.1c-19.79,0-28.81,8.07-37.73,41.38-8.92,33.3-4.17,41.18,15.62,41.18h40.78l11.84-44.21h34.72l-20.54,76.7h-.02Z" />
        <polygon points="1800.39 205.25 1704.09 205.25 1696.68 232.9 1793.79 232.9 1785.24 264.8 1648.57 264.8 1688.11 117.24 1824.37 117.24 1815.83 149.14 1719.13 149.14 1711.72 176.79 1808.02 176.79 1800.39 205.25" />
      </g>
    </svg>
  );
}

/**
 * Apenas o símbolo da Sistenge, sem o wordmark — para espaços estreitos
 * (sidebar colapsada, header em mobile). O viewBox recorta o grupo vermelho do
 * logotipo completo, então os dois ficam alinhados pixel a pixel.
 */
export function SistengeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="76 76 500 230"
      role="img"
      aria-label="Sistenge"
      className={className}
      fill="#BE3A31"
    >
      <path d="M95.63,305.28h276.21c23.7,0,47.95-19.22,54.16-42.9,6.21-23.69-7.97-42.9-31.68-42.9H118.11l-22.48,85.81Z" />
      <path d="M555.81,76.75h-276.21c-23.7,0-47.95,19.22-54.16,42.9-6.21,23.7,7.97,42.91,31.68,42.91h276.21l22.48-85.82Z" />
    </svg>
  );
}
