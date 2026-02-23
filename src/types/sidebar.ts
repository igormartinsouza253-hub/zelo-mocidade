import { LucideIcon } from "lucide-react";

export interface SidebarShortcut {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  visible: boolean;
  order: number;
}

export interface SidebarPreferences {
  shortcuts: SidebarShortcut[];
}
