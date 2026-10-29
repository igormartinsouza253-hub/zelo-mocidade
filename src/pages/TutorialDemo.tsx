import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { ZeloLogo } from "@/components/ZeloLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type DemoScreen = {
  title: string;
  section: string;
  description: string;
  kind: string;
};

export const tutorialDemoScreens: Record<string, DemoScreen> = {
  "members-list": { title: "Membros", section: "Membros", description: "Consulte e filtre os membros do grupo.", kind: "members-list" },
  "member-new": { title: "Cadastre um novo membro", section: "Membros", description: "Preencha os dados principais e salve o cadastro.", kind: "member-new" },
  "member-profile": { title: "Perfil do membro", section: "Membros", description: "Veja os dados e o histórico de presença.", kind: "member-profile" },
  "meetings-list": { title: "Reuniões", section: "Reuniões", description: "Acompanhe os encontros do grupo.", kind: "meetings-list" },
  "meeting-new": { title: "Nova reunião", section: "Reuniões", description: "Defina a data, o tema e os recitativos.", kind: "meeting-new" },
  attendance: { title: "Registrar presença", section: "Reuniões", description: "Marque as pessoas presentes antes de salvar.", kind: "attendance" },
  calendar: { title: "Agenda", section: "Agenda", description: "Consulte eventos e compromissos do grupo.", kind: "calendar" },
  "visit-new": { title: "Registrar uma visita", section: "Visitas", description: "Registre o acompanhamento realizado.", kind: "visit-new" },
  "event-new": { title: "Novo evento", section: "Agenda", description: "Adicione um evento à agenda do grupo.", kind: "event-new" },
  "notes-list": { title: "Notas", section: "Notas", description: "Organize informações e próximos passos.", kind: "notes-list" },
  "note-edit": { title: "Editar nota", section: "Notas", description: "Escreva e escolha com quem compartilhar.", kind: "note-edit" },
  "notes-search": { title: "Buscar notas", section: "Notas", description: "Encontre registros pelo título ou conteúdo.", kind: "notes-search" },
  "account-profile": { title: "Meu perfil", section: "Configurações", description: "Revise os dados da sua conta.", kind: "account-profile" },
  notifications: { title: "Notificações", section: "Configurações", description: "Escolha os avisos que deseja receber.", kind: "notifications" },
  application: { title: "Aplicativo", section: "Configurações", description: "Consulte a versão e instale o app.", kind: "application" },
};

const samplePeople = [
  { initials: "AE", name: "Alice Exemplo", age: "17 anos", group: "Moças" },
  { initials: "BE", name: "Bruno Exemplo", age: "19 anos", group: "Moços" },
  { initials: "CE", name: "Camila Exemplo", age: "16 anos", group: "Moças" },
  { initials: "DE", name: "Diego Exemplo", age: "15 anos", group: "Meninos" },
];

const sampleNotes = [
  { title: "Preparação do próximo encontro", date: "Hoje · 09:30", detail: "Separar os recitativos e confirmar a equipe de apoio." },
  { title: "Acompanhamento de outubro", date: "Ontem · 16:10", detail: "Revisar os contatos e os próximos passos da mocidade." },
  { title: "Ideias para a agenda", date: "22 out · 11:45", detail: "Planejamento das atividades para o próximo mês." },
];

function DemoPageTitle({ title, description, action = "" }: { title: string; description: string; action?: string }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span>Início</span><ChevronRight className="h-3 w-3" /><span>{title}</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
    {action && <Button className="shrink-0 rounded-xl"><Plus className="mr-2 h-4 w-4" />{action}</Button>}
  </div>;
}

function DemoField({ label, placeholder, value, type = "text" }: { label: string; placeholder?: string; value?: string; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} placeholder={placeholder} readOnly className="rounded-xl bg-background" /></div>;
}

function DemoSelect({ label, value }: { label: string; value: string }) {
  return <div className="space-y-2"><Label>{label}</Label><div className="flex h-10 items-center justify-between rounded-xl border border-input bg-background px-3 text-sm"><span>{value}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></div></div>;
}

function DemoForm({ children, submit = "Salvar" }: { children: React.ReactNode; submit?: string }) {
  return <Card className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-[var(--shadow-card)]">
    <CardContent className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      <Separator />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" className="rounded-xl">Cancelar</Button><Button className="rounded-xl"><Check className="mr-2 h-4 w-4" />{submit}</Button></div>
    </CardContent>
  </Card>;
}

function PersonRow({ person, selected = false }: { person: (typeof samplePeople)[number]; selected?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{person.initials}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{person.name}</p><p className="text-xs text-muted-foreground">{person.age} · {person.group}</p></div>
    {selected ? <span className="grid h-5 w-5 place-items-center rounded-md bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
  </div>;
}

function MemberList() {
  return <>
    <DemoPageTitle title="Membros" description="Consulte e gerencie os membros do grupo." action="Novo membro" />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input readOnly placeholder="Buscar membro pelo nome..." className="rounded-xl pl-9" /></div><Button variant="outline" className="rounded-xl"><Filter className="mr-2 h-4 w-4" />Filtros</Button></div>
    <div className="mb-4 flex gap-2 overflow-hidden"><Badge className="rounded-lg px-3 py-1.5">Todos · 4</Badge><Badge variant="outline" className="rounded-lg px-3 py-1.5">Ativos · 4</Badge><Badge variant="outline" className="rounded-lg px-3 py-1.5">Visitantes · 0</Badge></div>
    <Card className="rounded-2xl border-border/70"><CardHeader className="pb-2"><CardTitle className="text-base">Lista de membros</CardTitle><CardDescription>4 cadastros fictícios neste exemplo</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{samplePeople.map(person => <PersonRow key={person.name} person={person} />)}</CardContent></Card>
  </>;
}

function MemberCreate() {
  return <><DemoPageTitle title="Novo membro" description="Informe os dados para cadastrar uma pessoa." />
    <Card className="mb-4 rounded-2xl border-border/70"><CardContent className="flex items-center gap-4 p-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground"><Users className="h-6 w-6" /></div><div className="min-w-0"><p className="text-sm font-semibold">Foto de perfil</p><p className="mt-1 text-xs text-muted-foreground">Escolha uma imagem para identificar o cadastro.</p><Button variant="outline" size="sm" className="mt-2 rounded-lg">Selecionar foto</Button></div></CardContent></Card>
    <DemoForm><DemoField label="Nome completo" placeholder="Ex.: Alice Exemplo" /><DemoField label="Telefone (opcional)" placeholder="(00) 00000-0000" /><DemoField label="Data de nascimento" placeholder="dd/mm/aaaa" /><DemoSelect label="Faixa etária" value="Selecione uma faixa" /><DemoSelect label="Cargos" value="Selecione um ou mais cargos" /><DemoField label="Observações (opcional)" placeholder="Informações adicionais" /></DemoForm>
  </>;
}

function MemberProfile() {
  return <><DemoPageTitle title="Perfil do membro" description="Informações e frequência nas reuniões." action="Editar perfil" />
    <Card className="mb-4 rounded-2xl border-border/70"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">AE</div><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Alice Exemplo</h2><p className="mt-1 text-sm text-muted-foreground">17 anos · Moças · Membro ativo</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="secondary" className="rounded-lg">Música</Badge><Badge variant="secondary" className="rounded-lg">Leitura</Badge></div></div><Button variant="outline" className="rounded-xl">Ver histórico</Button></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-3"><Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Presenças</p><p className="mt-2 text-2xl font-bold">18</p></CardContent></Card><Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Frequência</p><p className="mt-2 text-2xl font-bold">90%</p></CardContent></Card><Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Última reunião</p><p className="mt-2 text-base font-semibold">28 de outubro</p></CardContent></Card></div>
  </>;
}

function MeetingList() {
  return <><DemoPageTitle title="Reuniões" description="Acompanhe os encontros e registros de presença." action="Nova reunião" />
    <div className="mb-4 flex gap-2"><Badge className="rounded-lg px-3 py-1.5">Próximas</Badge><Badge variant="outline" className="rounded-lg px-3 py-1.5">Anteriores</Badge><Badge variant="outline" className="rounded-lg px-3 py-1.5">Histórico</Badge></div>
    <div className="space-y-3">{[{day:"02",month:"NOV",title:"Reunião de jovens",detail:"Domingo · 18:00 · Salão principal"},{day:"09",month:"NOV",title:"Encontro da mocidade",detail:"Domingo · 18:00 · Salão principal"},{day:"16",month:"NOV",title:"Reunião de jovens",detail:"Domingo · 18:00 · Salão principal"}].map((meeting, index) => <Card key={`${meeting.day}-${index}`} className="rounded-2xl border-border/70"><CardContent className="flex items-center gap-4 p-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><div className="text-center"><p className="text-lg font-bold leading-none">{meeting.day}</p><p className="mt-1 text-[10px] font-semibold">{meeting.month}</p></div></div><div className="min-w-0 flex-1"><p className="font-semibold">{meeting.title}</p><p className="mt-1 text-xs text-muted-foreground">{meeting.detail}</p></div><Badge variant={index === 0 ? "default" : "secondary"} className="rounded-lg">{index === 0 ? "Próxima" : "Agendada"}</Badge></CardContent></Card>)}</div>
  </>;
}

function MeetingCreate() {
  return <><DemoPageTitle title="Nova reunião" description="Cadastre o encontro e prepare o registro de presença." />
    <DemoForm submit="Criar reunião"><DemoField label="Data" value="02/11/2026" /><DemoField label="Horário" value="18:00" type="time" /><DemoField label="Tema da reunião" placeholder="Informe o tema" /><DemoSelect label="Tipo de encontro" value="Reunião de jovens" /><div className="sm:col-span-2"><DemoField label="Recitativo" placeholder="Selecione um recitativo (opcional)" /></div></DemoForm>
  </>;
}

function Attendance() {
  return <><DemoPageTitle title="Lista de presença" description="Reunião de jovens · 02 de novembro de 2026" />
    <Card className="mb-4 rounded-2xl border-border/70"><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">Presenças registradas</p><p className="mt-1 text-xs text-muted-foreground">Marque cada pessoa presente no encontro.</p></div><Badge className="rounded-lg">2 de 4</Badge></CardContent></Card>
    <div className="mb-3 flex items-center gap-2"><Input readOnly placeholder="Buscar membro..." className="rounded-xl" /><Button variant="outline" size="icon" className="shrink-0 rounded-xl"><Filter className="h-4 w-4" /></Button></div>
    <div className="space-y-2">{samplePeople.map((person, index) => <PersonRow key={person.name} person={person} selected={index < 2} />)}</div><Button className="mt-4 w-full rounded-xl">Salvar presenças</Button>
  </>;
}

function CalendarScreen() {
  const cells = ["", "", "", "", "", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"];
  return <><DemoPageTitle title="Agenda" description="Veja compromissos, aniversários e eventos do grupo." action="Novo evento" />
    <Card className="rounded-2xl border-border/70"><CardHeader className="flex-row items-center justify-between space-y-0 pb-3"><div><CardTitle className="text-base">Novembro de 2026</CardTitle><CardDescription>Agenda da mocidade</CardDescription></div><div className="flex gap-1"><Button variant="outline" size="icon" className="rounded-lg">‹</Button><Button variant="outline" size="icon" className="rounded-lg">›</Button></div></CardHeader><CardContent><div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground sm:gap-2">{["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map(day=><div key={day} className="py-2">{day}</div>)}</div><div className="grid grid-cols-7 gap-1 sm:gap-2">{cells.map((day,index)=><div key={`${day}-${index}`} className={`flex min-h-11 flex-col items-center rounded-lg p-1 text-xs ${day==="2"?"bg-primary/10 font-bold text-primary":"text-foreground"}`}><span>{day}</span>{["2","8","15","22"].includes(day)&&<span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"/>}</div>)}</div><Separator className="my-4"/><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos eventos</p><div className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><CalendarDays className="h-4 w-4 text-primary"/><div><p className="text-sm font-semibold">Reunião de jovens</p><p className="text-xs text-muted-foreground">02 nov · 18:00</p></div></div><div className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><CalendarDays className="h-4 w-4 text-primary"/><div><p className="text-sm font-semibold">Ensaio musical</p><p className="text-xs text-muted-foreground">08 nov · 15:00</p></div></div></div></CardContent></Card>
  </>;
}

function VisitCreate() {
  return <><DemoPageTitle title="Nova visita" description="Registre um acompanhamento realizado." />
    <DemoForm submit="Salvar visita"><DemoSelect label="Pessoa visitada" value="Alice Exemplo" /><DemoSelect label="Tipo de visita" value="Visita domiciliar" /><DemoField label="Data" value="29/10/2026" /><DemoField label="Horário" value="15:30" type="time" /><div className="sm:col-span-2"><Label>Motivo e observações</Label><Textarea readOnly value="Acompanhamento e conversa sobre as próximas atividades." className="mt-2 min-h-24 resize-none rounded-xl bg-background" /></div></DemoForm>
  </>;
}

function EventCreate() {
  return <><DemoPageTitle title="Novo evento" description="Inclua um compromisso na agenda do grupo." />
    <DemoForm submit="Salvar evento"><DemoField label="Nome do evento" placeholder="Ex.: Ensaio musical" /><DemoSelect label="Categoria" value="Atividade do grupo" /><DemoField label="Data" value="08/11/2026" /><DemoField label="Horário" value="15:00" type="time" /><DemoField label="Local" placeholder="Informe o local" /><div className="sm:col-span-2"><Label>Detalhes (opcional)</Label><Textarea readOnly placeholder="Adicione uma descrição para o grupo..." className="mt-2 min-h-20 resize-none rounded-xl bg-background" /></div></DemoForm>
  </>;
}

function NotesList() {
  return <><DemoPageTitle title="Notas" description="Anotações compartilhadas e lembretes do grupo." action="Criar nota" />
    <div className="mb-4 flex gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input readOnly placeholder="Buscar notas..." className="rounded-xl pl-9"/></div><Button variant="outline" className="rounded-xl"><Filter className="mr-2 h-4 w-4"/>Filtros</Button></div>
    <div className="grid gap-3 sm:grid-cols-2">{sampleNotes.map(note=><Card key={note.title} className="rounded-2xl border-border/70 transition-colors"><CardHeader className="pb-2"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{note.title}</CardTitle><FileText className="h-4 w-4 shrink-0 text-primary"/></div><CardDescription>{note.date}</CardDescription></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">{note.detail}</p><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">AE</span>Alice Exemplo</div></CardContent></Card>)}</div>
  </>;
}

function NoteEdit() {
  return <><DemoPageTitle title="Nova nota" description="Registre uma informação para consultar depois." />
    <DemoForm submit="Salvar nota"><div className="sm:col-span-2"><DemoField label="Título" placeholder="Dê um título para a nota" /></div><DemoSelect label="Visibilidade" value="Compartilhada com o grupo" /><DemoSelect label="Categoria" value="Organização" /><div className="sm:col-span-2"><Label>Conteúdo</Label><Textarea readOnly value="Pontos para a próxima reunião:\n\n• Confirmar a equipe de apoio\n• Separar os materiais\n• Revisar a agenda do mês" className="mt-2 min-h-48 resize-none rounded-xl bg-background" /></div></DemoForm>
  </>;
}

function NotesSearch() {
  return <><DemoPageTitle title="Buscar notas" description="Pesquise pelo título, conteúdo ou categoria." />
    <Card className="mb-4 rounded-2xl border-border/70"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input readOnly value="agenda" className="rounded-xl pl-9"/></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="secondary" className="rounded-lg">Todas as notas</Badge><Badge variant="outline" className="rounded-lg">Compartilhadas</Badge><Badge variant="outline" className="rounded-lg">Minhas notas</Badge></div></CardContent></Card>
    <div className="space-y-3">{sampleNotes.slice(0,2).map(note=><Card key={note.title} className="rounded-2xl border-border/70"><CardContent className="p-4"><p className="font-semibold">{note.title}</p><p className="mt-1 text-xs text-muted-foreground">{note.date}</p><p className="mt-3 text-sm text-muted-foreground">{note.detail}</p><div className="mt-3 flex items-center gap-1 text-xs text-primary"><BookOpen className="h-3.5 w-3.5"/>Abrir nota</div></CardContent></Card>)}</div>
  </>;
}

function AccountProfile() {
  return <><DemoPageTitle title="Meu perfil" description="Atualize seus dados e preferências da conta." />
    <Card className="mb-4 rounded-2xl border-border/70"><CardContent className="flex items-center gap-4 p-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 font-semibold text-primary">GD</div><div><p className="font-semibold">Gabriel Demonstração</p><p className="text-xs text-muted-foreground">Conta de demonstração</p><Badge variant="secondary" className="mt-2 rounded-lg">Membro do grupo</Badge></div></CardContent></Card>
    <DemoForm submit="Salvar alterações"><DemoField label="Nome" value="Gabriel Demonstração" /><DemoField label="E-mail" value="gabriel.demo@example.test" /><DemoSelect label="Tema" value="Usar tema do dispositivo" /><DemoSelect label="Idioma" value="Português (Brasil)" /></DemoForm>
  </>;
}

function NotificationSettings() {
  return <><DemoPageTitle title="Notificações" description="Escolha como o Zelo pode avisar você." />
    <Card className="rounded-2xl border-border/70"><CardHeader><CardTitle className="text-base">Preferências de notificação</CardTitle><CardDescription>Você pode alterar estas opções quando quiser.</CardDescription></CardHeader><CardContent className="space-y-1">{[{title:"Reuniões e presenças",detail:"Avisos sobre encontros do grupo"},{title:"Agenda e eventos",detail:"Lembretes de eventos próximos"},{title:"Notas compartilhadas",detail:"Quando uma nota for atualizada"},{title:"Avisos do aplicativo",detail:"Notificações neste dispositivo"}].map((item,index)=><div key={item.title} className="flex items-center gap-3 border-t border-border/60 py-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Bell className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div><Switch checked={index<3} aria-label={item.title}/></div>)}</CardContent></Card>
  </>;
}

function ApplicationSettings() {
  return <><DemoPageTitle title="Aplicativo" description="Informações da versão e instalação no dispositivo." />
    <Card className="mb-4 rounded-2xl border-border/70"><CardContent className="flex items-center gap-4 p-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><ZeloLogo compact className="h-10 w-10 rounded-xl p-1"/></div><div className="min-w-0 flex-1"><p className="font-semibold">Zelo Mocidade</p><p className="text-xs text-muted-foreground">Versão 1.0.0 · Atualizado em 29 out 2026</p></div><Badge variant="secondary" className="rounded-lg">Atualizado</Badge></CardContent></Card>
    <Card className="rounded-2xl border-border/70"><CardHeader><CardTitle className="text-base">Instale o Zelo no seu dispositivo</CardTitle><CardDescription>Acesse o app pela tela inicial e tenha uma experiência mais rápida.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-border/70 bg-muted/30 p-4"><p className="text-sm font-semibold">Como instalar</p><ol className="mt-2 space-y-2 text-xs text-muted-foreground"><li>1. Toque em instalar aplicativo.</li><li>2. Confirme a instalação no navegador.</li><li>3. Abra o Zelo pela tela inicial.</li></ol></div><Button className="w-full rounded-xl"><Plus className="mr-2 h-4 w-4"/>Instalar aplicativo</Button></CardContent></Card>
  </>;
}

function DemoScreenContent({ screen }: { screen: DemoScreen }) {
  switch (screen.kind) {
    case "members-list": return <MemberList />;
    case "member-new": return <MemberCreate />;
    case "member-profile": return <MemberProfile />;
    case "meetings-list": return <MeetingList />;
    case "meeting-new": return <MeetingCreate />;
    case "attendance": return <Attendance />;
    case "calendar": return <CalendarScreen />;
    case "visit-new": return <VisitCreate />;
    case "event-new": return <EventCreate />;
    case "notes-list": return <NotesList />;
    case "note-edit": return <NoteEdit />;
    case "notes-search": return <NotesSearch />;
    case "account-profile": return <AccountProfile />;
    case "notifications": return <NotificationSettings />;
    case "application": return <ApplicationSettings />;
    default: return <DemoPageTitle title={screen.title} description={screen.description} />;
  }
}

export default function TutorialDemo() {
  const { screen: screenKey = "members-list" } = useParams();
  const screen = tutorialDemoScreens[screenKey] ?? tutorialDemoScreens["members-list"];

  return <div className="min-h-screen bg-background text-foreground" data-tutorial-demo="ready">
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b border-border bg-card/95 px-4 shadow-[var(--shadow-soft)] backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl md:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5"/></Button>
          <div className="flex items-center gap-2"><ZeloLogo compact className="h-9 w-9 rounded-xl p-1"/><div><p className="text-sm font-bold leading-tight">Zelo</p><p className="text-[10px] text-muted-foreground">Mocidade CCB</p></div></div>
          <nav className="ml-8 hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            {[{label:"Início",icon:Home},{label:"Membros",icon:Users},{label:"Reuniões",icon:Check},{label:"Calendário",icon:CalendarDays},{label:"Mais",icon:Menu}].map(item=><Button key={item.label} variant={item.label===screen.section || (item.label==="Mais" && screen.section==="Configurações")?"secondary":"ghost"} size="sm" className="rounded-xl px-3"><item.icon className="mr-2 h-4 w-4"/>{item.label}</Button>)}
          </nav>
          <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground lg:flex"><Search className="h-3.5 w-3.5"/>Buscar páginas e dados...</span><Button variant="ghost" size="icon" className="rounded-xl" aria-label="Notificações"><Bell className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className="rounded-xl" aria-label="Configurações"><Settings className="h-4 w-4"/></Button><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">GD</div></div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <main className="min-w-0 w-full px-3 pb-24 pt-5 sm:px-6 sm:pt-7 md:px-8 md:pb-8" data-demo-screen={screenKey}>
          <div className="mx-auto max-w-5xl"><DemoScreenContent screen={screen}/></div>
        </main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-around rounded-2xl border border-border/70 bg-card/95 p-2 shadow-[var(--shadow-elevated)] backdrop-blur md:hidden" aria-label="Navegação mobile">
        {[{label:"Início",icon:Home},{label:"Membros",icon:Users},{label:"Agenda",icon:CalendarDays},{label:"Notas",icon:FileText},{label:"Mais",icon:Menu}].map(item=><div key={item.label} className={`flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] ${item.label===screen.section || (item.label==="Mais" && screen.section==="Configurações")?"bg-primary/10 font-semibold text-primary":"text-muted-foreground"}`}><item.icon className="h-4 w-4"/>{item.label}</div>)}
      </nav>
    </div>
  </div>;
}
