import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ArrowLeft, Trash2, Upload, Camera, Users } from "lucide-react";
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
interface Cargo {
  id: string;
  nome: string;
}

const DetalhesMembro = () => {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [inativacaoMotivo, setInativacaoMotivo] = useState<string>("");
  const [inativacaoObservacao, setInativacaoObservacao] = useState<string>("");
  const [memberGroupId, setMemberGroupId] = useState<string | null>(null);
  const [cargosDisponiveis, setCargosDisponiveis] = useState<Cargo[]>([]);
  const [cargosLoading, setCargosLoading] = useState(true);
  const [totalPresencas, setTotalPresencas] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState("");
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

  const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

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
    });
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    loadMembro();
    loadCargos();
    loadPresencas();
  }, [id]);

  const loadCargos = async () => {
    try {
      setCargosLoading(true);
      const { data, error } = await supabase
        .from("cargos")
        .select("*")
        .order("nome");

      if (error) throw error;
      setCargosDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
    } finally {
      setCargosLoading(false);
    }
  };

  const loadMembro = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setFormData({
        nome: data.nome,
        data_nascimento: data.data_nascimento,
        cargos: data.cargos || [],
        faixa_etaria: data.faixa_etaria,
        data_aniversario: data.data_aniversario || "",
        foto_url: data.foto_url || "",
        observacoes: data.observacoes || "",
        telefone: data.telefone || "",
        status_telefone: data.status_telefone || "",
      });
      setMemberGroupId(data.group_id ?? null);
    } catch (error) {
      console.error("Erro ao carregar membro:", error);
      toast.error("Erro ao carregar dados do membro");
      navigate("/membros");
    }
  };

  const loadPresencas = async () => {
    try {
      const { count, error } = await supabase
        .from("presencas")
        .select("*", { count: "exact", head: true })
        .eq("membro_id", id);

      if (error) throw error;
      setTotalPresencas(count || 0);
    } catch (error) {
      console.error("Erro ao carregar presenças:", error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        .eq("id", id);

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
        .eq("id", id);

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
    const motivo = inativacaoMotivo.trim();
    const obs = inativacaoObservacao.trim();

    if (!motivo) {
      toast.error("Selecione um motivo");
      return;
    }

    if (motivo === "Outro" && !obs) {
      toast.error("Descreva a justificativa");
      return;
    }

    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;

      const { error } = await supabase
        .from("membros")
        .update({
          ativo: false,
          inativado_em: new Date().toISOString(),
          inativado_motivo: motivo,
          inativado_observacao: obs || null,
        })
        .eq("id", id);

      if (error) throw error;

      if (userId && memberGroupId) {
        await supabase.from("member_edit_history").insert({
          member_id: id,
          group_id: memberGroupId,
          user_id: userId,
          action: "inactivate",
          reason: motivo,
          note: obs || null,
        });
      }

      toast.success("Membro inativado com sucesso!");
      navigate("/membros");
    } catch (error) {
      console.error("Erro ao inativar membro:", error);
      toast.error("Erro ao inativar membro");
    } finally {
      setLoading(false);
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
      <div className="w-full h-full flex justify-center pb-32">
        <div className="w-full max-w-2xl px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
          <div className="hidden md:flex items-center gap-2 md:gap-4 mb-2 md:mb-4">
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

          <Card className="shadow-[var(--shadow-soft)] border-border/50">
            <CardContent className="pt-3 md:pt-6 px-3 md:px-6 pb-3 md:pb-6">
              <div className="flex items-center gap-3 md:gap-6">
                <div className="relative">
                  <Avatar className="h-16 w-16 md:h-24 md:w-24">
                    <AvatarImage src={formData.foto_url} alt={formData.nome} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl md:text-2xl">
                      {formData.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="photo-upload"
                    className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
                  >
                    {uploadingPhoto ? (
                      <div className="h-3.5 w-3.5 md:h-4 md:w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />

                  {formData.foto_url ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTempImageSrc(formData.foto_url);
                          setShowCropDialog(true);
                        }}
                        disabled={uploadingPhoto}
                      >
                        Editar foto atual
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={formData.foto_url} download>
                          Baixar foto
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg md:text-2xl font-semibold text-foreground mb-1 md:mb-2 truncate">
                    {formData.nome || "Novo Membro"}
                  </h2>
                  <div className="flex items-center gap-2 md:gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="text-xs md:text-sm">Presenças:</span>
                      <span className="text-base md:text-lg font-semibold text-primary">
                        {totalPresencas}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-soft)] border-border/50">
            <CardHeader>
              <CardTitle>Informações do Membro</CardTitle>
            </CardHeader>
            <CardContent>
              <form id="member-upsert-form" onSubmit={handleSubmit} className="space-y-4">
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
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) =>
                      setFormData({ ...formData, data_nascimento: e.target.value })
                    }
                  />
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
                    onValueChange={(value) =>
                      setFormData({ ...formData, faixa_etaria: value })
                    }
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
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Inativar membro</AlertDialogTitle>
              <AlertDialogDescription>
                Informe o motivo. O membro não poderá ser selecionado em novas reuniões, mas continuará aparecendo nas reuniões antigas.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={inativacaoMotivo} onValueChange={setInativacaoMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Teste">Teste</SelectItem>
                    <SelectItem value="Mudou de comum">Mudou de comum</SelectItem>
                    <SelectItem value="Casou">Casou</SelectItem>
                    <SelectItem value="Não congrega mais">Não congrega mais</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  value={inativacaoObservacao}
                  onChange={(e) => setInativacaoObservacao(e.target.value)}
                  placeholder={inativacaoMotivo === "Outro" ? "Descreva o motivo" : "Detalhes (se necessário)"}
                  rows={3}
                />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleInativar}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Inativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Footer fixo (mobile) */}
      <MobileActionBar className="md:hidden">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
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
