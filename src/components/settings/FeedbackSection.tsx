import { useState } from "react";
import { Lightbulb, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FeedbackSection() {
  const { user } = useAuth();
  const { activeGroupId } = useActiveGroup();
  const [category, setCategory] = useState("idea");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 4 || description.trim().length < 12) { toast.error("Informe um título e descreva melhor seu feedback."); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-feedback", { body: { category, title: title.trim(), description: description.trim(), steps: steps.trim() || null, group_id: activeGroupId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.email_sent ? "Feedback enviado para a equipe por e-mail e salvo no Zelo." : "Feedback salvo e enviado aos super administradores. A entrega por e-mail precisa ser configurada no servidor.");
      setTitle(""); setDescription(""); setSteps(""); setCategory("idea");
    } catch (error) { console.error("[FeedbackSection] submit", error); toast.error(error instanceof Error ? error.message : "Não foi possível enviar o feedback."); }
    finally { setSending(false); }
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5" />Enviar feedback</CardTitle><CardDescription>Compartilhe uma ideia ou conte sobre um erro. A equipe responsável poderá entrar em contato pelo seu e-mail.</CardDescription></CardHeader>
    <CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="space-y-2"><Label>Tipo de feedback</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="idea">Ideia ou sugestão</SelectItem><SelectItem value="bug">Bug ou erro</SelectItem><SelectItem value="other">Outro assunto</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="feedback-title">Título</Label><Input id="feedback-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Resuma o feedback" /></div>
      <div className="space-y-2"><Label htmlFor="feedback-description">Descrição</Label><Textarea id="feedback-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} required rows={5} placeholder="O que aconteceu ou como essa ideia ajudaria?" /></div>
      {category === "bug" && <div className="space-y-2"><Label htmlFor="feedback-steps">Como reproduzir? (opcional)</Label><Textarea id="feedback-steps" value={steps} onChange={(event) => setSteps(event.target.value)} maxLength={2000} rows={3} placeholder="1. Abra... 2. Toque em... 3. O erro aparece..." /></div>}
      <p className="text-xs text-muted-foreground">Enviado por {user?.email ?? "sua conta"}{activeGroupId ? " · inclui seu grupo ativo" : ""}.</p>
      <Button type="submit" className="w-full" disabled={sending}><Send className="mr-2 h-4 w-4" />{sending ? "Enviando..." : "Enviar feedback"}</Button>
    </form></CardContent>
  </Card>;
}
