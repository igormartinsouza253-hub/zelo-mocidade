import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Cake, Check, HeartHandshake, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NotificationRow = { id: string; title: string; message: string; type: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string };

export default function AbrirNotificacao() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<NotificationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const id = params.get("id");

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    void supabase.from("notifications").select("id,title,message,type,entity_type,entity_id,metadata,created_at").eq("id", id).eq("user_id", user.id).maybeSingle().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }
      setItem(data as NotificationRow);
      setLoading(false);
      await supabase.from("notifications").update({ read_at: new Date().toISOString() } as any).eq("id", id).eq("user_id", user.id).is("read_at", null);
    });
    return () => { cancelled = true; };
  }, [id, user]);

  if (loading) return <div className="mx-auto max-w-xl p-4 text-sm text-muted-foreground">Carregando notificação…</div>;
  if (!item) return <div className="mx-auto max-w-xl p-4"><Card><CardHeader><CardTitle>Notificação indisponível</CardTitle><CardDescription>Ela pode ter sido removida ou não pertence a esta conta.</CardDescription></CardHeader><CardContent><Button onClick={() => navigate("/configuracoes?section=notifications")}>Abrir central</Button></CardContent></Card></div>;

  const photo = typeof item.metadata?.photo_url === "string" ? item.metadata.photo_url : null;
  const memberName = typeof item.metadata?.member_name === "string" ? item.metadata.member_name : null;
  const memberId = typeof item.metadata?.member_id === "string" ? item.metadata.member_id : item.entity_type === "birthday" ? item.entity_id : null;
  const names = Array.isArray(item.metadata?.member_names) ? item.metadata.member_names.filter((name): name is string => typeof name === "string") : [];
  const memberIds = Array.isArray(item.metadata?.member_ids) ? item.metadata.member_ids.filter((memberId): memberId is string => typeof memberId === "string") : [];
  const isBirthday = item.type === "birthday";
  const isAbsence = item.type.startsWith("absence_");
  const isFeedback = item.type === "user_feedback" && user?.app_metadata?.super_admin === true;

  return <main className="mx-auto w-full max-w-xl p-4 pb-28 sm:p-6"><Card className="overflow-hidden border-border/70 shadow-lg"><div className="h-2 bg-primary" /><CardHeader><Badge variant="secondary" className="mb-2 w-fit">{isBirthday ? "Celebração" : isAbsence ? "Acompanhamento" : isFeedback ? "Feedback de usuário" : "Notificação"}</Badge><CardTitle className="flex items-center gap-2 text-xl">{isBirthday ? <Cake className="h-5 w-5 text-primary" /> : isAbsence ? <HeartHandshake className="h-5 w-5 text-primary" /> : <Check className="h-5 w-5 text-primary" />}{item.title}</CardTitle><CardDescription>{item.message}</CardDescription></CardHeader><CardContent className="space-y-5">
    {isBirthday && <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3"><Avatar className="h-14 w-14"><AvatarImage src={photo ?? undefined} alt={memberName ?? "Aniversariante"} /><AvatarFallback>{memberName?.slice(0, 2).toUpperCase() ?? "🎂"}</AvatarFallback></Avatar><div><p className="font-semibold">{memberName ?? "Aniversariante do grupo"}</p><p className="text-sm text-muted-foreground">Que tal deixar uma mensagem especial?</p></div></div>}
    {isAbsence && names.length > 0 && <div className="space-y-2 rounded-xl bg-muted/40 p-3"><p className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4" />Jovens para acompanhar</p>{names.map((name, index) => <button key={`${name}-${index}`} type="button" onClick={() => memberIds[index] && navigate(`/membros/visualizar/${encodeURIComponent(memberIds[index])}`)} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground">• {name}</button>)}</div>}
    <div className="flex flex-col gap-2 sm:flex-row">{isFeedback && <Button onClick={() => navigate("/configuracoes/super-admin")}><ArrowRight className="mr-2 h-4 w-4" />Ver feedbacks</Button>}{memberId && <Button onClick={() => navigate(`/membros/visualizar/${encodeURIComponent(memberId)}`)}><ArrowRight className="mr-2 h-4 w-4" />Ver perfil</Button>}{isAbsence && !memberId && <Button variant="outline" onClick={() => navigate("/membros")}>Ver membros</Button>}<Button variant="ghost" onClick={() => navigate("/")}>Ir para o início</Button></div>
  </CardContent></Card></main>;
}
