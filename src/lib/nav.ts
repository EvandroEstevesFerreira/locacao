import {
  LayoutDashboard,
  HardHat,
  Truck,
  Package,
  FileText,
  ClipboardCheck,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Se a rota já está implementada. Itens não implementados aparecem "em breve". */
  implementado: boolean;
  /** Visível apenas para o perfil master (ex.: Configurações). */
  apenasMaster?: boolean;
};

/** Navegação principal do app. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Início", href: "/", icon: LayoutDashboard, implementado: true },
  { label: "Obras", href: "/obras", icon: HardHat, implementado: true },
  {
    label: "Fornecedores",
    href: "/fornecedores",
    icon: Truck,
    implementado: true,
  },
  { label: "Itens", href: "/itens", icon: Package, implementado: true },
  { label: "Contratos", href: "/contratos", icon: FileText, implementado: true },
  {
    label: "Vistorias",
    href: "/vistorias",
    icon: ClipboardCheck,
    implementado: true,
  },
  { label: "Financeiro", href: "/financeiro", icon: Wallet, implementado: true },
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
    implementado: true,
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    implementado: true,
    apenasMaster: true,
  },
];
