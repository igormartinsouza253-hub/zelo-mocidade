import { useEffect, useState } from "react";
import { ArrowUpRight, Smartphone, Share, MoreVertical, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SNOOZE_DAYS = 7;

interface MobileAppPromptProps {
  userId?: string;
  isMobile: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function MobileAppPrompt({ userId, isMobile }: MobileAppPromptProps) {
  const [open, setOpen] = useState(false);
  const [dismissalKey, setDismissalKey] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsInstalled(standalone);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true); setInstallPrompt(null); setOpen(false);
      window.localStorage.setItem("zelo_tutorial_pending", "1");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const openInstall = () => setOpen(true);
    window.addEventListener("zelo-open-install", openInstall);
    return () => window.removeEventListener("zelo-open-install", openInstall);
  }, []);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) return;

    const key = `zelo_mobile_prompt_v1:${userId}`;
    setDismissalKey(key);
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === "already-using-mobile") return;
    const storedDismissal = Number(storedValue ?? 0);
    const dismissedUntil = Number.isFinite(storedDismissal) ? storedDismissal : 0;
    const timer = window.setTimeout(() => {
      if (dismissedUntil <= Date.now()) setOpen(true);
    }, isMobile ? 1400 : 5000);

    const reopen = () => setOpen(true);
    window.addEventListener("zelo-open-mobile-prompt", reopen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("zelo-open-mobile-prompt", reopen);
    };
  }, [userId, isMobile]);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const dismissForLater = () => {
    if (dismissalKey) {
      window.localStorage.setItem(dismissalKey, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    }
    setOpen(false);
  };

  const markMobileAsInstalled = () => {
    if (dismissalKey) window.localStorage.setItem(dismissalKey, "already-using-mobile");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && dismissalKey && window.localStorage.getItem(dismissalKey) !== "already-using-mobile") {
        window.localStorage.setItem(dismissalKey, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
      }
      setOpen(nextOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle>{isInstalled ? "Zelo instalado" : "Instale o Zelo"}</DialogTitle>
          <DialogDescription>
            {isInstalled ? "O aplicativo já está instalado neste dispositivo." : "Adicione o Zelo à tela inicial para abrir como aplicativo e acessar com mais facilidade."}
          </DialogDescription>
        </DialogHeader>

        {!isInstalled && <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-4 text-center sm:flex-row sm:text-left">
          {isMobile ? <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-background text-primary"><Smartphone className="h-12 w-12" /></div> : <QRCodeSVG value={window.location.origin} size={132} level="M" includeMargin aria-label="QR code para abrir o Zelo no celular" />}
          <div className="space-y-1">
            {installPrompt ? <><p className="font-medium">Instalação pronta</p><p className="text-sm text-muted-foreground">Toque em instalar para adicionar o Zelo ao dispositivo.</p></> : isMobile ? <><p className="font-medium">Adicione à tela inicial</p><p className="text-sm text-muted-foreground">No Safari, toque em <Share className="inline h-4 w-4" /> Compartilhar e “Adicionar à Tela de Início”. No Chrome, use <MoreVertical className="inline h-4 w-4" /> e “Instalar app” ou “Adicionar à tela inicial”.</p></> : <><p className="font-medium">Abra a câmera do celular</p><p className="text-sm text-muted-foreground">Aponte para o código e abra o link. Depois, entre na sua conta normalmente.</p></>}
          </div>
        </div>}

        <DialogFooter className="gap-2 sm:gap-2">
          {!isInstalled && installPrompt && <Button type="button" onClick={() => void installApp()}><Download className="mr-2 h-4 w-4" />Instalar app</Button>}
          {!isInstalled && <Button type="button" variant="ghost" onClick={markMobileAsInstalled}>Já uso no celular</Button>}
          <Button type="button" variant="ghost" onClick={dismissForLater}>{isInstalled ? "Fechar" : "Lembrar depois"}</Button>
          {!isMobile && !isInstalled && <Button type="button" onClick={dismissForLater}>Continuar no navegador <ArrowUpRight className="ml-2 h-4 w-4" /></Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
