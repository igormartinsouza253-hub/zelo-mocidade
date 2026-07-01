import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Camera, RotateCcw, Sparkles, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { membroSchema } from "@/lib/membroSchema";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { MobileActionBar } from "@/components/mobile/MobileActionBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Cargo {
  id: string;
  nome: string;
}

const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

const maleNames = new Set([
  "joao", "jose", "pedro", "lucas", "gabriel", "davi", "miguel", "arthur", "artur", "daniel", "samuel", "luiz", "luis", "carlos", "paulo", "rafael", "felipe", "matheus", "mateus", "marcos", "tiago", "thiago", "andre", "antonio", "bruno", "caio", "eduardo", "henrique", "igor", "isaac", "leonardo", "murilo", "nicolas", "vitor", "victor",
]);

const femaleNames = new Set([
  "ana", "maria", "julia", "juliana", "beatriz", "bianca", "bruna", "carolina", "clara", "daniela", "debora", "eduarda", "ester", "esther", "gabriela", "giovanna", "isabela", "isabella", "laura", "leticia", "luiza", "mariana", "mirela", "rafaela", "raphaella", "sara", "sofia", "sophia", "valentina", "yasmin", "vitoria", "vitória",
]);

function removeAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function titleCaseName(value: string) {
  const smallWords = new Set(["da", "das", "de", "do", "dos", "e"]);
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((part, index) => {
      if (index > 0 && smallWords.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1);
    })
    .join(" ");
}

function splitName(value: string) {
  const normalized = titleCaseName(value);
  const parts = normalized.split(" ").filter(Boolean);
  return {
    full: normalized,
    first: parts[0] ?? "",
    surname: parts.length > 1 ? parts.slice(1).join(" ") : "",
    isCompound: parts.length > 1,
  };
}

function inferGenderFromName(value: string): "male" | "female" | null {
  const first = removeAccents(splitName(value).first).toLocaleLowerCase("pt-BR");
  if (!first) return null;
  if (femaleNames.has(first)) return "female";
  if (maleNames.has(first)) return "male";
  if (first.endsWith("a")) return "female";
  if (first.endsWith("o") || first.endsWith("el") || first.endsWith("or")) return "male";
  return null;
}

function calculateAgeFromIso(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function inferFaixa(nome: string, dataNascimento: string) {
  const gender = inferGenderFromName(nome);
  const age = calculateAgeFromIso(dataNascimento);
  if (age !== null) {
    if (age <= 5) return "Crianças";
    if (age <= 12) return gender === "female" ? "Meninas" : "Meninos";
    return gender === "female" ? "Moças" : "Moços";
  }
  if (gender === "female") return "Moças";
  if (gender === "male") return "Moços";
  return "";
}

function formatBrazilPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function parseSmartDate(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const display = [day, month, year].filter(Boolean).join("/");
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const isValidDayMonth = day.length === 2 && month.length === 2 && dayNumber >= 1 && dayNumber <= 31 && monthNumber >= 1 && monthNumber <= 12;

  if (!isValidDayMonth) return { display, data_nascimento: "", data_aniversario: "" };

  if (year.length === 4) {
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(Number(year), monthNumber - 1, dayNumber);
    const valid =
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === monthNumber - 1 &&
      parsed.getDate() === dayNumber &&
      calculateAgeFromIso(iso) !== null;

    return { display, data_nascimento: valid ? iso : "", data_aniversario: "" };
  }

  return { display, data_nascimento: "", data_aniversario: `${month}-${day}` };
}

const NovoMembro = () => {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [cargosDisponiveis, setCargosDisponiveis] = useState<Cargo[]>([]);
  const [cargosLoading, setCargosLoading] = useState(true);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState("");
  const [birthInput, setBirthInput] = useState("");
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [dateDraft, setDateDraft] = useState({ day: "", month: "", year: "" });
  const [manualFaixa, setManualFaixa] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    data_nascimento: "",
    cargos: [] as string[],
    faixa_etaria: "",
    data_aniversario: "",
    observacoes: "",
    telefone: "",
    status_telefone: "",
  });

  const nameInfo = useMemo(() => splitName(formData.nome), [formData.nome]);
  const inferredGender = useMemo(() => inferGenderFromName(formData.nome), [formData.nome]);
  const inferredFaixa = useMemo(
    () => inferFaixa(formData.nome, formData.data_nascimento),
    [formData.data_nascimento, formData.nome],
  );
  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 121 }, (_, index) => String(currentYear - index));
  }, []);

  useEffect(() => {
    setConfig({
      title: "Novo membro",
      icon: Users,
      showBackButton: true,
    });
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    loadCargos();
  }, [activeGroupId]);

  useEffect(() => {
    if (!showDateDialog) return;
    const digits = birthInput.replace(/\D/g, "");
    setDateDraft({
      day: digits.slice(0, 2),
      month: digits.slice(2, 4),
      year: digits.slice(4, 8),
    });
  }, [birthInput, showDateDialog]);

  useEffect(() => {
    if (manualFaixa || !inferredFaixa) return;
    setFormData((prev) => (prev.faixa_etaria === inferredFaixa ? prev : { ...prev, faixa_etaria: inferredFaixa }));
  }, [inferredFaixa, manualFaixa]);

  useEffect(() => {
    if (!cameraOpen) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: cameraFacingMode,
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (error) {
        console.error("Erro ao abrir câmera:", error);
        toast.error("Não foi possível abrir a câmera");
        setCameraOpen(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraFacingMode, cameraOpen]);

  const loadCargos = async () => {
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
  };

  const toggleCargo = (cargoNome: string) => {
    setFormData((prev) => ({
      ...prev,
      cargos: prev.cargos.includes(cargoNome)
        ? prev.cargos.filter((c) => c !== cargoNome)
        : [...prev.cargos, cargoNome],
    }));
  };

  const updateNome = (value: string) => {
    setManualFaixa(false);
    setFormData((prev) => ({ ...prev, nome: value }));
  };

  const normalizeNome = () => {
    setFormData((prev) => ({ ...prev, nome: titleCaseName(prev.nome) }));
  };

  const updateBirthInput = (value: string) => {
    const parsed = parseSmartDate(value);
    setBirthInput(parsed.display);
    setManualFaixa(false);
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

  const updateTelefone = (value: string) => {
    setFormData((prev) => ({ ...prev, telefone: formatBrazilPhone(value) }));
  };

  const captureCameraPhoto = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setTempImageSrc(dataUrl);
    setCameraOpen(false);
    setShowCropDialog(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  const handleCropComplete = (croppedImageBlob: Blob) => {
    // Converter blob para file
    const croppedFile = new File([croppedImageBlob], "cropped-image.jpg", {
      type: "image/jpeg",
    });
    
    setPhotoFile(croppedFile);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(croppedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      let foto_url = "";

      // Upload da foto se selecionada
      if (photoFile) {
        setUploadingPhoto(true);
        const fileExt = photoFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("member-photos")
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("member-photos").getPublicUrl(fileName);

        foto_url = publicUrl;
        setUploadingPhoto(false);
      }

      const { data: authData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("membros")
        .insert([
          {
            ...formData,
            group_id: activeGroupId,
            created_by_user_id: authData.user?.id ?? null,
            foto_url,
            data_nascimento: formData.data_nascimento || null,
            data_aniversario: formData.data_aniversario || null,
            observacoes: formData.observacoes || null,
            telefone: telefoneLimpo || null,
            status_telefone: formData.status_telefone || null,
          },
        ]);

      if (error) throw error;

      toast.success("Membro cadastrado com sucesso!");
      navigate(-1);
    } catch (error) {
      console.error("Erro ao cadastrar membro:", error);
      toast.error("Erro ao cadastrar membro");
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  const handleCancel = () => navigate(-1);

  return (
    <>
      <div className="flex h-full w-full justify-center overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom)+12rem)] scrollbar-none md:pb-32 md:scrollbar-thin">
        <div className="w-full max-w-2xl px-3 py-3 md:px-4 md:py-6">
          <div className="hidden md:flex items-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-3xl font-bold text-foreground">Novo Membro</span>
          </div>

          <Card className="overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pb-4 md:pt-6">
              <CardTitle className="text-base md:text-xl">Informações do membro</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-5 md:px-6">
              <form id="member-upsert-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-3xl border border-border/55 bg-background/55 p-3">
                  <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Foto do perfil</Label>
                  <div className="mt-3 flex items-stretch gap-3">
                    <Avatar className="h-[5.875rem] w-[5.875rem] rounded-2xl border border-border/60 bg-primary/10">
                      <AvatarImage className="rounded-2xl object-cover" src={photoPreview} />
                      <AvatarFallback className="rounded-2xl bg-primary/10 text-xl text-primary">
                        {formData.nome ? (
                          formData.nome.charAt(0).toUpperCase()
                        ) : (
                          <Camera className="h-8 w-8" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
                      <Button type="button" className="h-11 rounded-2xl" onClick={() => setCameraOpen(true)}>
                        <Camera className="mr-2 h-4 w-4" />
                        Tirar foto
                      </Button>
                      <label className="cursor-pointer">
                        <div className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background text-sm font-semibold text-foreground transition-colors hover:bg-accent/35">
                          <UserRound className="h-4 w-4" />
                          Galeria
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoSelect}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    required
                    autoFocus
                    value={formData.nome}
                    onChange={(e) => updateNome(e.target.value)}
                    onBlur={normalizeNome}
                    placeholder="Ex: Ana Vitória"
                    autoComplete="name"
                    className="h-12 rounded-2xl border-border/60 bg-background/70 text-base"
                  />
                  {nameInfo.first && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-border/55 bg-background/70 px-2 py-1">
                        Nome: {nameInfo.first}
                      </span>
                      <span className="rounded-full border border-border/55 bg-background/70 px-2 py-1">
                        {nameInfo.isCompound ? `Sobrenome: ${nameInfo.surname}` : "Nome simples"}
                      </span>
                      {inferredGender && (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-primary">
                          {inferredGender === "female" ? "Provável feminino" : "Provável masculino"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
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
                    Com ano, salva como nascimento. Sem ano, salva apenas como aniversário.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone (opcional)</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onChange={(e) => updateTelefone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-12 rounded-2xl border-border/60 bg-background/70 text-base"
                  />
                </div>

                {formData.telefone && (
                  <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label>Cargos (selecione um ou mais)</Label>
                  <div className="space-y-2 rounded-3xl border border-border/55 bg-background/55 p-3">
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
                      cargosDisponiveis.map((cargo) => (
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
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="faixa_etaria">Faixa etária</Label>
                    {inferredFaixa && !manualFaixa && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                        <Sparkles className="h-3 w-3" />
                        sugerida
                      </span>
                    )}
                  </div>
                  <Select
                    required
                    value={formData.faixa_etaria}
                    onValueChange={(value) => {
                      setManualFaixa(true);
                      setFormData({ ...formData, faixa_etaria: value });
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-background/70">
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
                  <p className="text-xs text-muted-foreground">
                    A sugestão usa o primeiro nome e a idade quando a data tem ano.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações (opcional)</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) =>
                      setFormData({ ...formData, observacoes: e.target.value })
                    }
                    placeholder="Observações sobre o membro"
                    rows={3}
                    className="rounded-2xl border-border/60 bg-background/70 text-base"
                  />
                </div>

                {/* ações no mobile ficam no footer fixo */}
                <div className="hidden md:flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading || uploadingPhoto} className="flex-1">
                    {loading || uploadingPhoto ? "Salvando..." : "Salvar Membro"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          cropShape="rect"
        />

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
                Dia e mês salvam o aniversário. Ao incluir ano, o app calcula idade e salva como nascimento.
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

        <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
          <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-border/60 bg-background p-0 shadow-[var(--shadow-card)]">
            <div className="relative aspect-square bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-4 rounded-[2rem] border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                  Abrindo câmera...
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Foto do perfil</p>
                  <p className="text-xs text-muted-foreground">Enquadre o rosto dentro do quadrado.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-2xl"
                  onClick={() => setCameraFacingMode((mode) => (mode === "user" ? "environment" : "user"))}
                  aria-label="Alternar câmera"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setCameraOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="rounded-2xl" disabled={!cameraReady} onClick={captureCameraPhoto}>
                  Capturar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Footer flutuante (mobile) */}
      <MobileActionBar className="md:hidden" floating>
        <Button type="button" variant="outline" className="bg-background/70" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="member-upsert-form"
          disabled={loading || uploadingPhoto}
        >
          {loading || uploadingPhoto ? "Salvando..." : "Salvar"}
        </Button>
      </MobileActionBar>
    </>
  );
};

export default NovoMembro;
