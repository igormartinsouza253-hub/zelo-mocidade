import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Step = { title: string; text: string; image: string };
const sections: { title: string; keywords: string; steps: Step[] }[] = [
  { title: "Cadastrar e acompanhar membros", keywords: "membro cadastro frequência perfil", steps: [
    { title: "Encontre um membro", text: "Abra Membros para consultar a lista e use a busca ou os filtros para localizar uma pessoa.", image: "members-list" },
    { title: "Cadastre uma pessoa", text: "Toque em Novo membro, preencha os dados principais e salve o cadastro.", image: "member-new" },
    { title: "Consulte o perfil", text: "Abra um membro para ver informações, frequência e histórico de presença.", image: "member-profile" },
  ] },
  { title: "Registrar reuniões e presenças", keywords: "reunião presença chamada frequência", steps: [
    { title: "Consulte as reuniões", text: "Abra Reuniões para ver os encontros agendados e os registros anteriores.", image: "meetings-list" },
    { title: "Crie uma reunião", text: "Toque em Nova reunião e informe a data, o horário e o tema.", image: "meeting-new" },
    { title: "Registre as presenças", text: "Marque as pessoas presentes e salve para atualizar o histórico.", image: "attendance" },
  ] },
  { title: "Agenda, visitas e eventos", keywords: "agenda calendário visita evento", steps: [
    { title: "Consulte a agenda", text: "Abra Calendário para ver os próximos compromissos e eventos do grupo.", image: "calendar" },
    { title: "Registre uma visita", text: "Acesse Visitas, escolha Nova visita e descreva o acompanhamento.", image: "visit-new" },
    { title: "Crie um evento", text: "Na agenda, toque em Novo evento e informe data, horário e detalhes.", image: "event-new" },
  ] },
  { title: "Notas e comunicação", keywords: "nota anotação chat compartilhar", steps: [
    { title: "Consulte as notas", text: "Abra Notas para ver anotações e informações compartilhadas com o grupo.", image: "notes-list" },
    { title: "Escreva e compartilhe", text: "Crie uma nota, adicione o conteúdo e escolha a visibilidade adequada.", image: "note-edit" },
    { title: "Encontre uma nota", text: "Use a busca para localizar registros pelo título ou conteúdo.", image: "notes-search" },
  ] },
  { title: "Configurações e notificações", keywords: "configuração notificações alertas conta tema", steps: [
    { title: "Personalize sua conta", text: "Em Configurações, revise seu perfil, tema e preferências.", image: "account-profile" },
    { title: "Ajuste os alertas", text: "Escolha os tipos de aviso e as notificações deste dispositivo.", image: "notifications" },
    { title: "Instale o aplicativo", text: "Na área Aplicativo, consulte a versão e toque em Instalar aplicativo.", image: "application" },
  ] },
];

export function HelpCenterSection() {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const filtered = useMemo(() => sections.filter((section) => `${section.title} ${section.keywords} ${section.steps.map((step) => `${step.title} ${step.text}`).join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const current = filtered[Math.min(sectionIndex, Math.max(0, filtered.length - 1))];
  const step = current?.steps[Math.min(stepIndex, (current?.steps.length ?? 1) - 1)];

  return <div className="space-y-4">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Central de ajuda</CardTitle><CardDescription>Pesquise uma tarefa ou percorra os guias ilustrados.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setSectionIndex(0); setStepIndex(0); }} placeholder="Ex.: como marcar presença?" aria-label="Pesquisar ajuda" />
        {query && <Button variant="outline" className="w-full" onClick={() => { setQuery(""); setSectionIndex(0); setStepIndex(0); }}><BookOpen className="mr-2 h-4 w-4" />Abrir tutorial passo a passo</Button>}
        {current && step ? <div className="space-y-3 rounded-2xl border p-4">
          <p className="text-xs font-medium text-primary">{current.title} · Passo {Math.min(stepIndex + 1, current.steps.length)} de {current.steps.length}</p>
          <h3 className="font-semibold">{step.title}</h3><p className="text-sm text-muted-foreground">{step.text}</p>
          <div className="flex max-h-[62vh] min-h-[14rem] items-center justify-center overflow-hidden rounded-xl bg-muted/30 p-2 sm:p-3" aria-label={`Captura de tela: ${step.title} no ${isMobile ? "celular" : "computador"}`}>
            <img className="h-auto max-h-[60vh] w-auto max-w-full rounded-lg border border-border/70 object-contain shadow-[var(--shadow-card)]" src={`/tutorial/${isMobile ? "mobile" : "desktop"}/${step.image}.jpg`} alt={`${step.title} no aplicativo Zelo em ${isMobile ? "tela de celular" : "tela de computador"}`} loading="eager" />
          </div>
          <div className="flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={sectionIndex === 0 && stepIndex === 0} onClick={() => { if (stepIndex > 0) setStepIndex(stepIndex - 1); else { setSectionIndex(Math.max(0, sectionIndex - 1)); setStepIndex((filtered[Math.max(0, sectionIndex - 1)]?.steps.length ?? 1) - 1); } }}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><span className="text-xs text-muted-foreground">Guia {sectionIndex + 1} de {filtered.length} · {isMobile ? "Celular" : "Computador"}</span><Button size="sm" onClick={() => { if (stepIndex < current.steps.length - 1) setStepIndex(stepIndex + 1); else { setSectionIndex((sectionIndex + 1) % filtered.length); setStepIndex(0); } }}>Próximo<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
        </div> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhum guia encontrado. Tente buscar por membros, reunião, presença, agenda ou notas.</p>}
      </CardContent>
    </Card>
  </div>;
}
