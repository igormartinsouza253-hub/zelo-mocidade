import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cake, Calendar as CalendarIcon, Plus, User, Users, CalendarDays, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { z } from "zod";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Membro {
  id: string;
  nome: string;
  data_nascimento: string | null;
  data_aniversario: string | null;
  cargos: string[];
  faixa_etaria: string;
  created_at: string;
}

interface AniversarianteInfo extends Membro {
  diaAniversario: number;
  mesAniversario: number;
  idade?: number;
}

interface Reuniao {
  id: string;
  data: string;
  tema: string | null;
  observacoes: string | null;
}

interface VisitaCalendar {
  id: string;
  data_visita: string | null;
  motivo: string | null;
  is_past: boolean | null;
}

interface CalendarEvent {
  type: 'birthday' | 'meeting' | 'visit';
  date: Date;
  title: string;
  subtitle?: string;
  id: string;
}

const dataAniversarioSchema = z.object({
  data_aniversario: z.string()
    .regex(/^\d{2}-\d{2}$/, "Formato inválido (use MM-DD)")
    .refine((date) => {
      const [mes, dia] = date.split("-").map(Number);
      if (mes < 1 || mes > 12) return false;
      if (dia < 1 || dia > 31) return false;
      return true;
    }, "Data inválida"),
});

const Aniversariantes = () => {
  const [aniversariantes, setAniversariantes] = useState<AniversarianteInfo[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [visitas, setVisitas] = useState<VisitaCalendar[]>([]);
  const [membrosSemData, setMembrosSemData] = useState<Membro[]>([]);
  const [selectedMembro, setSelectedMembro] = useState<Membro | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataInput, setDataInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showVisits, setShowVisits] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    loadAniversariantes();
    loadReunioes();
    loadVisitas();
  }, []);

  const loadAniversariantes = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .order("nome");

      if (error) throw error;

      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const diaAtual = hoje.getDate();

      const membrosComAniversario: AniversarianteInfo[] = [];
      const membrosSemAniversario: Membro[] = [];

      (data || []).forEach((membro) => {
        let diaAniversario: number | null = null;
        let mesAniversario: number | null = null;
        let idade: number | undefined;

        // Priorizar data_aniversario se existir
        if (membro.data_aniversario) {
          const [mes, dia] = membro.data_aniversario.split("-").map(Number);
          if (mes && dia) {
            mesAniversario = mes;
            diaAniversario = dia;
          }
        } else if (membro.data_nascimento) {
          // Usar data_nascimento se não tiver data_aniversario
          // Parse da data no formato YYYY-MM-DD mantendo a data local
          const [yearNasc, month, day] = membro.data_nascimento.split("-").map(Number);
          mesAniversario = month;
          diaAniversario = day;
          
          // Calcular idade usando a data local parseada
          idade = hoje.getFullYear() - yearNasc;
          const mesPassou = hoje.getMonth() + 1 > month;
          const mesIgualDiaPassou =
            hoje.getMonth() + 1 === month &&
            hoje.getDate() >= day;
          if (!mesPassou && !mesIgualDiaPassou) {
            idade--;
          }
        }

        if (mesAniversario && diaAniversario) {
          membrosComAniversario.push({
            ...membro,
            diaAniversario,
            mesAniversario,
            idade,
          });
        } else {
          membrosSemAniversario.push(membro);
        }
      });

      // Ordenar por proximidade do aniversário
      const aniversariantesOrdenados = membrosComAniversario.sort((a, b) => {
        const diasAteA = calcularDiasAteAniversario(
          mesAtual,
          diaAtual,
          a.mesAniversario,
          a.diaAniversario
        );
        const diasAteB = calcularDiasAteAniversario(
          mesAtual,
          diaAtual,
          b.mesAniversario,
          b.diaAniversario
        );
        return diasAteA - diasAteB;
      });

      setAniversariantes(aniversariantesOrdenados);
      setMembrosSemData(membrosSemAniversario);
    } catch (error) {
      console.error("Erro ao carregar aniversariantes:", error);
    }
  };

  const loadReunioes = async () => {
    try {
      const { data, error } = await supabase
        .from("reunioes")
        .select("id, data, tema, observacoes")
        .order("data", { ascending: false });

      if (error) throw error;
      setReunioes(data || []);
    } catch (error) {
      console.error("Erro ao carregar reuniões:", error);
    }
  };

  const loadVisitas = async () => {
    try {
      const { data, error } = await supabase
        .from("visitas")
        .select("id, data_visita, motivo, is_past")
        .order("data_visita", { ascending: false });

      if (error) throw error;
      const onlyWithDate = (data || []).filter((v) => v.data_visita) as VisitaCalendar[];
      setVisitas(onlyWithDate);
    } catch (error) {
      console.error("Erro ao carregar visitas:", error);
    }
  };

  const calcularDiasAteAniversario = (
    mesAtual: number,
    diaAtual: number,
    mesAniversario: number,
    diaAniversario: number
  ) => {
    const hoje = new Date(new Date().getFullYear(), mesAtual - 1, diaAtual);
    let proximoAniversario = new Date(
      new Date().getFullYear(),
      mesAniversario - 1,
      diaAniversario
    );

    if (proximoAniversario < hoje) {
      proximoAniversario = new Date(
        new Date().getFullYear() + 1,
        mesAniversario - 1,
        diaAniversario
      );
    }

    const diff = proximoAniversario.getTime() - hoje.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const formatarDataAniversario = (mes: number, dia: number) => {
    const meses = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    return `${dia} de ${meses[mes - 1]}`;
  };

  const getDiasAte = (membro: AniversarianteInfo) => {
    const hoje = new Date();
    const dias = calcularDiasAteAniversario(
      hoje.getMonth() + 1,
      hoje.getDate(),
      membro.mesAniversario,
      membro.diaAniversario
    );

    if (dias === 0) return "Hoje! 🎉";
    if (dias === 1) return "Amanhã";
    if (dias <= 30) return `Em ${dias} dias`;
    return formatarDataAniversario(membro.mesAniversario, membro.diaAniversario);
  };

  const aniversariantesDoMes = aniversariantes.filter(
    (m) => m.mesAniversario === new Date().getMonth() + 1
  );

  const getAniversariantesNoDia = (date: Date | undefined) => {
    if (!date) return [];
    const mes = date.getMonth() + 1;
    const dia = date.getDate();
    return aniversariantes.filter(
      (a) => a.mesAniversario === mes && a.diaAniversario === dia
    );
  };

  const getReunioesNoDia = (date: Date | undefined) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return reunioes.filter((r) => r.data === dateStr);
  };

  const getVisitasNoDia = (date: Date | undefined) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return visitas.filter((v) => (v.data_visita || '').split('T')[0] === dateStr);
  };

  const getEventsOnDay = (date: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    if (showBirthdays) {
      const birthdaysOnDay = getAniversariantesNoDia(date);
      birthdaysOnDay.forEach((membro) => {
        events.push({
          type: 'birthday',
          date,
          title: membro.nome,
          subtitle: membro.idade !== undefined ? `${membro.idade} anos` : undefined,
          id: membro.id,
        });
      });
    }

    if (showMeetings) {
      const meetingsOnDay = getReunioesNoDia(date);
      meetingsOnDay.forEach((reuniao) => {
        events.push({
          type: 'meeting',
          date,
          title: reuniao.tema || 'Reunião',
          subtitle: undefined,
          id: reuniao.id,
        });
      });
    }

    if (showVisits) {
      const visitsOnDay = getVisitasNoDia(date);
      visitsOnDay.forEach((visita) => {
        events.push({
          type: 'visit',
          date,
          title: 'Visita',
          subtitle: visita.motivo,
          id: visita.id,
        });
      });
    }

    return events;
  };

  const getProximosAniversarios = (): CalendarEvent[] => {
    const now = new Date();
    const birthdayEvents: CalendarEvent[] = [];

    aniversariantes.forEach((membro) => {
      const currentYear = now.getFullYear();
      let birthdayDate = new Date(currentYear, membro.mesAniversario - 1, membro.diaAniversario);
      
      // Se o aniversário já passou este ano, considerar o próximo ano
      if (birthdayDate < now) {
        birthdayDate = new Date(currentYear + 1, membro.mesAniversario - 1, membro.diaAniversario);
      }

      birthdayEvents.push({
        type: 'birthday',
        date: birthdayDate,
        title: membro.nome,
        subtitle: membro.idade !== undefined ? `${membro.idade} anos` : undefined,
        id: membro.id,
      });
    });

    // Ordenar por proximidade e retornar apenas os 5 próximos
    return birthdayEvents
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  };

  const getEventosDoMes = (): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();

    if (showBirthdays) {
      aniversariantes.forEach((membro) => {
        if (membro.mesAniversario === month) {
          const date = new Date(year, membro.mesAniversario - 1, membro.diaAniversario);
          events.push({
            type: 'birthday',
            date,
            title: membro.nome,
            subtitle: membro.idade !== undefined ? `${membro.idade} anos` : undefined,
            id: membro.id,
          });
        }
      });
    }

    if (showMeetings) {
      reunioes.forEach((reuniao) => {
        const [reuYear, reuMonth, reuDay] = reuniao.data.split('-').map(Number);
        if (reuMonth === month && reuYear === year) {
          const date = new Date(reuYear, reuMonth - 1, reuDay);
          events.push({
            type: 'meeting',
            date,
            title: reuniao.tema || 'Reunião',
            subtitle: undefined,
            id: reuniao.id,
          });
        }
      });
    }

    if (showVisits) {
      visitas.forEach((visita) => {
        if (!visita.data_visita) return;
        const [datePart] = visita.data_visita.split('T');
        const [vYear, vMonth, vDay] = datePart.split('-').map(Number);
        if (vMonth === month && vYear === year) {
          const date = new Date(vYear, vMonth - 1, vDay);
          events.push({
            type: 'visit',
            date,
            title: 'Visita',
            subtitle: visita.motivo,
            id: visita.id,
          });
        }
      });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const handleSaveAniversario = async () => {
    if (!selectedMembro) return;

    const validation = dataAniversarioSchema.safeParse({
      data_aniversario: dataInput,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("membros")
        .update({ data_aniversario: dataInput })
        .eq("id", selectedMembro.id);

      if (error) throw error;

      toast.success("Aniversário adicionado com sucesso!");
      setDialogOpen(false);
      setDataInput("");
      setSelectedMembro(null);
      loadAniversariantes();
    } catch (error) {
      console.error("Erro ao salvar aniversário:", error);
      toast.error("Erro ao salvar aniversário");
    } finally {
      setSaving(false);
    }
  };

  const modifiers = {
    birthday: (date: Date) => {
      if (!showBirthdays) return false;
      const mes = date.getMonth() + 1;
      const dia = date.getDate();
      return aniversariantes.some(
        (a) => a.mesAniversario === mes && a.diaAniversario === dia
      );
    },
    meeting: (date: Date) => {
      if (!showMeetings) return false;
      const dateStr = date.toISOString().split('T')[0];
      return reunioes.some((r) => r.data === dateStr);
    },
    visit: (date: Date) => {
      if (!showVisits) return false;
      const dateStr = date.toISOString().split('T')[0];
      return visitas.some((v) => (v.data_visita || '').split('T')[0] === dateStr);
    },
    both: (date: Date) => {
      if (!showBirthdays || !showMeetings) return false;
      const mes = date.getMonth() + 1;
      const dia = date.getDate();
      const hasBirthday = aniversariantes.some(
        (a) => a.mesAniversario === mes && a.diaAniversario === dia
      );
      const dateStr = date.toISOString().split('T')[0];
      const hasMeeting = reunioes.some((r) => r.data === dateStr);
      return hasBirthday && hasMeeting;
    },
  };

  const modifiersClassNames = {
    birthday: "bg-primary text-primary-foreground font-bold hover:bg-primary/90 hover:text-primary-foreground",
    meeting: "text-white font-bold hover:opacity-90",
    visit: "bg-emerald-500 text-white font-bold hover:bg-emerald-600",
    both: "text-white font-bold hover:opacity-90",
  };

  const modifiersStyles = {
    meeting: { backgroundColor: 'hsl(25, 95%, 53%)' },
    visit: { backgroundColor: 'hsl(160, 84%, 39%)' },
    both: { background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(25, 95%, 53%) 100%)' },
  };

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex h-full w-full flex-col">
        {/* Top bar with action */}
        <div className="flex items-center justify-between px-4 pt-4 md:px-6 md:pt-6">
          <div className="space-y-1">
            <h1 className="text-base md:text-xl font-semibold text-foreground">
              Calendário de Aniversários e Reuniões
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Visualize aniversários, reuniões e próximos eventos em um único calendário inteligente.
            </p>
          </div>

          {membrosSemData.length > 0 && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-1.5 md:gap-2 h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm"
                >
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Adicionar aniversário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar Aniversário</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione o Membro</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                      {membrosSemData.map((membro) => (
                        <Card
                          key={membro.id}
                          className={`cursor-pointer transition-colors ${
                            selectedMembro?.id === membro.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedMembro(membro)}
                        >
                          <CardContent className="flex items-center gap-3 p-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{membro.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {membro.faixa_etaria}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {selectedMembro && (
                    <div className="space-y-2">
                      <Label htmlFor="data_aniversario">
                        Data de Aniversário (MM-DD)
                      </Label>
                      <Input
                        id="data_aniversario"
                        placeholder="Ex: 03-15 para 15 de março"
                        value={dataInput}
                        onChange={(e) => setDataInput(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        setDataInput("");
                        setSelectedMembro(null);
                      }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveAniversario}
                      disabled={!selectedMembro || !dataInput || saving}
                      className="flex-1"
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 px-4 pb-4 pt-2 md:px-6 md:pb-6">
          <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
            {/* Left column: calendar, filtros e eventos do mês */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Filtros e mês atual */}
              <Card className="p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {currentMonth.toLocaleDateString("pt-BR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {getEventosDoMes().length} evento(s) neste mês
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const newMonth = new Date(currentMonth);
                        newMonth.setMonth(newMonth.getMonth() - 1);
                        setCurrentMonth(newMonth);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const newMonth = new Date(currentMonth);
                        newMonth.setMonth(newMonth.getMonth() + 1);
                        setCurrentMonth(newMonth);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="show-birthdays"
                        checked={showBirthdays}
                        onCheckedChange={setShowBirthdays}
                      />
                      <Label
                        htmlFor="show-birthdays"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        <span className="text-sm">Aniversários</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        id="show-meetings"
                        checked={showMeetings}
                        onCheckedChange={setShowMeetings}
                      />
                      <Label
                        htmlFor="show-meetings"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: "hsl(25, 95%, 53%)" }}
                        />
                        <span className="text-sm">Reuniões</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        id="show-visits"
                        checked={showVisits}
                        onCheckedChange={setShowVisits}
                      />
                      <Label
                        htmlFor="show-visits"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: "hsl(160, 84%, 39%)" }}
                        />
                        <span className="text-sm">Visitas</span>
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />
                    <span>
                      {showBirthdays || showMeetings || showVisits
                        ? [
                            showBirthdays && "aniversários",
                            showMeetings && "reuniões",
                            showVisits && "visitas",
                          ]
                            .filter(Boolean)
                            .join(" e ")
                            .replace("aniversários e reuniões e visitas", "aniversários, reuniões e visitas")
                        : "Nenhum evento selecionado"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Calendário em destaque - ocupa toda a altura disponível da coluna */}
              <Card className="flex-1 overflow-hidden">
                <CardContent className="p-3 md:p-4 h-full flex flex-col">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    modifiersStyles={modifiersStyles}
                    className="rounded-md border shadow-[var(--shadow-soft)] p-4 w-full h-full"
                    onDayClick={(date) => {
                      const events = getEventsOnDay(date);
                      if (events.length > 0) {
                        setSelectedDate(date);
                        setEventDialogOpen(true);
                      }
                    }}
                  />

                  {/* Legenda enxuta abaixo do calendário */}
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {showBirthdays && (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                            <Cake className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                          <span>Aniversários</span>
                        </div>
                      )}
                      {showMeetings && (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: "hsl(25, 95%, 53%)" }}
                          >
                            <CalendarDays className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span>Reuniões</span>
                        </div>
                      )}
                      {showVisits && (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: "hsl(160, 84%, 39%)" }}
                          >
                            <Users className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span>Visitas</span>
                        </div>
                      )}
                      {showBirthdays && showMeetings && (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center"
                            style={{
                              background:
                                "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(25, 95%, 53%) 100%)",
                            }}
                          >
                            <span className="text-[10px] text-white font-bold">+</span>
                          </div>
                          <span>Ambos</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column: aniversariantes do mês + próximos aniversários */}
            <div className="flex flex-col gap-4 min-h-0">
              <Card className="max-h-[280px] overflow-hidden">
                <CardContent className="p-3 md:p-4 h-full flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        Aniversariantes de {new Date().toLocaleDateString("pt-BR", { month: "long" })}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {aniversariantesDoMes.length} aniversariante(s) este mês
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {aniversariantesDoMes.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <Cake className="h-8 w-8 mx-auto mb-2 opacity-60" />
                        <p className="text-xs">Nenhum aniversariante neste mês</p>
                      </div>
                    )}

                    {aniversariantesDoMes.map((membro) => (
                      <Card
                        key={membro.id}
                        className="shadow-[var(--shadow-soft)] border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer"
                        onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                      >
                        <CardContent className="flex items-center gap-2 md:gap-3 p-2">
                          <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Cake className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate text-xs md:text-sm">
                              {membro.nome}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs text-muted-foreground">
                              <span>
                                {formatarDataAniversario(
                                  membro.mesAniversario,
                                  membro.diaAniversario
                                )}
                              </span>
                              {membro.idade !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>{membro.idade} anos</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-medium">{getDiasAte(membro)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 overflow-hidden">
                <CardContent className="p-3 md:p-4 h-full flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Próximos aniversários
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {getProximosAniversarios().length}
                    </Badge>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {getProximosAniversarios().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Cake className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum aniversário próximo</p>
                      </div>
                    )}

                    {getProximosAniversarios().map((event, index) => (
                      <Card
                        key={`${event.type}-${event.id}-${index}`}
                        className="shadow-[var(--shadow-soft)] border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer"
                        onClick={() => navigate(`/membros/visualizar/${event.id}`)}
                      >
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                            <Cake className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate text-xs md:text-sm">
                              {event.title}
                            </h4>
                            <div className="flex flex-wrap gap-2 text-[11px] md:text-xs text-muted-foreground">
                              <span>
                                {event.date.toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "long",
                                })}
                              </span>
                              {event.subtitle && (
                                <>
                                  <span>•</span>
                                  <span>{event.subtitle}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Dialog para mostrar eventos do dia */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Eventos -
                {" "}
                {selectedDate?.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </DialogTitle>
              <DialogDescription>
                {getEventsOnDay(selectedDate || new Date()).length} evento(s) nesta data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {getEventsOnDay(selectedDate || new Date()).map((event, index) => (
                <Card
                  key={`${event.type}-${event.id}-${index}`}
                  className="shadow-[var(--shadow-soft)] border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer"
                    onClick={() => {
                      setEventDialogOpen(false);
                      if (event.type === "birthday") {
                        navigate(`/membros/visualizar/${event.id}`);
                      } else if (event.type === "meeting") {
                        navigate(`/reunioes/${event.id}`);
                      } else {
                        navigate("/visitas");
                      }
                    }}
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor:
                            event.type === "birthday"
                              ? "hsl(var(--primary) / 0.1)"
                              : event.type === "meeting"
                              ? "hsl(25, 95%, 53%, 0.1)"
                              : "hsl(160, 84%, 39%, 0.1)",
                        }}
                      >
                        {event.type === "birthday" ? (
                          <Cake className="h-5 w-5 text-primary" />
                        ) : event.type === "meeting" ? (
                          <CalendarDays
                            className="h-5 w-5"
                            style={{ color: "hsl(25, 95%, 53%)" }}
                          />
                        ) : (
                          <Users
                            className="h-5 w-5"
                            style={{ color: "hsl(160, 84%, 39%)" }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground truncate">
                            {event.title}
                          </h4>
                          <Badge
                            variant={
                              event.type === "birthday"
                                ? "default"
                                : event.type === "meeting"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {event.type === "birthday"
                              ? "Aniversário"
                              : event.type === "meeting"
                              ? "Reunião"
                              : "Visita"}
                          </Badge>
                        </div>
                        {event.subtitle && (
                          <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Aniversariantes;
