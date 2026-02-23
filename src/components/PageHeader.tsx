import { LucideIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
 
interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
}
 
export function PageHeader({ title, icon: Icon }: PageHeaderProps) {
  const isMobile = useIsMobile();
  return (
    <header className="sticky top-0 z-20 h-11 md:h-16 flex items-center px-3 md:px-6 bg-sidebar-background/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar-background/80 border-b border-sidebar-border">
      <div className="flex items-center gap-3 w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 shadow-sm border border-border/60">
            {!isMobile && Icon && (
              <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            )}
            <h1 className="text-xs md:text-sm font-semibold text-sidebar-foreground truncate">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}
