import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ArrowLeft, Trash2, Camera, Users, CalendarDays, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { membroSchema } from "@/lib/membroSchema";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { MobileActionBar } from "@/components/mobile/MobileActionBar";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DesktopMemberForm, MEMBER_NOTES_LIMIT } from "@/components/members/DesktopMemberForm";

interface Cargo {
  id: string;
  nome: string;
}

function isValidIsoDate(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [year, month, day] = isoDate.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function formatSavedMemberDate(dataNascimento?: string | null, dataAniversario?: string | null) {
  if (dataNascimento && /^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    const [year, month, day] = dataNascimento.split("-");
    return `${day}/${month}/${year}`;
  }
  if (dataAniversario && /^\d{2}-\d{2}$/.test(dataAniversario)) {
    const [month, day] = dataAniversario.split("-");
    return `${day}/${month}`;
  }
  return "";
}

function parseSmartDate(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const display = [day, month, year].filter(Boolean).join("/");

  if (!digits) {
    return { display, complete: true, data_nascimento: "", data_aniversario: "" };
  }

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const isValidDayMonth =
    day.length === 2 &&
    month.length === 2 &&
    dayNumber >= 1 &&
    dayNumber <= 31 &&
    monthNumber >= 1 &&
    monthNumber <= 12;

  if (!isValidDayMonth) {
    return { display, complete: false, data_nascimento: "", data_aniversario: "" };
  }

  if (year.length === 4) {
    const iso = `${year}-${month}-${day}`;
    return {
      display,
      complete: isValidIsoDate(iso),
      data_nascimento: isValidIsoDate(iso) ? iso : "",
      data_aniversario: "",
    };
  }

  if (digits.length > 4) {
    return { display, complete: false, data_nascimento: "", data_aniversario: "" };
  }

  return { display, complete: true, data_nascimento: "", data_aniversario: `${month}-${day}` };
}

const DetalhesMembro = () => {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();
  const { activeGroupId, isAdmin } = useActiveGroup();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [memberGroupId, setMemberGroupId] = useState<string | null>(null);
  const [cargosDisponiveis, setCargosDisponiveis] = useState<Cargo[]>([]);
  const [cargosLoading, setCargosLoading] = useState(true);
  const [totalPresencas, setTotalPresencas] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState("");
  const [birthInput, setBirthInput] = useState("");
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [dateDraft, setDateDraft] = useState({ day: "", month: "", year: "" });
  const [formData, setFormData] = useState({
    nome: "",
    data_nascimento: "",
    cargos: [] as string[],
    faixa_etaria: "",
    data_aniversario: "",
    foto_url: "",
    observacoes: "",
    telefone: "",
    status_telefone: "",
  });

  const formatBrazilPhone = (value: string) => {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];
  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 121 }, (_, index) => String(currentYear - index));
  }, []);
  const desktopCargos = useMemo(() => {
    const availableNames = new Set(cargosDisponiveis.map((cargo) => cargo.nome));
    const legacy = formData.cargos
      .filter((cargo) => !availableNames.has(cargo))
      .map((nome) => ({ id: `legacy-${nome}`, nome }));
    return [...legacy, ...cargosDisponiveis];
  }, [cargosDisponiveis, formData.cargos]);

  useEffect(() => {
    setConfig({
      title: "Editar membro",
      icon: Users,
      showBackButton: true,
      secondaryActions: (
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors"
          aria-label="Excluir membro"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      ),
      desktopTopbarActions: (
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Excluir membro"
          title="Excluir membro"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    });
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    if (!showDateDialog) return;
    const digits = birthInput.replace(/\D/g, "");
    setDateDraft({
      day: digits.slice(0, 2),
      month: digits.slice(2, 4),
      year: digits.slice(4, 8),
    });
  }, [birthInput, showDateDialog]);

  const loadCargos = useCallback(async () => {
    if (!activeGroupId) {
      setCargosDisponiveis([]);
      setCargosLoading(false);
      return;
    }

    try {
      setCargosLoading(true);
      const { data, error } = await supabase
        .from("cargos")
        .select("*")
        .eq("group_id", activeGroupId)
        .order("nome");

      if (error) throw error;
      setCargosDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
    } finally {
      setCargosLoading(false);
    }
  }, [activeGroupId]);

  const loadMembro = useCallback(async () => {
    if (!activeGroupId) return;

    try {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("id", id)
        .eq("group_id", activeGroupId)
        .single();

      if (error) throw error;

      setFormData({
        nome: data.nome,
        data_nascimento: data.data_nascimento || "",
        cargos: data.cargos || [],
        faixa_etaria: data.faixa_etaria,
        data_aniversario: data.data_aniversario || "",
        foto_url: data.foto_url || "",
        observacoes: data.observacoes || "",
        telefone: data.telefone || "",
        status_telefone: data.status_telefone || "",
      });
      setBirthInput(formatSavedMemberDate(data.data_nascimento, data.data_aniversario));
      setMemberGroupId(data.group_id ?? null);
    } catch (error) {
      console.error("Erro ao carregar membro:", error);
      toast.error("Erro ao carregar dados do membro");
      navigate("/membros");
    }
  }, [activeGroupId, id, navigate]);

  const loadPresencas = useCallback(async () => {
    if (!activeGroupId) {
      setTotalPresencas(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from("presencas")
        .select("*", { count: "exact", head: true })
        .eq("membro_id", id)
        .eq("group_id", activeGroupId);

      if (error) throw error;
      setTotalPresencas(count || 0);
    } catch (error) {
      console.error("Erro ao carregar presenças:", error);
    }
  }, [activeGroupId, id]);

  useEffect(() => {
    void loadMembro();
    void loadCargos();
    void loadPresencas();
  }, [loadCargos, loadMembro, loadPresencas]);

  const processPhotoFile = (file: File) => {
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    // Criar URL temporária para o crop
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setShowCropDialog(true);
    };
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPhotoFile(file);
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setUploadingPhoto(true);

    try {
      // Remover foto antiga se existir
      if (formData.foto_url) {
        const oldPath = formData.foto_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("member-photos").remove([oldPath]);
        }
      }

      // Upload da nova foto cortada
      const fileName = `${id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("member-photos")
        .upload(fileName, croppedImageBlob);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from("member-photos").getPublicUrl(fileName);

      // Atualizar no banco de dados
      const { error: updateError } = await supabase
        .from("membros")
        .update({ foto_url: publicUrl })
        .eq("id", id)
        .eq("group_id", activeGroupId);

      if (updateError) throw updateError;

      setFormData({ ...formData, foto_url: publicUrl });
      toast.success("Foto atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer upload da foto:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateBirthInput = (value: string) => {
    const parsed = parseSmartDate(value);
    setBirthInput(parsed.display);

    if (!parsed.complete) return;

    setFormData((prev) => ({
      ...prev,
      data_nascimento: parsed.data_nascimento,
      data_aniversario: parsed.data_aniversario,
    }));
  };

  const applyDateParts = (day: string, month: string, year: string) => {
    updateBirthInput(`${day}${month}${year}`);
    setShowDateDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (birthInput && !parseSmartDate(birthInput).complete) {
      toast.error("Complete a data ou limpe o campo antes de salvar");
      return;
    }

    const telefoneLimpo = formData.telefone.replace(/\D/g, "");

    const validation = membroSchema.safeParse({
      nome: formData.nome.trim(),
      data_nascimento: formData.data_nascimento || undefined,
      data_aniversario: formData.data_aniversario || undefined,
      faixa_etaria: formData.faixa_etaria,
      cargos: formData.cargos,
      telefone: telefoneLimpo,
      status_telefone: formData.status_telefone,
      observacoes: formData.observacoes,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("membros")
        .update({
          nome: formData.nome,
          data_nascimento: formData.data_nascimento,
          cargos: formData.cargos,
          faixa_etaria: formData.faixa_etaria,
          data_aniversario: formData.data_aniversario,
          foto_url: formData.foto_url,
          observacoes: formData.observacoes,
          telefone: telefoneLimpo || null,
          status_telefone: formData.status_telefone || null,
        })
        .eq("id", id)
        .eq("group_id", activeGroupId);

      if (error) throw error;

      toast.success("Membro atualizado com sucesso!");
      navigate(-1);
    } catch (error) {
      console.error("Erro ao atualizar membro:", error);
      toast.error("Erro ao atualizar membro");
    } finally {
      setLoading(false);
    }
  };

  const handleInativar = async () => {
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;

      const { error } = await supabase
        .from("membros")
        .update({
          ativo: false,
          inativado_em: new Date().toISOString(),
          inativado_motivo: "Inativado manualmente",
          inativado_observacao: null,
        })
        .eq("id", id)
        .eq("group_id", activeGroupId);

      if (error) throw error;

      if (userId && memberGroupId) {
        await supabase.from("member_edit_history").insert({
          member_id: id,
          group_id: memberGroupId,
          user_id: userId,
          action: "inactivate",
          reason: "Inativado manualmente",
          note: null,
        });
      }

      toast.success("Membro inativado com sucesso!");
      navigate("/membros");
    } catch (error) {
      console.error("Erro ao inativar membro:", error);
      toast.error("Erro ao inativar membro");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!isAdmin) {
      toast.error("Apenas admins podem excluir permanentemente.");
      return;
    }

    setLoading(true);

    try {
      const memberId = id;
      const [presencasResult, eventosResult, visitasResult, notasResult] = await Promise.all([
        supabase.from("presencas").delete().eq("membro_id", memberId).eq("group_id", activeGroupId),
        supabase.from("eventos").delete().eq("membro_visitado_id", memberId).eq("group_id", activeGroupId),
        supabase.from("visitas").delete().eq("membro_visitado_id", memberId).eq("group_id", activeGroupId),
        supabase.from("notas").delete().eq("membro_id", memberId).eq("group_id", activeGroupId),
      ]);

      const cleanupError =
        presencasResult.error ?? eventosResult.error ?? visitasResult.error ?? notasResult.error;
      if (cleanupError) throw cleanupError;

      const { error } = await supabase.from("membros").delete().eq("id", memberId).eq("group_id", activeGroupId);
      if (error) throw error;

      toast.success("Membro excluído permanentemente.");
      navigate("/membros");
    } catch (error) {
      console.error("Erro ao excluir membro:", error);
      toast.error("Erro ao excluir membro");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const toggleCargo = (cargoNome: string) => {
    setFormData((prev) => ({
      ...prev,
      cargos: prev.cargos.includes(cargoNome)
        ? prev.cargos.filter((c) => c !== cargoNome)
        : [...prev.cargos, cargoNome],
    }));
  };

  return (
    <>
      <DesktopMemberForm
        mode="edit"
        value={formData}
        birthInput={birthInput}
        photoUrl={formData.foto_url}
        cargos={desktopCargos}
        cargosLoading={cargosLoading}
        saving={loading}
        uploadingPhoto={uploadingPhoto}
        onChange={(patch) => {
          if (patch.telefone !== undefined) {
            setFormData((prev) => ({ ...prev, telefone: formatBrazilPhone(patch.telefone ?? "") }));
            return;
          }
          setFormData((prev) => ({ ...prev, ...patch }));
        }}
        onBirthChange={updateBirthInput}
        onOpenDate={() => setShowDateDialog(true)}
        onToggleCargo={toggleCargo}
        onPhotoFile={processPhotoFile}
        onEditCrop={() => {
          if (formData.foto_url) {
            setTempImageSrc(formData.foto_url);
            setShowCropDialog(true);
          }
        }}
        onCancel={() => navigate(-1)}
        onSubmit={handleSubmit}
      />

      <div className="member-form-page flex h-full w-full justify-center overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom)+12rem)] scrollbar-none md:hidden">
        <div className="member-form-shell member-edit-shell w-full max-w-2xl px-3 py-3 md:h-full md:max-w-none md:px-5 md:py-4 space-y-4">
          <div className="member-form-title hidden md:flex items-center gap-2 md:gap-4 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-8 w-8 md:h-10 md:w-10"
            >
              <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
            <span className="text-xl md:text-3xl font-bold text-foreground flex-1">Editar Membro</span>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8 md:h-10 md:w-10"
            >
              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>

          <Card className="member-edit-photo overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardContent className="px-4 pb-5 pt-4 md:px-6 md:pb-6 md:pt-6">
              <div className="rounded-3xl border border-border/55 bg-background/55 p-3">
                <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Foto do perfil</Label>
                <div className="mt-3 flex items-stretch gap-3">
                  <Avatar className="h-[5.875rem] w-[5.875rem] rounded-2xl border border-border/60 bg-primary/10">
                    <AvatarImage className="rounded-2xl object-cover" src={formData.foto_url} alt={formData.nome} />
                    <AvatarFallback className="rounded-2xl bg-primary/10 text-xl text-primary md:text-2xl">
                      {formData.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
                    <label className="cursor-pointer">
                      <div className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                        {uploadingPhoto ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        Trocar foto
                      </div>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl"
                      onClick={() => {
                        if (formData.foto_url) {
                          setTempImageSrc(formData.foto_url);
                          setShowCropDialog(true);
                        }
                      }}
                      disabled={uploadingPhoto || !formData.foto_url}
                    >
                      Editar recorte
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <h2 className="text-lg md:text-2xl font-semibold text-foreground truncate">
                    {formData.nome || "Novo Membro"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Presenças: <span className="text-base font-semibold text-primary">{totalPresencas}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="member-form-card member-edit-form-card overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pb-4 md:pt-6">
              <CardTitle>Informações do Membro</CardTitle>
            </CardHeader>
            <CardContent className="member-form-content px-4 pb-5 md:px-5">
              <form id="member-upsert-form" onSubmit={handleSubmit} className="member-upsert-grid member-edit-grid space-y-4">
                <div className="member-form-name space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    required
                    autoFocus
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Digite o nome completo"
                    className="h-12 rounded-2xl border-border/60 bg-background/70 text-base"
                  />
                </div>

                <div className="member-form-birth space-y-2">
                  <Label htmlFor="birth_input">Nascimento ou aniversário</Label>
                  <div className="flex gap-2">
                    <Input
                      id="birth_input"
                      inputMode="numeric"
                      value={birthInput}
                      onChange={(e) => updateBirthInput(e.target.value)}
                      placeholder="DD/MM ou DD/MM/AAAA"
                      className="h-12 rounded-2xl border-border/60 bg-background/70 text-base"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 rounded-2xl"
                      onClick={() => setShowDateDialog(true)}
                      aria-label="Abrir seletor de data"
                    >
                      <CalendarDays className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Com ano, salva como nascimento. Sem ano, mantém apenas o aniversário.
                  </p>
                </div>

                <div className="member-form-phone space-y-2">
                  <Label htmlFor="telefone">Telefone (opcional)</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: formatBrazilPhone(e.target.value) })}
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-12 rounded-2xl border-border/60 bg-background/70 text-base"
                  />
                </div>

                {formData.telefone && (
                  <div className="member-form-phone-owner space-y-2">
                    <Label htmlFor="status_telefone">Telefone é de</Label>
                    <Select
                      value={formData.status_telefone}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status_telefone: value })
                      }
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-background/70">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="próprio">Próprio</SelectItem>
                        <SelectItem value="mãe">Mãe</SelectItem>
                        <SelectItem value="pai">Pai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="member-form-roles space-y-2">
                  <Label>Cargos (selecione um ou mais)</Label>
                  <div className="member-form-cargos-list space-y-2 rounded-3xl border border-border/55 bg-background/55 p-3">
                    {cargosLoading ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <div className="h-4 w-4 rounded border border-border/60 bg-muted/40" />
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="h-3 w-32 rounded-full bg-muted/60" />
                            <div className="h-2.5 w-24 rounded-full bg-muted/40" />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="h-4 w-4 rounded border border-border/60 bg-muted/40" />
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="h-3 w-28 rounded-full bg-muted/60" />
                            <div className="h-2.5 w-20 rounded-full bg-muted/40" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {formData.cargos
                          .filter((cargoNome) => !cargosDisponiveis.some((cargo) => cargo.nome === cargoNome))
                          .map((cargoNome) => (
                            <div key={`legacy-${cargoNome}`} className="flex items-center space-x-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-2 py-1.5">
                              <Checkbox
                                id={`legacy-${cargoNome}`}
                                checked
                                onCheckedChange={() => toggleCargo(cargoNome)}
                              />
                              <label htmlFor={`legacy-${cargoNome}`} className="min-w-0 cursor-pointer text-sm font-medium leading-none">
                                {cargoNome}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">Cargo excluído — desmarque para remover</span>
                              </label>
                            </div>
                          ))}
                        {cargosDisponiveis.map((cargo) => (
                        <div key={cargo.id} className="flex items-center space-x-2 rounded-2xl px-2 py-1.5 transition-colors hover:bg-accent/25">
                          <Checkbox
                            id={cargo.id}
                            checked={formData.cargos.includes(cargo.nome)}
                            onCheckedChange={() => toggleCargo(cargo.nome)}
                          />
                          <label
                            htmlFor={cargo.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {cargo.nome}
                          </label>
                        </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="member-form-age-group space-y-2">
                  <Label htmlFor="faixa_etaria">Faixa Etária</Label>
                  <div className="member-age-options hidden md:grid" role="radiogroup" aria-label="Faixa etária">
                    {faixasEtarias.map((faixa) => {
                      const selected = formData.faixa_etaria === faixa;
                      return (
                        <button
                          key={faixa}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setFormData({ ...formData, faixa_etaria: faixa })}
                          className={`member-age-option ${selected ? "is-selected" : ""}`}
                        >
                          <span className="member-age-option-check" aria-hidden="true">
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 text-left">
                            <strong>{faixa}</strong>
                            <small>{faixa === "Crianças" ? "Infância" : faixa === "Meninos" || faixa === "Meninas" ? "Infantojuvenil" : "Juventude"}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <Select
                    required
                    value={formData.faixa_etaria}
                    onValueChange={(value) =>
                      setFormData({ ...formData, faixa_etaria: value })
                    }
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-background/70 md:hidden">
                      <SelectValue placeholder="Selecione a faixa etária" />
                    </SelectTrigger>
                    <SelectContent>
                      {faixasEtarias.map((faixa) => (
                        <SelectItem key={faixa} value={faixa}>
                          {faixa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="member-form-notes space-y-2">
                  <Label htmlFor="observacoes">Observações (opcional)</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    maxLength={MEMBER_NOTES_LIMIT}
                    onChange={(e) =>
                      setFormData({ ...formData, observacoes: e.target.value.slice(0, MEMBER_NOTES_LIMIT) })
                    }
                    placeholder="Observações sobre o membro"
                    rows={3}
                    className="rounded-2xl border-border/60 bg-background/70 text-base"
                  />
                </div>

                {/* ações no mobile ficam no footer fixo */}
                <div className="member-form-actions hidden md:flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div aria-hidden="true" className="h-[calc(env(safe-area-inset-bottom)+12rem)] md:hidden" />
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Como deseja remover este membro?</AlertDialogTitle>
              <AlertDialogDescription>
                Você pode inativar para preservar histórico ou excluir permanentemente (somente admins).
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="sm:justify-between gap-2">
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <div className="flex items-center gap-2">
                <AlertDialogAction
                  onClick={handleInativar}
                  disabled={loading}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                >
                  Tornar inativo
                </AlertDialogAction>
                {isAdmin ? (
                  <AlertDialogAction
                    onClick={handlePermanentDelete}
                    disabled={loading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir permanente
                  </AlertDialogAction>
                ) : null}
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
          <DialogContent className="max-w-sm rounded-3xl border-border/60 bg-background/98 p-4 shadow-[var(--shadow-card)]">
            <DialogHeader>
              <DialogTitle>Selecionar data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>Dia</Label>
                  <Select value={dateDraft.day} onValueChange={(day) => setDateDraft((prev) => ({ ...prev, day }))}>
                    <SelectTrigger className="h-12 rounded-2xl">
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {dayOptions.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mês</Label>
                  <Select value={dateDraft.month} onValueChange={(month) => setDateDraft((prev) => ({ ...prev, month }))}>
                    <SelectTrigger className="h-12 rounded-2xl">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ano</Label>
                  <Select value={dateDraft.year || "none"} onValueChange={(year) => setDateDraft((prev) => ({ ...prev, year: year === "none" ? "" : year }))}>
                    <SelectTrigger className="h-12 rounded-2xl">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="none">Sem ano</SelectItem>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-2xl border border-border/55 bg-card/70 p-3 text-xs text-muted-foreground">
                Dia e mês salvam o aniversário. Ao incluir ano, o app salva como nascimento.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateBirthInput("")}>
                  Limpar
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl"
                  disabled={!dateDraft.day || !dateDraft.month}
                  onClick={() => applyDateParts(dateDraft.day, dateDraft.month, dateDraft.year)}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          cropShape="rect"
        />
      </div>

      {/* Footer fixo (mobile) */}
      <MobileActionBar className="md:hidden" floating>
        <Button type="button" variant="outline" className="bg-background/70" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" form="member-upsert-form" disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </MobileActionBar>
    </>
  );
};

export default DetalhesMembro;
