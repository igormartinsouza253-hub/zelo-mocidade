import { useEffect, useState } from "react";
import { Download, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

declare const __APP_VERSION__: string;
declare const __APP_BUILD_ID__: string;

export function AppSettingsSection() {
  const [installAvailable, setInstallAvailable] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onInstall = () => setInstallAvailable(true);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  const checkUpdate = async () => {
    setChecking(true);
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (!registration) throw new Error("Service worker indisponível");
      await registration.update();
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent("zelo-update-ready", { detail: { update: () => registration.waiting?.postMessage({ type: "SKIP_WAITING" }) } }));
        window.setTimeout(() => { setChecking(false); window.location.reload(); }, 1500);
      } else {
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  };

  return <div className="space-y-3">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Aplicativo</CardTitle><CardDescription>Versão instalada e acesso ao Zelo no dispositivo.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border p-3"><p className="text-sm font-medium">Zelo v{__APP_VERSION__}</p><p className="text-xs text-muted-foreground">Build {__APP_BUILD_ID__}</p></div>
        <Button variant="outline" className="w-full" onClick={() => window.dispatchEvent(new Event("zelo-open-install"))}><Download className="mr-2 h-4 w-4" />Instalar app neste dispositivo</Button>
        {installAvailable && <p className="text-xs text-muted-foreground">Seu navegador permite instalação direta.</p>}
        <Button variant="outline" className="w-full" disabled={checking} onClick={() => void checkUpdate()}><RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />Verificar atualizações</Button>
      </CardContent>
    </Card>
  </div>;
}
