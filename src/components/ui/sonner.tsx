import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-2xl border-border bg-popover text-popover-foreground shadow-[var(--shadow-elevated)] group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "rounded-xl bg-primary text-primary-foreground",
          cancelButton: "rounded-xl bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
