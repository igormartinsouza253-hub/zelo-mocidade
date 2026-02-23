import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const cargoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome do cargo é obrigatório")
    .max(50, "Nome do cargo deve ter no máximo 50 caracteres"),
});

interface Cargo {
  id: string;
  nome: string;
}

export default function Cargos() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [novoCargo, setNovoCargo] = useState("");
  const [cargoParaExcluir, setCargoParaExcluir] = useState<Cargo | null>(null);
  const [loading, setLoading] = useState(false);
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();

  useEffect(() => {
    setConfig({
      title: "Cargos",
      icon: Award,
      showBackButton: true,
      backTo: "/",
    });

    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    loadCargos();
  }, []);

  const loadCargos = async () => {
    try {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, nome")
        .order("nome");

      if (error) throw error;
      setCargos(data || []);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
      toast.error("Erro ao carregar cargos");
    }
  };

  const handleAddCargo = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = cargoSchema.safeParse({ nome: novoCargo.trim() });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("cargos")
        .insert([{ nome: novoCargo.trim(), group_id: activeGroupId }]);

      if (error) throw error;

      toast.success("Cargo adicionado com sucesso!");
      setNovoCargo("");
      loadCargos();
    } catch (error: any) {
      console.error("Erro ao adicionar cargo:", error);
      if (error.code === "23505") {
        toast.error("Este cargo já existe");
      } else {
        toast.error("Erro ao adicionar cargo");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCargo = async () => {
    if (!cargoParaExcluir) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("cargos")
        .delete()
        .eq("id", cargoParaExcluir.id);

      if (error) throw error;

      toast.success("Cargo excluído com sucesso!");
      setCargoParaExcluir(null);
      loadCargos();
    } catch (error) {
      console.error("Erro ao excluir cargo:", error);
      toast.error("Erro ao excluir cargo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col px-3 py-3 md:px-6 md:py-6 max-w-3xl mx-auto">
      <Card className="flex-1 flex flex-col shadow-[var(--shadow-soft)] border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            <CardTitle className="text-base md:text-lg">Gerenciar Cargos</CardTitle>
          </div>
          <CardDescription className="text-xs md:text-sm">Adicione ou remova cargos disponíveis</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <form onSubmit={handleAddCargo} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Novo cargo"
              value={novoCargo}
              onChange={(e) => setNovoCargo(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !novoCargo.trim()}>
              Adicionar
            </Button>
          </form>

          <div className="space-y-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">
            {cargos.map((cargo) => (
              <div
                key={cargo.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-card"
              >
                <span className="text-sm">{cargo.nome}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCargoParaExcluir(cargo)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {cargos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum cargo cadastrado ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!cargoParaExcluir} onOpenChange={() => setCargoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cargo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cargo{" "}
              <span className="font-semibold">{cargoParaExcluir?.nome}</span>?
              {" "}
              Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCargo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
