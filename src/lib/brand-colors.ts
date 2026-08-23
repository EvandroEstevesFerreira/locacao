/**
 * Paleta Sistenge em hex literal.
 *
 * Existe porque três consumidores não resolvem CSS custom properties e por isso
 * precisam legitimamente de hex:
 *  - `src/lib/pdf.tsx` — @react-pdf/renderer não lê var(--...)
 *  - `src/lib/email.ts` — clientes de e-mail não suportam custom properties
 *  - `src/app/global-error.tsx` — substitui o root layout, então globals.css
 *    não é aplicada e os estilos têm de ser inline
 *
 * A ação certa não era eliminar esses hex, era parar de espalhá-los: antes
 * havia ~60 valores soltos entre os dois primeiros arquivos, já divergindo da
 * paleta (`#cf2927` vs `#BE3A31`, `#1f2933` vs `#1d1f20`).
 *
 * Os valores são exatamente os tokens de `src/app/globals.css` convertidos de
 * hsl() para hex. Ao mudar um token lá, mude aqui.
 */

/** Rampa slate — a mesma do Sistenge People. */
export const BRANCO = "#FFFFFF";
export const SLATE_50 = "#F8FAFC"; // --primary-foreground
export const SLATE_100 = "#F1F5F9"; // --muted / --secondary / --accent
export const SLATE_200 = "#E2E8F0"; // --border / --input
export const SLATE_400 = "#94A3B8"; // texto de apoio, rodapés
export const SLATE_500 = "#64748B"; // --muted-foreground
export const SLATE_900 = "#0F172A"; // --foreground / --primary

/** Status. */
export const DESTRUCTIVE = "#DC2828"; // --destructive
export const WARNING_TEXTO = "#92400E";
export const WARNING_FUNDO = "#FEF3C7";
export const WARNING_BORDA = "#B45309";

/**
 * Vermelho oficial do Manual de Identidade Visual Sistenge.
 * USO RESTRITO: logotipo e marcações de crítico. Nunca em CTA, link ou foco —
 * na identidade 2026 a cor de ação é o SLATE_900.
 */
export const MARCA_VERMELHO = "#BE3A31";

/** Superfícies do tema escuro (usadas só onde há media query manual). */
export const DARK_FUNDO = "#070A13";
export const DARK_CARD = "#0B111E";
export const DARK_TEXTO = "#E2E8F0";
export const DARK_TEXTO_FRACO = "#94A3B8";
