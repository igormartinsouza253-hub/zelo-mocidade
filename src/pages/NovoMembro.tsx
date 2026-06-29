import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, Users } from "lucide-react";
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

interface Cargo {
  id: string;
  nome: string;
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

  const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

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
      <div className="w-full h-full flex justify-center pb-32">
        <div className="w-full max-w-2xl px-4 py-4 md:py-6">
          <div className="hidden md:flex items-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-3xl font-bold text-foreground">Novo Membro</span>
          </div>

          <Card className="shadow-[var(--shadow-soft)] border-border/50">
            <CardHeader>
              <CardTitle>Informações do Membro</CardTitle>
            </CardHeader>
            <CardContent>
              <form id="member-upsert-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Foto do Perfil</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={photoPreview} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {formData.nome ? (
                          formData.nome.charAt(0).toUpperCase()
                        ) : (
                          <Camera className="h-8 w-8" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
                        <Camera className="h-4 w-4" />
                        <span className="text-sm">Selecionar Foto</span>
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

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    required
                    autoFocus
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Digite o nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">Data de Nascimento (opcional)</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) =>
                      setFormData({ ...formData, data_nascimento: e.target.value })
                    }
                    placeholder="AAAA-MM-DD"
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você pode digitar a data diretamente no formato AAAA-MM-DD (ex: 2000-03-15)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_aniversario">
                    Data de Aniversário (opcional, formato: MM-DD)
                  </Label>
                  <Input
                    id="data_aniversario"
                    placeholder="Ex: 03-15 para 15 de março"
                    value={formData.data_aniversario}
                    onChange={(e) =>
                      setFormData({ ...formData, data_aniversario: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone (opcional)</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
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
                      <SelectTrigger>
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
                  <div className="space-y-2 border rounded-md p-4">
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
                        <div key={cargo.id} className="flex items-center space-x-2">
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
                  <Label htmlFor="faixa_etaria">Faixa Etária</Label>
                  <Select
                    required
                    value={formData.faixa_etaria}
                    onValueChange={(value) => setFormData({ ...formData, faixa_etaria: value })}
                  >
                    <SelectTrigger>
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
        />
      </div>

      {/* Footer fixo (mobile) */}
      <MobileActionBar className="md:hidden">
        <Button type="button" variant="outline" onClick={handleCancel}>
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
