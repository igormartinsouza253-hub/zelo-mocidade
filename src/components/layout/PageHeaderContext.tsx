import React, { createContext, useContext, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

export interface PageHeaderConfig {
  title: string;
  icon?: LucideIcon;
  breadcrumbs?: BreadcrumbItem[];
  showBackButton?: boolean;
  backTo?: string;
  primaryActions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  mobileSearch?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    menu?: React.ReactNode;
  };
  mobilePrimaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
  };
  mobileActions?: React.ReactNode;
}

interface PageHeaderContextValue {
  config: PageHeaderConfig | null;
  setConfig: (config: PageHeaderConfig | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(
  undefined,
);

export function PageHeaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<PageHeaderConfig | null>(null);

  return (
    <PageHeaderContext.Provider value={{ config, setConfig }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }
  return ctx;
}
