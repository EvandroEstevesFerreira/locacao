import {
  LayoutDashboard,
  HardHat,
  Truck,
  Package,
  FileText,
  ClipboardCheck,
  Wallet,
  BarChart3,
  Building2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ModuloKey } from "@/lib/modulos";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Se a rota já está implementada. Itens não implementados aparecem "em breve". */
  implementado: boolean;
  /** Visível apenas para o perfil master (ex.: Configurações). */
  apenasMaster?: boolean;
  /** Módulo controlável por usuário (Início/Configurações não têm). */
  modulo?: ModuloKey;
};

/** Navegação principal do app. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Início", href: "/", icon: LayoutDashboard, implementado: true },
  { label: "Obras", href: "/obras", icon: HardHat, implementado: true, modulo: "obras" },
  {
    label: "Fornecedores",
    href: "/fornecedores",
    icon: Truck,
    implementado: true,
    modulo: "fornecedores",
  },
  { label: "Itens", href: "/itens", icon: Package, implementado: true, modulo: "itens" },
  { label: "Contratos", href: "/contratos", icon: FileText, implementado: true, modulo: "contratos" },
  { label: "Imóveis", href: "/imoveis", icon: Building2, implementado: true, modulo: "imoveis" },
  {
    label: "Vistorias",
    href: "/vistorias",
    icon: ClipboardCheck,
    implementado: true,
    modulo: "vistorias",
  },
  { label: "Financeiro", href: "/financeiro", icon: Wallet, implementado: true, modulo: "financeiro" },
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
    implementado: true,
    modulo: "relatorios",
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    implementado: true,
    apenasMaster: true,
  },
];
