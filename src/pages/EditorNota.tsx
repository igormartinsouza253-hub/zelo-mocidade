import { useCallback, useEffect, useRef, useState } from "react";
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
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Lock,
  Pin,
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
  Archive,
  Tag,
  User,
  Users,
  Calendar,
  StickyNote,
  MoreVertical,
  MessageCircle,
  Send,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useAuth } from "@/hooks/useAuth";
import { formatDateLocal } from "@/lib/date-utils";
import { MobileActionBar } from "@/components/mobile/MobileActionBar";

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
  { name: "Poppins", value: "Poppins, ui-sans-serif, system-ui, sans-serif" },
];

const NOTE_TEMPLATES = [
  {
    label: "Acompanhamento",
    content: "<h2>Acompanhamento</h2><p><strong>Contexto:</strong> </p><p><strong>Pontos importantes:</strong> </p><p><strong>Próximo passo:</strong> </p>",
  },
  {
    label: "Ata rápida",
    content: "<h2>Ata da reunião</h2><p><strong>Decisões:</strong> </p><p><strong>Pendências:</strong> </p><ul><li></li></ul>",
  },
  {
    label: "Visita",
    content: "<h2>Plano de visita</h2><p><strong>Objetivo:</strong> </p><p><strong>Observações:</strong> </p><p><strong>Retorno:</strong> </p>",
  },
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

interface NoteComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  author_name?: string | null;
}

interface NoteVersion {
  id: string;
  created_at: string;
  edited_by: string | null;
  author_name?: string | null;
}

type MentionSuggestionProps = SuggestionProps<Membro, { id: string; label: string }>;

const EditorNota = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isMobile = useIsMobile();
  const { setConfig } = usePageHeader();
  const { activeGroupId, loading: loadingActiveGroup, isAdmin } = useActiveGroup();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingSpelling, setCheckingSpelling] = useState(false);
  const [initialContent, setInitialContent] = useState("");
  const [isViewMode, setIsViewMode] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [selectedMembroId, setSelectedMembroId] = useState<string | "none">("none");
  const [selectedReuniaoId, setSelectedReuniaoId] = useState<string | "none">("none");
  const [visibility, setVisibility] = useState<"private" | "group">("private");
  const [tagsInput, setTagsInput] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [sharedEditingEnabled, setSharedEditingEnabled] = useState(true);
  const [noteOwnerId, setNoteOwnerId] = useState<string | null>(null);
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [mentionPopup, setMentionPopup] = useState<{
    member: Membro;
    x: number;
    y: number;
  } | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const salvarNotaRef = useRef<() => void>(() => undefined);
  const isOwner = !id || noteOwnerId === user?.id;
  const canManageNote = isAdmin || isOwner;
  const canEditNote = canManageNote || (visibility === "group" && sharedEditingEnabled && !archivedAt);
  const draftKey = user?.id && activeGroupId ? `zelo-note-draft:${user.id}:${activeGroupId}` : null;

  useEffect(() => {
    const loadMembros = async () => {
      if (!activeGroupId) {
        setMembros([]);
        return;
      }
      const { data } = await supabase
        .from("membros")
        .select("id, nome, foto_url, faixa_etaria, telefone")
        .eq("group_id", activeGroupId)
        .order("nome");
      setMembros(data || []);
    };

    const loadReunioes = async () => {
      if (!activeGroupId) {
        setReunioes([]);
        return;
      }
      const { data } = await supabase
        .from("reunioes")
        .select("id, data, tema")
        .eq("group_id", activeGroupId)
        .order("data", { ascending: false });
      setReunioes(data || []);
    };

    loadMembros();
    loadReunioes();
  }, [activeGroupId]);

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
            let currentProps: MentionSuggestionProps | null = null;
            return {
              onStart: (props: MentionSuggestionProps) => {
                currentProps = props;
                component = document.createElement("div");
                component.className = "bg-popover border border-border rounded-lg shadow-lg p-1 z-50";
                document.body.appendChild(component);
                updateComponent(props);
              },
              onUpdate: (props: MentionSuggestionProps) => { currentProps = props; updateComponent(props); },
              onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                if (!currentProps) return false;
                if (event.key === "ArrowUp") { selectedIndex = Math.max(0, selectedIndex - 1); updateComponent(currentProps); return true; }
                if (event.key === "ArrowDown") { selectedIndex = Math.min(currentProps.items.length - 1, selectedIndex + 1); updateComponent(currentProps); return true; }
                if (event.key === "Enter") { const item = currentProps.items[selectedIndex]; if (item) currentProps.command({ id: item.id, label: item.nome }); return true; }
                return false;
              },
              onExit: () => { currentProps = null; if (component) { component.remove(); component = null; } },
            };
            function updateComponent(props: MentionSuggestionProps) {
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
    editable: !isViewMode && canEditNote,
    editorProps: { attributes: { class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] max-w-none p-4" } },
  });

  useEffect(() => { if (editor && initialContent) editor.commands.setContent(initialContent); }, [editor, initialContent]);

  useEffect(() => { if (editor) editor.setEditable(!isViewMode && canEditNote); }, [editor, isViewMode, canEditNote]);

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
            disabled={!canEditNote}
          >
            <Edit className="h-3.5 w-3.5" />
            Editar
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 text-xs md:text-sm whitespace-nowrap"
            onClick={() => salvarNotaRef.current()}
            disabled={loading || !canEditNote}
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
                disabled={!canEditNote}
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
  }, [id, isViewMode, isMobile, loading, navigate, setConfig, canEditNote, canManageNote, visibility, tagsInput, selectedMembroId, selectedReuniaoId, sharedEditingEnabled, isPinned, archivedAt]);

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

  const parseTags = () => Array.from(
    new Set(
      tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  );

  const applyTemplate = (content: string) => {
    if (!editor || !canEditNote) return;
    const currentContent = editor.getHTML();
    if (!currentContent || currentContent === "<p></p>") {
      editor.commands.setContent(content);
      return;
    }
    editor.chain().focus().insertContent(content).run();
  };

  useEffect(() => {
    if (id || !editor || !draftKey) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null") as {
        conteudo?: string;
        visibility?: "private" | "group";
        tagsInput?: string;
        selectedMembroId?: string | "none";
        selectedReuniaoId?: string | "none";
        sharedEditingEnabled?: boolean;
      } | null;

      if (!draft?.conteudo || draft.conteudo === "<p></p>") return;
      editor.commands.setContent(draft.conteudo);
      setVisibility(draft.visibility ?? "private");
      setTagsInput(draft.tagsInput ?? "");
      setSelectedMembroId(draft.selectedMembroId ?? "none");
      setSelectedReuniaoId(draft.selectedReuniaoId ?? "none");
      setSharedEditingEnabled(draft.sharedEditingEnabled ?? true);
      toast.info("Rascunho recuperado");
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey, editor, id]);

  useEffect(() => {
    if (id || !editor || !draftKey) return;

    const intervalId = window.setInterval(() => {
      const conteudo = editor.getHTML();
      const isEmpty = !conteudo || conteudo === "<p></p>";
      if (isEmpty && !tagsInput.trim() && selectedMembroId === "none" && selectedReuniaoId === "none") {
        localStorage.removeItem(draftKey);
        return;
      }

      localStorage.setItem(
        draftKey,
        JSON.stringify({
          conteudo,
          visibility,
          tagsInput,
          selectedMembroId,
          selectedReuniaoId,
          sharedEditingEnabled,
          savedAt: new Date().toISOString(),
        }),
      );
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [draftKey, editor, id, selectedMembroId, selectedReuniaoId, sharedEditingEnabled, tagsInput, visibility]);

  const hydrateAuthors = useCallback(async <T extends { user_id?: string; edited_by?: string | null }>(rows: T[]) => {
    const ids = Array.from(new Set(rows.map((row) => row.user_id || row.edited_by).filter((value): value is string => Boolean(value))));
    if (ids.length === 0) return rows.map((row) => ({ ...row, author_name: null }));

    const { data } = await supabase.from("profiles").select("id, username").in("id", ids);
    const names = new Map<string, string>();
    (data || []).forEach((profile) => names.set(profile.id, profile.username));
    return rows.map((row) => ({ ...row, author_name: names.get(row.user_id || row.edited_by || "") || null }));
  }, []);

  const loadComments = useCallback(async () => {
    if (!id || !activeGroupId) return;
    const { data, error } = await supabase
      .from("note_comments")
      .select("id, body, created_at, user_id")
      .eq("note_id", id)
      .eq("group_id", activeGroupId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar comentarios:", error);
      return;
    }

    setComments(await hydrateAuthors(data || []));
  }, [activeGroupId, hydrateAuthors, id]);

  const loadVersions = useCallback(async () => {
    if (!id || !activeGroupId) return;
    const { data, error } = await supabase
      .from("note_versions")
      .select("id, created_at, edited_by")
      .eq("note_id", id)
      .eq("group_id", activeGroupId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Erro ao carregar historico:", error);
      return;
    }

    setVersions(await hydrateAuthors(data || []));
  }, [activeGroupId, hydrateAuthors, id]);

  const loadNota = useCallback(async () => {
    if (!id || !activeGroupId) return;
    try {
      const { data, error } = await supabase
        .from("notas")
        .select("id, conteudo, user_id, membro_id, reuniao_id, group_id, visibility, tags, is_pinned, archived_at, shared_editing_enabled")
        .eq("id", id)
        .eq("group_id", activeGroupId)
        .single();

      if (error) throw error;
      setInitialContent(data.conteudo);
      setSelectedMembroId(data.membro_id ?? "none");
      setSelectedReuniaoId(data.reuniao_id ?? "none");
      setVisibility(data.visibility === "group" ? "group" : "private");
      setTagsInput((data.tags || []).join(", "));
      setIsPinned(data.is_pinned);
      setArchivedAt(data.archived_at ?? null);
      setSharedEditingEnabled(data.shared_editing_enabled);
      setNoteOwnerId(data.user_id);
      setIsViewMode(true);

      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.user_id)
        .maybeSingle();
      setCreatedByName(creatorProfile?.username ?? null);
      if (data.visibility === "group") await loadComments();
      await loadVersions();
    } catch (error) {
      console.error("Erro ao carregar nota:", error);
      toast.error("Erro ao carregar nota");
    }
  }, [activeGroupId, id, loadComments, loadVersions]);

  useEffect(() => {
    if (loadingActiveGroup || !id) return;
    if (!activeGroupId) {
      navigate("/grupo", { replace: true });
      return;
    }
    void loadNota();
  }, [activeGroupId, id, loadNota, loadingActiveGroup, navigate]);

  const sendComment = async () => {
    if (!id || !activeGroupId || !user || !commentText.trim()) return;

    try {
      const { error } = await supabase.from("note_comments").insert({
        note_id: id,
        group_id: activeGroupId,
        user_id: user.id,
        body: commentText.trim(),
      });

      if (error) throw error;
      setCommentText("");
      loadComments();
    } catch (error) {
      console.error("Erro ao comentar:", error);
      toast.error("Erro ao enviar comentario");
    }
  };

  const deleteComment = async (comment: NoteComment) => {
    try {
      const { error } = await supabase.from("note_comments").delete().eq("id", comment.id);
      if (error) throw error;
      loadComments();
    } catch (error) {
      console.error("Erro ao excluir comentario:", error);
      toast.error("Erro ao excluir comentario");
    }
  };

  const salvarNota = async () => {
    if (!editor) return;

    if (loadingActiveGroup) {
      toast.info("Carregando o grupo gestor. Tente salvar novamente em instantes.");
      return;
    }

    const conteudo = editor.getHTML();
    if (!conteudo || conteudo === "<p></p>") {
      toast.error("A nota não pode estar vazia");
      return;
    }

    setLoading(true);
    try {
      const tags = parseTags();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Usuário não autenticado");
      }

      if (!activeGroupId) {
        toast.error("Selecione um grupo gestor antes de salvar a nota.");
        return;
      }

      if (id) {
        if (!canEditNote) {
          toast.error("Voce nao pode editar uma nota criada por outro usuario.");
          return;
        }
        const { error } = await supabase
          .from("notas")
          .update({
            conteudo,
            visibility,
            tags,
            is_pinned: canManageNote ? isPinned : undefined,
            archived_at: canManageNote ? archivedAt : undefined,
            shared_editing_enabled: canManageNote ? sharedEditingEnabled : undefined,
            membro_id: selectedMembroId === "none" ? null : selectedMembroId,
            reuniao_id: selectedReuniaoId === "none" ? null : selectedReuniaoId,
          })
          .eq("id", id)
          .eq("group_id", activeGroupId);

        if (error) throw error;
        toast.success("Nota atualizada com sucesso");
      } else {
        const { error } = await supabase
          .from("notas")
          .insert({
            conteudo,
            user_id: user.id,
            group_id: activeGroupId,
            visibility,
            tags,
            is_pinned: isPinned,
            archived_at: archivedAt,
            shared_editing_enabled: sharedEditingEnabled,
            membro_id: selectedMembroId === "none" ? null : selectedMembroId,
            reuniao_id: selectedReuniaoId === "none" ? null : selectedReuniaoId,
          })
          .select("id")
          .single();

        if (error) throw error;
        toast.success("Nota criada com sucesso");
      }

      if (!id && draftKey) localStorage.removeItem(draftKey);
      navigate("/notas");
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
      const details = error as { code?: string; message?: string } | null;
      const message = error instanceof Error ? error.message : String(details?.message ?? "");
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes("visibility") || normalizedMessage.includes("schema cache")) {
        toast.error("O banco ainda precisa receber a atualizacao de notas privadas/publicas.");
      } else if (normalizedMessage.includes("row-level security") || details?.code === "42501") {
        toast.error("Sem permissao para salvar nota neste grupo gestor.");
      } else {
        toast.error(message || "Erro ao salvar nota");
      }
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

  const visibilityInfo = visibility === "group"
    ? {
        title: "Nota publica no grupo",
        description: sharedEditingEnabled ? "Todos os membros podem visualizar e editar." : "Todos visualizam, mas a edicao esta restrita.",
        icon: Users,
      }
    : {
        title: "Nota privada",
        description: "Somente voce pode visualizar esta nota.",
        icon: Lock,
      };

  const VisibilityControl = () => {
    const Icon = visibilityInfo.icon;
    const canChangeVisibility = !isViewMode && canEditNote;

    return (
      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{visibilityInfo.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{visibilityInfo.description}</p>
            </div>
          </div>

          {canChangeVisibility ? (
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-muted/30 p-1 sm:w-[18rem]">
              <Button
                type="button"
                variant={visibility === "private" ? "default" : "ghost"}
                size="sm"
                className="h-9 rounded-xl gap-1.5"
                onClick={() => setVisibility("private")}
              >
                <Lock className="h-3.5 w-3.5" />
                Privada
              </Button>
              <Button
                type="button"
                variant={visibility === "group" ? "default" : "ghost"}
                size="sm"
                className="h-9 rounded-xl gap-1.5"
                onClick={() => setVisibility("group")}
              >
                <Users className="h-3.5 w-3.5" />
                Publica
              </Button>
            </div>
          ) : (
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-full border border-border/70 px-3 text-xs font-semibold text-muted-foreground sm:self-center">
              <Icon className="h-3.5 w-3.5" />
              {visibility === "group" ? "Publica" : "Privada"}
            </span>
          )}
        </div>
        {visibility === "group" ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">Edicao compartilhada</p>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {sharedEditingEnabled ? "Membros do grupo podem editar esta nota." : "Somente dono e admins podem editar."}
              </p>
            </div>
            <Switch
              checked={sharedEditingEnabled}
              disabled={!canManageNote || isViewMode}
              onCheckedChange={setSharedEditingEnabled}
            />
          </div>
        ) : null}
      </div>
    );
  };
  salvarNotaRef.current = () => void salvarNota();

  const MobileNoteToolbar = ({ mobile, viewMode }: { mobile: boolean; viewMode: boolean }) => {
    const [keyboardInset, setKeyboardInset] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [dragStartY, setDragStartY] = useState<number | null>(null);

    useEffect(() => {
      if (!mobile || viewMode || typeof window === "undefined" || !window.visualViewport) return;

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
    }, [mobile, viewMode]);

    if (!mobile || viewMode) return null;
    const currentTextColor = editor.getAttributes("textStyle")?.color as string | undefined;

    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 flex justify-center px-3 md:hidden"
        style={{ bottom: keyboardInset > 0 ? `${keyboardInset + 12}px` : undefined }}
      >
        <div className="pointer-events-auto w-full max-w-[23rem] rounded-3xl border border-border/65 bg-background/95 px-2.5 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/90">
          <button
            type="button"
            className="mx-auto mb-2 flex h-5 w-20 items-center justify-center rounded-full text-muted-foreground"
            aria-label="Mostrar ferramentas de texto"
            onPointerDown={(event) => setDragStartY(event.clientY)}
            onPointerUp={(event) => {
              if (dragStartY !== null && dragStartY - event.clientY > 18) {
                setExpanded(true);
              } else if (dragStartY !== null && event.clientY - dragStartY > 18) {
                setExpanded(false);
              } else {
                setExpanded((value) => !value);
              }
              setDragStartY(null);
            }}
          >
            <span className="h-1.5 w-12 rounded-full bg-muted-foreground/35" />
          </button>

          {expanded ? (
            <div className="mb-2 space-y-2.5 rounded-2xl border border-border/50 bg-muted/20 p-2.5">
              <div className="grid grid-cols-7 gap-1.5">
                <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer" disabled={!editor.can().undo()}>
                  <Undo className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer" disabled={!editor.can().redo()}>
                  <Redo className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton isActive={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
                  <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton isActive={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
                  <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton isActive={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titulo 1">
                  H1
                </ToolbarButton>
                <ToolbarButton isActive={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titulo 2">
                  H2
                </ToolbarButton>
                <ToolbarButton isActive={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titulo 3">
                  H3
                </ToolbarButton>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 justify-center rounded-xl px-2 text-xs"
                  onClick={corrigirOrtografia}
                  disabled={checkingSpelling}
                  type="button"
                >
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Ortografia
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-full justify-center rounded-xl px-2 text-xs" type="button">
                      <Type className="mr-1 h-3.5 w-3.5" />
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
                    <Button variant={currentTextColor ? "default" : "outline"} size="sm" className="h-9 w-full justify-center rounded-xl px-2 text-xs" type="button">
                      <Type className="mr-1 h-3.5 w-3.5" />
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
                          {textColor.color === "default" ? <span className="text-xs">x</span> : null}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={editor.isActive("highlight") ? "default" : "outline"} size="sm" className="h-9 w-full justify-center rounded-xl px-2 text-xs" type="button">
                      <Palette className="mr-1 h-3.5 w-3.5" />
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
                        x
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Membro</Label>
                  <Select value={selectedMembroId} onValueChange={(value) => setSelectedMembroId(value)} disabled={!canEditNote}>
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
                  <Select value={selectedReuniaoId} onValueChange={(value) => setSelectedReuniaoId(value)} disabled={!canEditNote}>
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
          ) : null}

          <div className="flex items-center justify-between gap-2">
            {/* Ações */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl"
                onClick={() => (id ? setIsViewMode(true) : navigate("/notas"))}
                disabled={loading || !canEditNote}
                type="button"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                className="h-10 w-10 rounded-2xl"
                onClick={salvarNota}
                disabled={loading || !canEditNote}
                type="button"
                aria-label="Salvar"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>

            {/* Formatação principal */}
            <div className="flex items-center gap-1.5">
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
                  <div className="mx-auto w-full max-w-sm space-y-3">
                    <p className="text-center text-sm font-semibold">Configurações da Nota</p>

                    <VisibilityControl />

                    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                      <div className="space-y-1">
                        <Label className="flex items-center gap-1 text-xs">
                          <Tag className="h-3 w-3" /> Etiquetas
                        </Label>
                        <Input
                          value={tagsInput}
                          onChange={(event) => setTagsInput(event.target.value)}
                          disabled={!canEditNote}
                          placeholder="Ex.: reuniao, acompanhamento, pendencia"
                          className="h-9 text-xs"
                        />
                      </div>

                      {canManageNote ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={isPinned ? "default" : "outline"}
                            size="sm"
                            className="h-9 justify-center gap-1.5 rounded-xl px-2"
                            onClick={() => setIsPinned((value) => !value)}
                          >
                            <Pin className="h-3.5 w-3.5" />
                            {isPinned ? "Fixada" : "Fixar"}
                          </Button>
                          <Button
                            type="button"
                            variant={archivedAt ? "default" : "outline"}
                            size="sm"
                            className="h-9 justify-center gap-1.5 rounded-xl px-2"
                            onClick={() => setArchivedAt((value) => (value ? null : new Date().toISOString()))}
                          >
                            <Archive className="h-3.5 w-3.5" />
                            {archivedAt ? "Arquivada" : "Arquivar"}
                          </Button>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-3 gap-2">
                        {NOTE_TEMPLATES.map((template) => (
                          <Button
                            key={template.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-0 rounded-full px-2 text-xs"
                            onClick={() => applyTemplate(template.content)}
                            disabled={!canEditNote}
                          >
                            <span className="truncate">{template.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="hidden flex-wrap items-center gap-1">
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

                    <div className="hidden flex-wrap items-center gap-2">
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

                    <div className="hidden grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Membro</Label>
                        <Select value={selectedMembroId} onValueChange={(value) => setSelectedMembroId(value)} disabled={!canEditNote}>
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
                        <Select value={selectedReuniaoId} onValueChange={(value) => setSelectedReuniaoId(value)} disabled={!canEditNote}>
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
          isMobile && !isViewMode ? "pb-[calc(env(safe-area-inset-bottom)+9rem)]" : "",
          isMobile && isViewMode ? "pb-[calc(env(safe-area-inset-bottom)+7rem)]" : "",
        )}
      >
        <div className="max-w-4xl mx-auto w-full space-y-3 md:space-y-4">
          <Card className="rounded-3xl border-border/50 bg-card/95 shadow-[var(--shadow-soft)]">
            <CardHeader className={cn("border-b border-border/50 space-y-3", isMobile ? "px-3 pb-2 pt-3" : "pb-3")}> 
              <CardTitle className="text-base font-black md:text-lg">{isViewMode ? "Conteúdo da Nota" : "Editor"}</CardTitle>
              {!isMobile ? <VisibilityControl /> : null}

              {!isViewMode && !isMobile ? (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1 text-xs md:text-sm">
                        <Tag className="h-3 w-3" /> Etiquetas
                      </Label>
                      <Input
                        value={tagsInput}
                        onChange={(event) => setTagsInput(event.target.value)}
                        disabled={!canEditNote}
                        placeholder="Ex.: reuniao, acompanhamento, pendencia"
                        className="h-9 text-xs md:text-sm"
                      />
                    </div>
                    {canManageNote ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={isPinned ? "default" : "outline"}
                          size="sm"
                          className="h-9 gap-1.5 rounded-xl"
                          onClick={() => setIsPinned((value) => !value)}
                        >
                          <Pin className="h-3.5 w-3.5" />
                          {isPinned ? "Fixada" : "Fixar"}
                        </Button>
                        <Button
                          type="button"
                          variant={archivedAt ? "default" : "outline"}
                          size="sm"
                          className="h-9 gap-1.5 rounded-xl"
                          onClick={() => setArchivedAt((value) => (value ? null : new Date().toISOString()))}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {archivedAt ? "Arquivada" : "Arquivar"}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {NOTE_TEMPLATES.map((template) => (
                      <Button
                        key={template.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 rounded-full px-3 text-xs"
                        onClick={() => applyTemplate(template.content)}
                        disabled={!canEditNote}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Vinculações: desktop/tablet ficam visíveis; mobile vai para o popover da toolbar */}
              {!isViewMode && !isMobile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1 text-xs md:text-sm">
                      <User className="h-3 w-3" /> Relacionar a um membro
                    </Label>
                    <Select value={selectedMembroId} onValueChange={(value) => setSelectedMembroId(value)} disabled={!canEditNote}>
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
                    <Select value={selectedReuniaoId} onValueChange={(value) => setSelectedReuniaoId(value)} disabled={!canEditNote}>
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
                className={cn("min-h-[400px] [&_.ProseMirror]:min-h-[420px] [&_.ProseMirror]:max-w-none [&_.ProseMirror]:outline-none", isMobile && "[&_.ProseMirror]:min-h-[calc(100svh-17rem)] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-[15px] [&_.ProseMirror]:leading-7", isViewMode && "bg-background/35")}
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

          {isViewMode && createdByName ? (
            <p className="text-xs text-muted-foreground">Criado por <span className="font-medium text-foreground">{createdByName}</span></p>
          ) : null}

          {id && visibility === "group" ? (
            <Card className="rounded-3xl border-border/50 bg-card/95 shadow-[var(--shadow-soft)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-black">
                  <MessageCircle className="h-4 w-4" />
                  Comentarios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum comentario ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{comment.author_name || "Usuario"}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{new Date(comment.created_at).toLocaleString("pt-BR")}</span>
                            {(isAdmin || comment.user_id === user?.id) ? (
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteComment(comment)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Adicionar comentario..."
                    className="min-h-11 flex-1 resize-none"
                  />
                  <Button type="button" size="icon" className="h-11 w-11 shrink-0" onClick={sendComment} disabled={!commentText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {id && versions.length > 0 ? (
            <Card className="rounded-3xl border-border/50 bg-card/95 shadow-[var(--shadow-soft)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-black">
                  <History className="h-4 w-4" />
                  Historico recente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                    <span className="text-sm text-muted-foreground">{version.author_name || "Usuario"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Mobile toolbar fixa (substitui a dock inferior do app) */}
          <MobileNoteToolbar mobile={isMobile} viewMode={isViewMode} />

          {/* Ações antigas do mobile removidas: agora ficam na toolbar fixa */}

          {isMobile && isViewMode && (
            <MobileActionBar floating>
              <Button variant="outline" onClick={() => navigate("/notas")} type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={() => setIsViewMode(false)} disabled={!canEditNote} type="button">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </MobileActionBar>
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
