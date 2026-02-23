import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield } from "lucide-react";

const BOOTSTRAP_ADMIN_EMAIL = "igor.ccb.mts@gmail.com";

export function BootstrapAdminButton(props: {
  accountEmail: string | null;
  isAdmin: boolean;
  onPromoted?: () => void;
}) {
  const { accountEmail, isAdmin, onPromoted } = props;
  const [loading, setLoading] = useState(false);

  const eligible =
    !isAdmin &&
    !!accountEmail &&
    accountEmail.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  if (!eligible) return null;

  const handleBootstrap = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-access", {
        body: { action: "bootstrap_admin" },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Acesso de admin ativado. Recarregando permissões...");
      onPromoted?.();
    } catch (err) {
      console.error("Erro ao ativar admin:", err);
      toast.error("Não foi possível ativar admin agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Ativar acesso de administrador</p>
          <p className="text-xs text-muted-foreground">
            Isso libera todas as funcionalidades do app para esta conta.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleBootstrap}
          disabled={loading}
        >
          <Shield className="h-4 w-4" />
          {loading ? "Ativando..." : "Tornar admin"}
        </Button>
      </div>
    </div>
  );
}
