import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PENDING_INVITE_KEY = "zelo_pending_invite_token";

function getInviteErrorMessage(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  if (message.includes("not_authenticated")) {
    return "Entre na sua conta para aceitar este convite.";
  }

  if (message.includes("invite_expired")) {
    return "Este convite expirou. Peça ao admin para gerar um novo link.";
  }

  if (message.includes("invite_not_found")) {
    return "Convite inválido ou já removido.";
  }

  if (message.includes("invite_disabled")) {
    return "Este convite foi desativado pelo admin.";
  }

  if (message.includes("profile_missing")) {
    return "Sua conta ainda está sendo preparada. Saia e entre novamente antes de aceitar o convite.";
  }

  return "Não foi possível aceitar o convite agora.";
}

export default function GrupoConvite() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Validando convite...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Link de convite inválido.");
      return;
    }

    if (loading) return;

    if (!user) {
      localStorage.setItem(PENDING_INVITE_KEY, token);
      toast.info("Entre na sua conta para aceitar o convite.");
      navigate("/auth", { replace: true });
      return;
    }

    let cancelled = false;

    const acceptInvite = async () => {
      setStatus("loading");
      setMessage("Adicionando sua conta ao grupo...");

      const { data, error } = await supabase.rpc("accept_group_invite" as any, {
        _token: token,
      });

      if (cancelled) return;

      if (error) {
        const nextMessage = getInviteErrorMessage(error);
        setStatus("error");
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      localStorage.removeItem(PENDING_INVITE_KEY);
      setStatus("success");
      setMessage("Você entrou no grupo com sucesso.");
      toast.success("Convite aceito. Bem-vindo ao grupo!");

      window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 900);
    };

    void acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [loading, navigate, token, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {status === "success" ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : status === "error" ? (
              <ShieldAlert className="h-6 w-6" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </div>
          <CardTitle>Convite de grupo</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === "error" ? (
            <Button type="button" onClick={() => navigate("/grupo", { replace: true })}>
              Ir para grupos
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
