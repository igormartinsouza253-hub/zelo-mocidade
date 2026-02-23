import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { formatDateShort } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveHslFromCssVar } from "@/lib/resolve-color";

interface MeetingData {
  id: string;
  date: string;
  fullDate: string;
  count: number;
  tema: string;
  visitas: number;
  Crianças?: number;
  Meninos?: number;
  Meninas?: number;
  Moços?: number;
  Moças?: number;
}

interface PopupData {
  date: string;
  tema: string;
  Crianças: number;
  Meninos: number;
  Meninas: number;
  Moços: number;
  Moças: number;
  visitas: number;
  total: number;
}

export default function HistoricoReunioes() {
  const navigate = useNavigate();
  const colors = {
    criancas: resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    meninos: resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    meninas: resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    mocos: resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    mocas: resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    visitas: resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
  };
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<MeetingData[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  
  // Filters state
  const [filters, setFilters] = useState({
    crianças: true,
    meninos: true,
    meninas: true,
    moços: true,
    moças: true,
    visitas: true,
  });
  const [viewMode, setViewMode] = useState<"all" | "monthly">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  useEffect(() => {
    loadAllMeetings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [meetings, filters, viewMode, selectedMonth]);

  const loadAllMeetings = async () => {
    const { data: allMeetings } = await supabase
      .from("reunioes")
      .select("id, data, tema, numero_visitas")
      .order("data", { ascending: false });

    const meetingsData = await Promise.all(
      (allMeetings || []).map(async (meeting) => {
        const { data: presencas } = await supabase
          .from("presencas")
          .select("membro_id")
          .eq("reuniao_id", meeting.id);

        const membroIds = presencas?.map(p => p.membro_id) || [];
        const { data: membrosPresentes } = await supabase
          .from("membros")
          .select("faixa_etaria")
          .in("id", membroIds);

        const faixasCount: Record<string, number> = {};
        (membrosPresentes || []).forEach(membro => {
          faixasCount[membro.faixa_etaria] = (faixasCount[membro.faixa_etaria] || 0) + 1;
        });

        const count = presencas?.length || 0;

        return {
          id: meeting.id,
          date: formatDateShort(meeting.data),
          fullDate: meeting.data,
          count,
          tema: meeting.tema || "Sem tema",
          visitas: meeting.numero_visitas || 0,
          Crianças: faixasCount["Crianças"] || 0,
          Meninos: faixasCount["Meninos"] || 0,
          Meninas: faixasCount["Meninas"] || 0,
          Moços: faixasCount["Moços"] || 0,
          Moças: faixasCount["Moças"] || 0,
        };
      })
    );

    setMeetings(meetingsData);
  };

  const applyFilters = () => {
    let filtered = [...meetings];

    // Apply month filter
    if (viewMode === "monthly" && selectedMonth) {
      filtered = filtered.filter(m => {
        const meetingMonth = m.fullDate.substring(0, 7); // YYYY-MM
        return meetingMonth === selectedMonth;
      });
    }

    setFilteredMeetings(filtered);
  };

  const getAvailableMonths = () => {
    const months = new Set<string>();
    meetings.forEach(m => {
      months.add(m.fullDate.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  };

  const handleBarClick = (data: any) => {
    setPopupData({
      date: data.date,
      tema: data.tema,
      Crianças: data.Crianças || 0,
      Meninos: data.Meninos || 0,
      Meninas: data.Meninas || 0,
      Moços: data.Moços || 0,
      Moças: data.Moças || 0,
      visitas: data.visitas || 0,
      total: (data.Crianças || 0) + (data.Meninos || 0) + (data.Meninas || 0) + (data.Moços || 0) + (data.Moças || 0) + (data.visitas || 0),
    });
    setShowPopup(true);
  };

  return (
    <div className="w-full h-full flex justify-center">
      <div className="w-full max-w-5xl p-3 md:p-4 space-y-4 md:space-y-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            className="h-8 w-8 md:h-10 md:w-10"
          >
            <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-bold">Histórico de Reuniões</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Todas as reuniões registradas ao longo do tempo
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* View mode and month selector */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label>Visualização</Label>
                <Select value={viewMode} onValueChange={(v: "all" | "monthly") => setViewMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as reuniões</SelectItem>
                    <SelectItem value="monthly">Por mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {viewMode === "monthly" && (
                <div className="flex-1 min-w-[200px]">
                  <Label>Selecionar Mês</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableMonths().map(month => {
                        const [year, monthNum] = month.split('-');
                        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                        return (
                          <SelectItem key={month} value={month}>
                            {monthNames[parseInt(monthNum) - 1]} {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Age group filters */}
            <div>
              <Label className="mb-2 block">Exibir Grupos</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="crianças"
                    checked={filters.crianças}
                    onCheckedChange={(checked) => setFilters({ ...filters, crianças: checked as boolean })}
                  />
                  <Label htmlFor="crianças" className="cursor-pointer">Crianças</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="meninos"
                    checked={filters.meninos}
                    onCheckedChange={(checked) => setFilters({ ...filters, meninos: checked as boolean })}
                  />
                  <Label htmlFor="meninos" className="cursor-pointer">Meninos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="meninas"
                    checked={filters.meninas}
                    onCheckedChange={(checked) => setFilters({ ...filters, meninas: checked as boolean })}
                  />
                  <Label htmlFor="meninas" className="cursor-pointer">Meninas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="moços"
                    checked={filters.moços}
                    onCheckedChange={(checked) => setFilters({ ...filters, moços: checked as boolean })}
                  />
                  <Label htmlFor="moços" className="cursor-pointer">Moços</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="moças"
                    checked={filters.moças}
                    onCheckedChange={(checked) => setFilters({ ...filters, moças: checked as boolean })}
                  />
                  <Label htmlFor="moças" className="cursor-pointer">Moças</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visitas"
                    checked={filters.visitas}
                    onCheckedChange={(checked) => setFilters({ ...filters, visitas: checked as boolean })}
                  />
                  <Label htmlFor="visitas" className="cursor-pointer">Visitantes</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participação em Todas as Reuniões</CardTitle>
            <CardDescription>
              Total de participantes por faixa etária e visitas (clique nas colunas para detalhes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={filteredMeetings} onClick={(e) => e?.activePayload && handleBarClick(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                {filters.crianças && (
                  <Bar
                    dataKey="Crianças"
                    stackId="a"
                    fill={colors.criancas}
                    name="Crianças"
                    cursor="pointer"
                  />
                )}
                {filters.meninos && (
                  <Bar
                    dataKey="Meninos"
                    stackId="a"
                    fill={colors.meninos}
                    name="Meninos"
                    cursor="pointer"
                  />
                )}
                {filters.meninas && (
                  <Bar
                    dataKey="Meninas"
                    stackId="a"
                    fill={colors.meninas}
                    name="Meninas"
                    cursor="pointer"
                  />
                )}
                {filters.moços && (
                  <Bar
                    dataKey="Moços"
                    stackId="a"
                    fill={colors.mocos}
                    name="Moços"
                    cursor="pointer"
                  />
                )}
                {filters.moças && (
                  <Bar
                    dataKey="Moças"
                    stackId="a"
                    fill={colors.mocas}
                    name="Moças"
                    cursor="pointer"
                  />
                )}
                {filters.visitas && (
                  <Bar
                    dataKey="visitas"
                    stackId="a"
                    fill={colors.visitas}
                    radius={[8, 8, 0, 0]}
                    name="Visitantes"
                    cursor="pointer"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linha do Tempo das Reuniões</CardTitle>
            <CardDescription>
              Visualize rapidamente os encontros e navegue para os detalhes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative pl-4 border-l border-border/60 space-y-4">
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="relative flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/reunioes/visualizar/${meeting.id}`)}
                >
                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-background bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]" />
                  <div>
                    <p className="font-semibold">{meeting.date}</p>
                    <p className="text-sm text-muted-foreground">{meeting.tema}</p>
                  </div>
                  <div className="text-right text-xs md:text-sm text-muted-foreground">
                    <p className="font-medium">{meeting.count} membros</p>
                    <p>{meeting.visitas} visitas</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Popup Dialog */}
        <Dialog open={showPopup} onOpenChange={setShowPopup}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes da Reunião - {popupData?.date}</DialogTitle>
              <DialogDescription>{popupData?.tema}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <span className="font-medium">Crianças:</span>
                <span className="text-primary font-semibold">{popupData?.Crianças}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <span className="font-medium">Meninos:</span>
                <span className="text-primary font-semibold">{popupData?.Meninos}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <span className="font-medium">Meninas:</span>
                <span className="text-primary font-semibold">{popupData?.Meninas}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <span className="font-medium">Moços:</span>
                <span className="text-primary font-semibold">{popupData?.Moços}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <span className="font-medium">Moças:</span>
                <span className="text-primary font-semibold">{popupData?.Moças}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                <span className="font-medium">Visitas:</span>
                <span className="text-primary font-semibold">{popupData?.visitas}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded border-2 border-primary mt-4">
                <span className="font-bold text-lg">Total:</span>
                <span className="text-primary font-bold text-xl">{popupData?.total}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
