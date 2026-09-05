"use client";

// Lookup nome→componente dos ícones de navegação.
//
// Existe para que src/lib/nav.ts fique livre de componentes: o layout (server)
// filtra o nav e passa os itens como props, e funções não atravessam o boundary
// Server → Client. O Record é tipado por NavIconName, então esquecer um ícone é
// erro de compilação, não uma caixa vazia em produção.

import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  PackageOpen,
  ShieldAlert,
  Wrench,
  FileSignature,
  FileText,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/nav";

const ICONES: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "hard-hat": HardHat,
  "trending-up": TrendingUp,
  truck: Truck,
  package: Package,
  boxes: Boxes,
  warehouse: Warehouse,
  "file-text": FileText,
  "building-2": Building2,
  "clipboard-check": ClipboardCheck,
  "clipboard-list": ClipboardList,
  "package-open": PackageOpen,
  "shield-alert": ShieldAlert,
  "wrench": Wrench,
  "file-signature": FileSignature,
  users: Users,
  wallet: Wallet,
  "bar-chart-3": BarChart3,
  sparkles: Sparkles,
  settings: Settings,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
};

export function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  const Icone = ICONES[name];
  return <Icone className={className} aria-hidden />;
}
