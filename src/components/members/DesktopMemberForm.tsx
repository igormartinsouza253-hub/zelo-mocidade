import type { DragEvent, FormEvent } from "react";
import { CalendarDays, Camera, Check, Upload, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const MEMBER_NOTES_LIMIT = 500;

interface Cargo {
  id: string;
  nome: string;
}

interface MemberFormValue {
  nome: string;
  cargos: string[];
  faixa_etaria: string;
  observacoes: string;
  telefone: string;
}

interface DesktopMemberFormProps {
  mode: "create" | "edit";
  value: MemberFormValue;
  birthInput: string;
  photoUrl: string;
  cargos: Cargo[];
  cargosLoading: boolean;
  saving: boolean;
  uploadingPhoto: boolean;
  onChange: (patch: Partial<MemberFormValue>) => void;
  onBirthChange: (value: string) => void;
  onOpenDate: () => void;
  onToggleCargo: (cargo: string) => void;
  onPhotoFile: (file: File) => void;
  onEditCrop?: () => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const AGE_GROUPS = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

export function DesktopMemberForm({
  mode,
  value,
  birthInput,
  photoUrl,
  cargos,
  cargosLoading,
  saving,
  uploadingPhoto,
  onChange,
  onBirthChange,
  onOpenDate,
  onToggleCargo,
  onPhotoFile,
  onEditCrop,
  onCancel,
  onSubmit,
}: DesktopMemberFormProps) {
  const acceptDroppedPhoto = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onPhotoFile(file);
  };

  return (
    <div className="hidden h-full min-h-0 overflow-hidden p-4 md:block">
      <form
        id="member-desktop-upsert-form"
        onSubmit={onSubmit}
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-[20px] border border-border bg-card p-2"
      >
        <h1 className="px-1 pt-0.5 text-sm font-extrabold text-foreground">
          {mode === "create" ? "Cadastre um novo membro" : "Edite as informações do membro"}
        </h1>

        <div className="grid min-h-0 grid-cols-[minmax(210px,.78fr)_minmax(260px,1fr)_minmax(280px,1.08fr)] gap-4">
          <section className="flex min-h-0 flex-col rounded-[18px] border border-border bg-background/35 p-3">
            <Avatar className="aspect-square h-auto w-full flex-none rounded-[17px] border border-border/70 bg-secondary">
              <AvatarImage className="rounded-[17px] object-contain" src={photoUrl} alt={value.nome || "Foto do membro"} />
              <AvatarFallback className="rounded-[17px] bg-secondary text-primary">
                <UserRound className="h-24 w-24 stroke-[1.4]" />
              </AvatarFallback>
            </Avatar>

            <div className="mb-2 mt-2">
              <p className="text-sm font-bold">Foto de perfil</p>
              <p className="text-[10px] text-muted-foreground">Escolha uma foto de perfil para o membro</p>
            </div>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={acceptDroppedPhoto}
              className="group flex min-h-[108px] flex-1 cursor-pointer flex-col items-center justify-center rounded-[17px] border border-border bg-card px-4 text-center transition-colors hover:border-primary/70 hover:bg-primary/5"
            >
              <Upload className="mb-2 h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              <span className="max-w-[150px] text-sm font-bold leading-tight">Arraste aqui o arquivo da foto</span>
              <span className="mt-1 text-[10px] text-muted-foreground">PNG ou JPG, até 5 MB</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onPhotoFile(file);
                  event.target.value = "";
                }}
              />
            </label>

            <div className={`mt-2 grid gap-2 ${mode === "edit" && photoUrl ? "grid-cols-2" : "grid-cols-1"}`}>
              {mode === "edit" && photoUrl ? (
                <Button type="button" variant="secondary" className="h-9 rounded-[15px] text-xs" onClick={onEditCrop} disabled={uploadingPhoto}>
                  Editar recorte
                </Button>
              ) : null}
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[15px] bg-secondary px-3 text-xs font-bold text-secondary-foreground hover:bg-secondary/80">
                <Camera className="h-3.5 w-3.5" />
                {uploadingPhoto ? "Enviando..." : mode === "edit" ? "Trocar foto" : "Arquivos"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onPhotoFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3 rounded-[18px] border border-border bg-background/35 p-3">
            <div className="space-y-2">
              <Label htmlFor="desktop-member-name">Nome completo</Label>
              <Input
                id="desktop-member-name"
                required
                autoFocus
                value={value.nome}
                onChange={(event) => onChange({ nome: event.target.value })}
                placeholder="Ex.: Igor Martins"
                className="h-10 rounded-[14px] border-border bg-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-member-phone">Telefone (opcional)</Label>
              <Input
                id="desktop-member-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={value.telefone}
                onChange={(event) => onChange({ telefone: event.target.value })}
                placeholder="(00) 00000-0000"
                className="h-10 rounded-[14px] border-border bg-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-member-birth">Data de nascimento</Label>
              <div className="flex gap-2">
                <Input
                  id="desktop-member-birth"
                  inputMode="numeric"
                  value={birthInput}
                  onChange={(event) => onBirthChange(event.target.value)}
                  placeholder="DD/MM ou DD/MM/AAAA"
                  className="h-10 rounded-[14px] border-border bg-card"
                />
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-[14px]" onClick={onOpenDate} aria-label="Selecionar data">
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <Label>Faixa etária</Label>
              <div className="grid min-h-0 flex-1 grid-rows-5 gap-2.5" role="radiogroup" aria-label="Faixa etária">
                {AGE_GROUPS.map((group) => {
                  const selected = value.faixa_etaria === group;
                  return (
                    <button
                      key={group}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange({ faixa_etaria: group })}
                      className={`flex min-h-8 items-center gap-2 rounded-[13px] border px-2.5 text-left text-sm transition-colors ${selected ? "border-primary bg-primary/12" : "border-border bg-card hover:bg-accent/30"}`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span>{group}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-[18px] border border-border bg-background/35 p-3">
            <div className="flex min-h-0 max-h-[44%] flex-col gap-2">
              <Label>Cargos (selecione um ou mais)</Label>
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1 scrollbar-none">
                {cargosLoading ? (
                  Array.from({ length: 4 }, (_, index) => <div key={index} className="h-8 animate-pulse rounded-[13px] border border-border bg-muted/40" />)
                ) : cargos.length ? (
                  cargos.map((cargo) => (
                    <label key={cargo.id} htmlFor={`desktop-cargo-${cargo.id}`} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-[13px] border border-border bg-card px-2.5 text-sm transition-colors hover:bg-accent/30">
                      <Checkbox id={`desktop-cargo-${cargo.id}`} checked={value.cargos.includes(cargo.nome)} onCheckedChange={() => onToggleCargo(cargo.nome)} />
                      <span className="truncate">{cargo.nome}</span>
                    </label>
                  ))
                ) : (
                  <p className="rounded-[13px] border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Nenhum cargo cadastrado</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="desktop-member-notes">Observações (opcional)</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">{value.observacoes.length}/{MEMBER_NOTES_LIMIT}</span>
              </div>
              <Textarea
                id="desktop-member-notes"
                value={value.observacoes}
                maxLength={MEMBER_NOTES_LIMIT}
                onChange={(event) => onChange({ observacoes: event.target.value.slice(0, MEMBER_NOTES_LIMIT) })}
                placeholder="Observações sobre o membro"
                className="min-h-0 flex-1 resize-none rounded-[14px] border-border bg-card"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-10 rounded-[14px]" onClick={onCancel}>Cancelar</Button>
              <Button type="submit" className="h-10 rounded-[14px]" disabled={saving || uploadingPhoto}>
                {saving || uploadingPhoto ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
