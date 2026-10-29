import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { HelpCenterSection } from "@/components/settings/HelpCenterSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function OnboardingTutorial() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const key = `zelo_tutorial_seen:${user.id}`;
    if (standalone && localStorage.getItem(key) !== "1") setOpen(true);
  }, [user?.id]);

  const finish = () => {
    if (user?.id) localStorage.setItem(`zelo_tutorial_seen:${user.id}`, "1");
    localStorage.removeItem("zelo_tutorial_pending");
    setOpen(false);
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!next) finish(); else setOpen(true); }}>
    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Bem-vindo ao Zelo</DialogTitle><DialogDescription>Comece com este guia passo a passo. Você pode reabri-lo em Configurações → Ajuda e tutoriais.</DialogDescription></DialogHeader>
      <HelpCenterSection />
      <Button onClick={finish} className="w-full">Concluir tutorial</Button>
    </DialogContent>
  </Dialog>;
}
