import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import Mention from "@tiptap/extension-mention";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Save,
  X,
  ArrowLeft,
  CheckCheck,
  Undo,
  Redo,
  Eye,
  Edit,
  Type,
  Palette,
  User,
  Calendar,
  StickyNote,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { formatDateLocal } from "@/lib/date-utils";

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", color: "rgba(234, 179, 8, 0.5)" },
  { name: "Verde", color: "rgba(22, 163, 74, 0.5)" },
  { name: "Azul", color: "rgba(37, 99, 235, 0.5)" },
  { name: "Rosa", color: "rgba(219, 39, 119, 0.5)" },
  { name: "Laranja", color: "rgba(249, 115, 22, 0.5)" },
  { name: "Roxo", color: "rgba(124, 58, 237, 0.5)" },
];

const TEXT_COLORS = [
  { name: "Padrão", color: "default" },
  { name: "Preto", color: "#111827" },
  { name: "Azul", color: "#2563eb" },
  { name: "Verde", color: "#16a34a" },
  { name: "Vermelho", color: "#dc2626" },
  { name: "Roxo", color: "#7c3aed" },
];

const FONT_FAMILIES = [
  { name: "Padrão", value: "inherit" },
  { name: "Sans Serif", value: "ui-sans-serif, system-ui, sans-serif" },
  { name: "Serif", value: "ui-serif, Georgia, serif" },
  { name: "Mono", value: "ui-monospace, monospace" },
];

interface Membro {
  id: string;
  nome: string;
  foto_url: string | null;
  faixa_etaria: string;
  telefone: string | null;
}

interface Reuniao {
  id: string;
  data: string;
  tema: string | null;
}

const EditorNota = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isMobile = useIsMobile();
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();
  const [loading, setLoading] = useState(false);
  const [checkingSpelling, setCheckingSpelling] = useState(false);
  const [initialContent, setInitialContent] = useState("");
  const [isViewMode, setIsViewMode] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [selectedMembroId, setSelectedMembroId] = useState<string | "none">("none");
  const [selectedReuniaoId, setSelectedReuniaoId] = useState<string | "none">("none");
  const [mentionPopup, setMentionPopup] = useState<{
    member: Membro;
    x: number;
    y: number;
  } | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  useEffect(() => {
    const loadMembros = async () => {
      const { data } = await supabase
        .from("membros")
        .select("id, nome, foto_url, faixa_etaria, telefone")
        .order("nome");
      setMembros(data || []);
    };

    const loadReunioes = async () => {
      const { data } = await supabase
        .from("reunioes")
        .select("id, data, tema")
        .order("data", { ascending: false });
      setReunioes(data || []);
    };

    loadMembros();
    loadReunioes();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false, HTMLAttributes: { class: "list-disc pl-6 space-y-1" } },
        orderedList: { keepMarks: true, keepAttributes: false, HTMLAttributes: { class: "list-decimal pl-6 space-y-1" } },
        listItem: { HTMLAttributes: { class: "pl-1" } },
      }),
      Underline,
      Highlight.configure({ multicolor: true, HTMLAttributes: { class: "rounded px-1" } }),
      Placeholder.configure({ placeholder: "Digite sua nota aqui..." }),
      TextStyle,
      Color,
      FontFamily,
      Mention.configure({
        HTMLAttributes: { class: "mention bg-primary/20 text-primary rounded px-1 py-0.5" },
        suggestion: {
          items: ({ query }) => membros.filter((m) => m.nome.toLowerCase().includes(query.toLowerCase())).slice(0, 5),
          render: () => {
            let component: HTMLDivElement | null = null;
            let selectedIndex = 0;
            return {
              onStart: (props: any) => {
                component = document.createElement("div");
                component.className = "bg-popover border border-border rounded-lg shadow-lg p-1 z-50";
                document.body.appendChild(component);
                updateComponent(props);
              },
              onUpdate: (props: any) => { updateComponent(props); },
              onKeyDown: (props: any) => {
                if (props.event.key === "ArrowUp") { selectedIndex = Math.max(0, selectedIndex - 1); updateComponent(props); return true; }
                if (props.event.key === "ArrowDown") { selectedIndex = Math.min(props.items.length - 1, selectedIndex + 1); updateComponent(props); return true; }
                if (props.event.key === "Enter") { const item = props.items[selectedIndex]; if (item) props.command({ id: item.id, label: item.nome }); return true; }
                return false;
              },
              onExit: () => { if (component) { component.remove(); component = null; } },
            };
            function updateComponent(props: any) {
              if (!component) return;
              const { clientRect, items, command } = props;
              if (!clientRect) return;
              const rect = clientRect();
              component.style.position = "fixed";
              component.style.left = `${rect.left}px`;
              component.style.top = `${rect.bottom + 4}px`;
              component.innerHTML = items.length
                ? items.map((item: Membro, index: number) => `<div class="px-3 py-2 cursor-pointer rounded ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}" data-index="${index}">${item.nome}</div>`).join("")
                : '<div class="px-3 py-2 text-muted-foreground">Nenhum membro encontrado</div>';
              component.querySelectorAll("[data-index]").forEach((el) => {
                el.addEventListener("click", () => { const idx = parseInt(el.getAttribute("data-index") || "0"); const item = items[idx]; if (item) command({ id: item.id, label: item.nome }); });
              });
            }
          },
        },
      }),
    ],
    content: initialContent,
    editable: !isViewMode,
    editorProps: { attributes: { class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] max-w-none p-4" } },
  });

  useEffect(() => { if (id) loadNota(); }, [id]);
  useEffect(() => { if (editor && initialContent) editor.commands.setContent(initialContent); }, [editor, initialContent]);
  useEffect(() => { if (editor) editor.setEditable(!isViewMode); }, [editor, isViewMode]);

  useEffect(() => {
    const pageTitle = !id ? "Nova nota" : isViewMode ? "Visualizar nota" : "Editar nota";

    setConfig({
      title: pageTitle,
      icon: StickyNote,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Notas", href: "/notas" },
        { label: pageTitle },
      ],
      showBackButton: true,
      backTo: "/notas",
      primaryActions: !isMobile ? (
        isViewMode ? (
          <Button
            size="sm"
            className="gap-1.5 text-xs md:text-sm whitespace-nowrap"
            onClick={() => setIsViewMode(false)}
          >
            <Edit className="h-3.5 w-3.5" />
            Editar
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 text-xs md:text-sm whitespace-nowrap"
            onClick={salvarNota}
            disabled={loading}
          >
            <Save className="h-3.5 w-3.5" />
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        )
      ) : null,
      secondaryActions: !isMobile ? (
        <div className="flex items-center gap-2">
          {id ? (
            <>
              <Button
                variant={isViewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsViewMode(true)}
                className="gap-1"
                type="button"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Visualizar</span>
              </Button>
              <Button
                variant={!isViewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsViewMode(false)}
                className="gap-1"
                type="button"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            </>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!id) {
                navigate("/notas");
                return;
              }
              if (isViewMode) {
                navigate("/notas");
                return;
              }
              setIsViewMode(true);
            }}
            disabled={loading}
            className="gap-1.5"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            {isViewMode ? "Voltar" : "Cancelar"}
          </Button>
        </div>
      ) : null,
    });

    return () => setConfig(null);
  }, [id, isViewMode, isMobile, loading, navigate, setConfig]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editor || isViewMode) return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === "b") { event.preventDefault(); editor.chain().focus().toggleBold().run(); }
        if (event.key.toLowerCase() === "i") { event.preventDefault(); editor.chain().focus().toggleItalic().run(); }
        if (event.key.toLowerCase() === "u") { event.preventDefault(); editor.chain().focus().toggleUnderline().run(); }
        if (event.key.toLowerCase() === "y") { event.preventDefault(); editor.chain().focus().redo().run(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, isViewMode]);

  const loadNota = async () => {
    try {
      const { data, error } = await supabase
        .from("notas")
        .select("id, conteudo, user_id, membro_id, reuniao_id")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setInitialContent(data.conteudo);
        setSelectedMembroId((data.membro_id as string | null) ?? "none");
        setSelectedReuniaoId((data.reuniao_id as string | null) ?? "none");
        setIsViewMode(true);
      }
    } catch (error) {
      console.error("Erro ao carregar nota:", error);
      toast.error("Erro ao carregar nota");
    }
  };

  const salvarNota = async () => {
    if (!editor) return;

    const conteudo = editor.getHTML();
    if (!conteudo || conteudo === "<p></p>") {
      toast.error("A nota não pode estar vazia");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Usuário não autenticado");
      }

      if (id) {
        const { error } = await supabase
          .from("notas")
          .update({
            conteudo,
            membro_id: selectedMembroId === "none" ? null : selectedMembroId,
            reuniao_id: selectedReuniaoId === "none" ? null : selectedReuniaoId,
          })
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Nota atualizada com sucesso");
      } else {
        const { error } = await supabase
          .from("notas")
          .insert({
            conteudo,
            user_id: user.id,
            group_id: activeGroupId,
            membro_id: selectedMembroId === "none" ? null : selectedMembroId,
            reuniao_id: selectedReuniaoId === "none" ? null : selectedReuniaoId,
          });

        if (error) throw error;
        toast.success("Nota criada com sucesso");
      }

      navigate("/notas");
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setLoading(false);
    }
  };

  const corrigirOrtografia = async () => {
    if (!editor) return;
    const currentContent = editor.getHTML();
    if (!currentContent || currentContent === "<p></p>") { toast.error("Digite algum texto antes de corrigir"); return; }
    setCheckingSpelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("spell-check", { body: { text: currentContent } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.correctedText) { editor.commands.setContent(data.correctedText); toast.success("Texto corrigido com sucesso!"); }
    } catch (error) { console.error("Erro ao corrigir ortografia:", error); toast.error("Erro ao corrigir ortografia"); }
    finally { setCheckingSpelling(false); }
  };

  if (!editor) return null;

  const ToolbarButton = ({
    isActive,
    onClick,
    children,
    title,
    disabled,
  }: {
    isActive?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
    disabled?: boolean;
  }) => (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn("h-8 w-8 p-0", isActive && "bg-primary text-primary-foreground")}
      type="button"
      title={title}
      disabled={disabled}
    >
      {children}
    </Button>
  );

  const MobileNoteToolbar = () => {
    const [keyboardInset, setKeyboardInset] = useState(0);

    useEffect(() => {
      if (!isMobile || isViewMode || typeof window === "undefined" || !window.visualViewport) return;

      const viewport = window.visualViewport;
      const updateKeyboardInset = () => {
        const rawInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        setKeyboardInset(rawInset > 80 ? rawInset : 0);
      };

      updateKeyboardInset();
      viewport.addEventListener("resize", updateKeyboardInset);
      viewport.addEventListener("scroll", updateKeyboardInset);
      window.addEventListener("orientationchange", updateKeyboardInset);

      return () => {
        viewport.removeEventListener("resize", updateKeyboardInset);
        viewport.removeEventListener("scroll", updateKeyboardInset);
        window.removeEventListener("orientationchange", updateKeyboardInset);
      };
    }, [isMobile, isViewMode]);

    if (!isMobile || isViewMode) return null;
    const currentTextColor = editor.getAttributes("textStyle")?.color as string | undefined;

    return (
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ bottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined }}
      >
        <div className="mx-auto w-full max-w-4xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="flex items-center justify-between gap-2">
            {/* Ações */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl"
                onClick={() => (id ? setIsViewMode(true) : navigate("/notas"))}
                disabled={loading}
                type="button"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                className="h-10 w-10 rounded-2xl"
                onClick={salvarNota}
                disabled={loading}
                type="button"
                aria-label="Salvar"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>

            {/* Formatação principal */}
            <div className="flex items-center gap-1">
              <ToolbarButton
                isActive={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Negrito"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                isActive={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Itálico"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                isActive={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Sublinhado"
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarButton>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 w-10 rounded-2xl p-0" type="button" aria-label="Mais ferramentas">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="rounded-t-3xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-h-[85svh] overflow-y-auto"
                >
                  <div className="space-y-3 pr-10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">Ferramentas</p>
                      <div className="flex items-center gap-2">
                        <ToolbarButton
                          onClick={() => editor.chain().focus().undo().run()}
                          title="Desfazer"
                          disabled={!editor.can().undo()}
                        >
                          <Undo className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                          onClick={() => editor.chain().focus().redo().run()}
                          title="Refazer"
                          disabled={!editor.can().redo()}
                        >
                          <Redo className="h-4 w-4" />
                        </ToolbarButton>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <ToolbarButton
                        isActive={editor.isActive("bulletList")}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Lista"
                      >
                        <List className="h-4 w-4" />
                      </ToolbarButton>
                      <ToolbarButton
                        isActive={editor.isActive("orderedList")}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Lista numerada"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </ToolbarButton>

                      <div className="w-px h-8 bg-border mx-1" />

                      <ToolbarButton
                        isActive={editor.isActive("heading", { level: 1 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        title="Título 1"
                      >
                        H1
                      </ToolbarButton>
                      <ToolbarButton
                        isActive={editor.isActive("heading", { level: 2 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="Título 2"
                      >
                        H2
                      </ToolbarButton>
                      <ToolbarButton
                        isActive={editor.isActive("heading", { level: 3 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        title="Título 3"
                      >
                        H3
                      </ToolbarButton>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        onClick={corrigirOrtografia}
                        disabled={checkingSpelling}
                        type="button"
                      >
                        <CheckCheck className="h-4 w-4 mr-2" />
                        {checkingSpelling ? "Corrigindo…" : "Ortografia"}
                      </Button>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 px-3" type="button">
                            <Type className="h-4 w-4 mr-2" />
                            Fonte
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1">
                          {FONT_FAMILIES.map((font) => (
                            <button
                              key={font.value}
                              onClick={() => {
                                if (font.value === "inherit") editor.chain().focus().unsetFontFamily().run();
                                else editor.chain().focus().setFontFamily(font.value).run();
                              }}
                              className="w-full px-3 py-2 text-left text-sm rounded hover:bg-muted"
                              style={{ fontFamily: font.value }}
                              type="button"
                            >
                              {font.name}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={currentTextColor ? "default" : "outline"}
                            size="sm"
                            className="h-9 px-3"
                            type="button"
                          >
                            <Type className="h-4 w-4 mr-2" />
                            Cor
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                          <div className="flex gap-1">
                            {TEXT_COLORS.map((textColor) => (
                              <button
                                key={textColor.color}
                                onClick={() => {
                                  if (textColor.color === "default") editor.chain().focus().unsetColor().run();
                                  else editor.chain().focus().setColor(textColor.color).run();
                                }}
                                className="h-7 w-7 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center"
                                style={{ backgroundColor: textColor.color === "default" ? "transparent" : textColor.color }}
                                title={textColor.name}
                                type="button"
                              >
                                {textColor.color === "default" ? <span className="text-xs">✕</span> : null}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={editor.isActive("highlight") ? "default" : "outline"}
                            size="sm"
                            className="h-9 px-3"
                            type="button"
                          >
                            <Palette className="h-4 w-4 mr-2" />
                            Grifo
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                          <div className="flex gap-1">
                            {HIGHLIGHT_COLORS.map((hl) => (
                              <button
                                key={hl.color}
                                onClick={() => editor.chain().focus().toggleHighlight({ color: hl.color }).run()}
                                className="h-7 w-7 rounded border border-border hover:scale-110 transition-transform"
                                style={{ backgroundColor: hl.color }}
                                title={hl.name}
                                type="button"
                              />
                            ))}
                            <button
                              onClick={() => editor.chain().focus().unsetHighlight().run()}
                              className="h-7 w-7 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center text-xs"
                              title="Remover grifo"
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Membro</Label>
                        <Select value={selectedMembroId} onValueChange={(value) => setSelectedMembroId(value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {membros.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Reunião</Label>
                        <Select value={selectedReuniaoId} onValueChange={(value) => setSelectedReuniaoId(value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Nenhuma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {reunioes.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {formatDateLocal(r.data)} {r.tema ? `- ${r.tema}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div
        className={cn(
          "flex flex-col h-full w-full px-3 md:px-6 lg:px-8 py-4 md:py-6 overflow-y-auto",
          isMobile ? "scrollbar-none" : "scrollbar-thin",
          isMobile && !isViewMode ? "pb-[calc(env(safe-area-inset-bottom)+14rem)]" : "",
        )}
      >
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <Card className="shadow-[var(--shadow-soft)] border-border/50">
            <CardHeader className="pb-3 border-b border-border/50 space-y-3">
              <CardTitle className="text-base md:text-lg">{isViewMode ? "Conteúdo da Nota" : "Editor"}</CardTitle>

              {/* Vinculações: desktop/tablet ficam visíveis; mobile vai para o popover da toolbar */}
              {!isViewMode && !isMobile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1 text-xs md:text-sm">
                      <User className="h-3 w-3" /> Relacionar a um membro
                    </Label>
                    <Select value={selectedMembroId} onValueChange={(value) => setSelectedMembroId(value)}>
                      <SelectTrigger className="h-8 text-xs md:text-sm">
                        <SelectValue placeholder="Nenhum membro vinculado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {membros.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1 text-xs md:text-sm">
                      <Calendar className="h-3 w-3" /> Relacionar a uma reunião
                    </Label>
                    <Select value={selectedReuniaoId} onValueChange={(value) => setSelectedReuniaoId(value)}>
                      <SelectTrigger className="h-8 text-xs md:text-sm">
                        <SelectValue placeholder="Nenhuma reunião vinculada" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {reunioes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {formatDateLocal(r.data)} {r.tema ? `- ${r.tema}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Toolbar do header (desktop/tablet) */}
              {!isViewMode && !isMobile && (
                <div className="flex flex-wrap gap-1 pt-1 md:pt-3">
                  <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)" disabled={!editor.can().undo()}>
                    <Undo className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)" disabled={!editor.can().redo()}>
                    <Redo className="h-4 w-4" />
                  </ToolbarButton>
                  <div className="w-px h-8 bg-border mx-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={corrigirOrtografia}
                    disabled={checkingSpelling}
                    className="h-8 px-3"
                    type="button"
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    {checkingSpelling ? "..." : "Corrigir"}
                  </Button>
                  <div className="w-px h-8 bg-border mx-1" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2 gap-1" type="button">
                        <Type className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1">
                      {FONT_FAMILIES.map((font) => (
                        <button
                          key={font.value}
                          onClick={() => {
                            if (font.value === "inherit") editor.chain().focus().unsetFontFamily().run();
                            else editor.chain().focus().setFontFamily(font.value).run();
                          }}
                          className="w-full px-3 py-2 text-left text-sm rounded hover:bg-muted"
                          style={{ fontFamily: font.value }}
                          type="button"
                        >
                          {font.name}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <div className="w-px h-8 bg-border mx-1" />
                  <ToolbarButton isActive={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
                    <Bold className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton isActive={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
                    <Italic className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton isActive={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)">
                    <UnderlineIcon className="h-4 w-4" />
                  </ToolbarButton>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={editor.isActive("highlight") ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0",
                          editor.isActive("highlight") && "bg-primary text-primary-foreground",
                        )}
                        type="button"
                      >
                        <Palette className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2">
                      <div className="flex gap-1">
                        {HIGHLIGHT_COLORS.map((hl) => (
                          <button
                            key={hl.color}
                            onClick={() => editor.chain().focus().toggleHighlight({ color: hl.color }).run()}
                            className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                            style={{ backgroundColor: hl.color }}
                            title={hl.name}
                            type="button"
                          />
                        ))}
                        <button
                          onClick={() => editor.chain().focus().unsetHighlight().run()}
                          className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center text-xs"
                          title="Remover grifo"
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="w-px h-8 bg-border mx-1" />
                  <ToolbarButton isActive={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores">
                    <List className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton isActive={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
                    <ListOrdered className="h-4 w-4" />
                  </ToolbarButton>
                  <div className="w-px h-8 bg-border mx-1" />
                  <ToolbarButton isActive={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                    H1
                  </ToolbarButton>
                  <ToolbarButton isActive={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    H2
                  </ToolbarButton>
                  <ToolbarButton isActive={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                    H3
                  </ToolbarButton>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <EditorContent
                editor={editor}
                className={cn("min-h-[400px]")}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  const mentionEl = target.closest(".mention") as HTMLElement | null;

                  if (!mentionEl) {
                    setMentionPopup(null);
                    return;
                  }

                  const memberId = mentionEl.getAttribute("data-id");
                  if (!memberId) return;

                  const member = membros.find((m) => m.id === memberId);
                  if (!member) return;

                  const rect = mentionEl.getBoundingClientRect();
                  setMentionPopup({
                    member,
                    x: rect.left,
                    y: rect.bottom + 4,
                  });
                }}
              />
            </CardContent>
          </Card>

          {/* Mobile toolbar fixa (substitui a dock inferior do app) */}
          <MobileNoteToolbar />

          {/* Ações antigas do mobile removidas: agora ficam na toolbar fixa */}

          {isMobile && isViewMode && (
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => navigate("/notas")} type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={() => setIsViewMode(false)} type="button">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          )}

          {mentionPopup && (
            <div
              className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-64"
              style={{ left: mentionPopup.x, top: mentionPopup.y }}
            >
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold">{mentionPopup.member.nome}</p>
                  <p className="text-xs text-muted-foreground">{mentionPopup.member.faixa_etaria}</p>
                </div>
                {mentionPopup.member.telefone && (
                  <p className="text-xs text-muted-foreground">Telefone: {mentionPopup.member.telefone}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate(`/membros/visualizar/${mentionPopup.member.id}`);
                      setMentionPopup(null);
                    }}
                    type="button"
                  >
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      navigate(`/membros/editar/${mentionPopup.member.id}`);
                      setMentionPopup(null);
                    }}
                    type="button"
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorNota;
