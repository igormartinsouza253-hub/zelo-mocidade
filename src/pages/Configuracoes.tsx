import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Moon, Sun, Monitor, Trash2, UserPlus, Shield, User, Download, FileSpreadsheet, Upload, Edit3, MoreHorizontal, Eye, EyeOff, Camera } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { z } from "zod";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ThemePresetId, CustomThemeConfig, THEME_PRESETS_META } from "@/lib/theme-presets";
import { useIsMobile } from "@/hooks/use-mobile";
import { BootstrapAdminButton } from "@/components/BootstrapAdminButton";
import { GroupSettingsSection } from "@/components/settings/GroupSettingsSection";

const userEmailSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "Email é obrigatório")
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
});

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarConfigCard } from "@/components/SidebarConfigCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";

interface UserWithRole {
  id: string;
  email: string | null;
  username: string | null;
  role: 'admin' | 'user';
  created_at: string;
}

const Configuracoes = () => {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { activeGroup, isAdmin: isGroupAdmin } = useActiveGroup();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  
  // User management states
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Presence: último horário visto por usuário nesta sessão
  const [userLastSeen, setUserLastSeen] = useState<Record<string, string>>({});

  // Online users (presence)
  const [onlineUsers, setOnlineUsers] = useState<{
    user_id: string;
    username: string;
    email: string | null;
    online_at: string;
    last_active_at: string;
  }[]>([]);

  // Dados da conta atual
  const [accountUsername, setAccountUsername] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountAvatarUrl, setAccountAvatarUrl] = useState<string | null>(null);
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarImageSrc, setAvatarImageSrc] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tema e personalização visual (por usuário)
  const [themePreset, setThemePreset] = useState<ThemePresetId>("azul");
  const [customTheme, setCustomTheme] = useState<CustomThemeConfig | null>(null);
  const [savingTheme, setSavingTheme] = useState(false);
  const [userThemes, setUserThemes] = useState<{ id: string; name: string; config: CustomThemeConfig }[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [makeDefaultTheme, setMakeDefaultTheme] = useState(true);
  

  // Navegação interna mobile para subpáginas de configurações
  const [mobileSection, setMobileSection] = useState<"root" | "theme" | "users" | "group" | "data">("root");
  
  // Importação de membros
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    imported: number;
    skipped: number;
  } | null>(null);
  
  // Backup de dados
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    if (user) {
      loadUserPreferences();
      loadAccountInfo();
      subscribeToOnlineUsers();
    }
  }, [user]);

  const canManageRestricted = isAdmin || isGroupAdmin;

  useEffect(() => {
    if (!user) return;
    if (!canManageRestricted) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canManageRestricted]);

  // Aplica o preset imediatamente ao alternar Claro/Escuro/Sistema.
  // (O next-themes troca a classe no <html>, e então reaplicamos as variáveis CSS do preset
  // para o modo correto sem depender do botão "Salvar tema".)
  useEffect(() => {
    const modeKey = resolvedTheme ?? theme;
    if (!modeKey) return;

    const customConfig: CustomThemeConfig | null = customTheme;

    // Defer para garantir que a classe (dark) já foi atualizada pelo next-themes
    const t = window.setTimeout(() => {
      import("@/lib/theme-presets").then(({ applyThemePreset }) => {
        applyThemePreset(themePreset, customConfig || undefined);
      });
    }, 0);

    return () => window.clearTimeout(t);
  }, [theme, resolvedTheme, themePreset, customTheme]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      
      if (error) throw error;
      setIsAdmin(data || false);
    } catch (error) {
      console.error("Erro ao verificar status de admin:", error);
    }
  };

  const loadUsers = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-user-access', {
        body: { action: 'list' }
      });

      if (error) {
        console.error("Erro ao carregar usuários (edge function):", error);
        // Tratar explicitamente erro 401 da função para não quebrar a tela
        if ((error as any).message?.includes('Invalid JWT')) {
          toast.error('Não foi possível carregar a lista de usuários agora (sessão inválida). Tente recarregar a página.');
          return;
        }
        throw error;
      }

      if (data?.users) {
        setUsers(data.users as UserWithRole[]);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar lista de usuários");
    }
  };

  const loadUserPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme_preset, custom_theme')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const rawPreset = (data.theme_preset as any) ?? "azul";
        const preset: ThemePresetId = ["azul", "laranja", "verde", "rosa", "roxo", "vermelho", "amarelo"].includes(rawPreset)
          ? (rawPreset as ThemePresetId)
          : "azul";
        setThemePreset(preset);

        const storedCustom = (data.custom_theme as any) || null;
        setCustomTheme(storedCustom);

        import("@/lib/theme-presets").then(({ applyThemePreset }) => {
          applyThemePreset(preset, storedCustom || undefined);
        });
      }
    } catch (error) {
      console.error('Erro ao carregar preferências de usuário:', error);
    }
  };

  const loadAccountInfo = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
 
      if (error) {
        console.error('Erro ao carregar perfil do usuário:', error);
      }
 
      setAccountUsername(data?.username || user.user_metadata?.username || user.email?.split('@')[0] || "");
      setAccountEmail(data?.email ?? user.email ?? null);
      setAccountAvatarUrl((data as any)?.avatar_url ?? null);
    } catch (error) {
      console.error('Erro inesperado ao carregar perfil do usuário:', error);
    }
  };

  const subscribeToOnlineUsers = () => {
    if (!user) return;

    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const list: {
          user_id: string;
          username: string;
          email: string | null;
          online_at: string;
          last_active_at: string;
        }[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key];
          if (!Array.isArray(presences) || presences.length === 0) return;
          const latest = presences[presences.length - 1] as any;
          if (!latest.user_id) return;
          list.push({
            user_id: latest.user_id,
            username: latest.username || 'Usuário',
            email: latest.email ?? null,
            online_at: latest.online_at || latest.last_active_at || new Date().toISOString(),
            last_active_at: latest.last_active_at || latest.online_at || new Date().toISOString(),
          });
        });

        list.sort((a, b) => (a.last_active_at < b.last_active_at ? 1 : -1));
        setOnlineUsers(list);
        setUserLastSeen((prev) => {
          const next = { ...prev };
          list.forEach((item) => {
            const current = next[item.user_id];
            const candidate = item.last_active_at || item.online_at;
            if (!current || candidate > current) {
              next[item.user_id] = candidate;
            }
          });
          return next;
        });
      })
      .subscribe();
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setAvatarImageSrc(result);
        setAvatarDialogOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarCropped = async (blob: Blob) => {
    if (!user) return;

    setAvatarSaving(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('member-photos').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setAccountAvatarUrl(publicUrl);
      toast.success('Foto de perfil atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar foto de perfil:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setAvatarSaving(false);
      setAvatarDialogOpen(false);
      setAvatarImageSrc(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateAccount = async () => {
    if (!user) return;
 
    const username = accountUsername.trim();
    if (!username) {
      toast.error('Username é obrigatório');
      return;
    }
 
    if (accountNewPassword || accountConfirmPassword) {
      if (accountNewPassword.length < 8) {
        toast.error('A nova senha deve ter pelo menos 8 caracteres');
        return;
      }
      if (accountNewPassword !== accountConfirmPassword) {
        toast.error('As senhas não coincidem');
        return;
      }
    }
 
    setAccountLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', user.id);
 
      if (profileError) throw profileError;
 
      let passwordMessage: string | null = null;
 
      if (accountNewPassword) {
        const { error: authError } = await supabase.auth.updateUser({
          password: accountNewPassword,
        });
 
        if (authError) {
          const code = (authError as any).code;
          const message = (authError as any).message as string | undefined;
 
          if (code === 'same_password' || message?.includes('New password should be different')) {
            passwordMessage = 'Username atualizado, mas a nova senha deve ser diferente da atual.';
          } else {
            throw authError;
          }
        }
      }
 
      if (accountNewPassword) {
        setAccountNewPassword('');
        setAccountConfirmPassword('');
      }
 
      toast.success(passwordMessage || 'Conta atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar conta:', error);
      toast.error('Erro ao atualizar conta');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user-access', {
        body: { action: 'change_role', user_id: userId, role: newRole },
      });

      if (error) {
        console.error('Erro ao atualizar papel do usuário (edge function):', error);
        if ((error as any).message?.includes('Invalid JWT')) {
          toast.error('Sessão inválida ao atualizar papel do usuário. Recarregue a página e tente novamente.');
          return;
        }
        throw error;
      }

      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success('Papel do usuário atualizado com sucesso');
        loadUsers();
      }
    } catch (error) {
      console.error('Erro ao atualizar papel do usuário:', error);
      toast.error('Erro ao atualizar papel do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Prevent admin from deleting themselves
    if (userToDelete === user?.id) {
      toast.error("Você não pode remover seu próprio acesso");
      setUserToDelete(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user-access', {
        body: { action: 'revoke', user_id: userToDelete },
      });

      if (error) {
        console.error('Erro ao revogar acesso (edge function):', error);
        if ((error as any).message?.includes('Invalid JWT')) {
          toast.error('Sessão inválida ao revogar acesso. Recarregue a página e tente novamente.');
          return;
        }
        throw error;
      }

      if ((data as any)?.error) {
        toast.error((data as any).error);
        return;
      }

      toast.success("Acesso revogado com sucesso!");
      setUserToDelete(null);
      loadUsers();
    } catch (error) {
      console.error("Erro ao remover acesso:", error);
      toast.error("Erro ao revogar acesso");
    } finally {
      setLoading(false);
    }
  };


  const parseDateDDMMYYYY = (value: string | number | undefined | null): string | null => {
    if (value === undefined || value === null || value === "") return null;

    // Quando o Excel envia a data como número (serial)
    if (typeof value === "number" && !Number.isNaN(value)) {
      // Excel serial date: 1 = 1900-01-01
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const jsDate = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      const year = jsDate.getUTCFullYear();
      const month = String(jsDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(jsDate.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    const trimmed = value.toString().trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const normalizeBirthday = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const trimmed = value.toString().trim();
    if (!trimmed) return null;

    // Se vier como DD/MM/AAAA, converte para DD-MM
    const fullDate = parseDateDDMMYYYY(trimmed);
    if (fullDate) {
      const [, month, day] = fullDate.split("-");
      return `${day}-${month}`;
    }

    // Se já estiver como DD-MM, aceita
    if (/^[0-9]{2}-[0-9]{2}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  };

  const splitCargos = (value: string | undefined | null): string[] => {
    if (!value) return [];
    return value
      .toString()
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 10);
  };

  const handleDownloadTemplate = () => {
    const header = [
      "nome",
      "faixa_etaria",
      "data_nascimento (DD/MM/AAAA)",
      "data_aniversario (DD/MM/AAAA ou DD-MM)",
      "telefone",
      "status_telefone",
      "cargos (separados por vírgula)",
      "observacoes",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([header]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Membros");

    XLSX.writeFile(workbook, "modelo_importacao_membros.xlsx");
  };

  const handleImportMembers = async (file: File) => {
    setImporting(true);
    setImportSummary(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const nomeRaw = row["nome"] ?? row["Nome"];
        const faixaRaw = row["faixa_etaria"] ?? row["Faixa Etaria"] ?? row["Faixa Etária"];

        const nome = typeof nomeRaw === "string" ? nomeRaw.trim() : "";
        const faixa_etaria = typeof faixaRaw === "string" ? faixaRaw.trim() : "";

        // Campos obrigatórios
        if (!nome || !faixa_etaria) {
          skipped++;
          continue;
        }

        // Apenas faixas permitidas
        const faixasValidas = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];
        if (!faixasValidas.includes(faixa_etaria)) {
          skipped++;
          continue;
        }

        const dataNascimentoRaw = row["data_nascimento"] ?? row["Data Nascimento"] ?? row["data_nascimento (DD/MM/AAAA)"];
        const dataAniversarioRaw = row["data_aniversario"] ?? row["Data Aniversario"] ?? row["data_aniversario (DD/MM/AAAA ou DD-MM)"];
        const telefoneRaw = row["telefone"] ?? row["Telefone"];
        const statusTelefoneRaw = row["status_telefone"] ?? row["Status Telefone"];
        const cargosRaw = row["cargos"] ?? row["Cargos"] ?? row["cargos (separados por vírgula)"];
        const observacoesRaw = row["observacoes"] ?? row["Observacoes"] ?? row["Observações"];

        const data_nascimento = parseDateDDMMYYYY(dataNascimentoRaw);
        const data_aniversario = normalizeBirthday(
          dataAniversarioRaw ? String(dataAniversarioRaw).trim() : null
        );

        const telefone = telefoneRaw ? String(telefoneRaw).trim() : null;
        const status_telefone = statusTelefoneRaw ? String(statusTelefoneRaw).trim() : null;
        const observacoes = observacoesRaw ? String(observacoesRaw).trim() : null;
        const cargosArray = splitCargos(String(cargosRaw || ""));

        try {
          const { error } = await supabase.from("membros").insert([
            {
              nome,
              faixa_etaria,
              data_nascimento,
              data_aniversario,
              telefone,
              status_telefone,
              observacoes,
              cargos: cargosArray.length ? cargosArray : null,
            },
          ]);

          if (error) {
            console.error("Erro ao inserir membro da importação:", error, row);
            skipped++;
          } else {
            imported++;
          }
        } catch (err) {
          console.error("Erro inesperado ao importar linha:", err, row);
          skipped++;
        }
      }

      setImportSummary({
        total: rows.length,
        imported,
        skipped,
      });

      if (imported > 0) {
        toast.success(`Importação concluída: ${imported} membros importados, ${skipped} pulados.`);
      } else {
        toast.error("Nenhum membro foi importado. Verifique o arquivo.");
      }
    } catch (error) {
      console.error("Erro ao importar membros:", error);
      toast.error("Erro ao ler o arquivo de importação");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('backup-admin', {
        body: { action: 'export' },
      });

      if (error) {
        console.error('Erro ao gerar backup (edge function):', error);
        if ((error as any).message?.includes('Invalid JWT')) {
          toast.error('Sessão inválida ao gerar backup. Recarregue a página e tente novamente.');
          return;
        }
        throw error;
      }

      const backup = (data as any)?.backup;
      if (!backup) {
        throw new Error('Resposta inválida ao gerar backup');
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_app_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Backup gerado com sucesso.");
      setBackupStatus("Backup gerado com sucesso.");
    } catch (error) {
      console.error("Erro ao gerar backup:", error);
      toast.error("Erro ao gerar backup de dados");
      setBackupStatus("Erro ao gerar backup. Verifique o console para detalhes.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    setBackupImporting(true);
    setBackupStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object" || !parsed.data) {
        throw new Error("Arquivo de backup inválido");
      }

      const { data, error } = await supabase.functions.invoke('backup-admin', {
        body: { action: 'import', backup: parsed },
      });

      if (error) {
        console.error('Erro ao importar backup (edge function):', error);
        if ((error as any).message?.includes('Invalid JWT')) {
          toast.error('Sessão inválida ao importar backup. Recarregue a página e tente novamente.');
          return;
        }
        throw error;
      }

      if ((data as any)?.error) {
        const errMsg = (data as any).error;
        const code = (data as any).code;
        const message = (data as any).message;
        
        let displayMessage = errMsg;
        
        if (code === '23505') {
          displayMessage = `Conflito de dados: ${message || 'Duplicidade de registro'} (código 23505)`;
        } else if (code === '23503') {
          displayMessage = `Referência inválida: ${message || 'Registro dependente não encontrado'} (código 23503)`;
        } else if (message) {
          displayMessage = `${errMsg}: ${message}`;
        }
        
        toast.error(displayMessage);
        setBackupStatus(`Falha ao importar: ${displayMessage}`);
        return;
      }

      const imported = (data as any)?.imported;
      let successMsg = "Backup importado com sucesso.";
      if (imported) {
        const total = Object.values(imported).reduce((sum: number, v: any) => sum + (v || 0), 0);
        successMsg = `Backup importado: ${total} registros restaurados.`;
      }
      
      toast.success(successMsg);
      setBackupStatus(successMsg);
    } catch (error) {
      console.error("Erro ao importar backup:", error);
      toast.error("Erro ao importar backup de dados");
      setBackupStatus("Erro ao importar backup. Verifique o arquivo e tente novamente.");
    } finally {
      setBackupImporting(false);
    }
  };
  const handleAddUser = async () => {
    // Validate email
    const validation = userEmailSchema.safeParse({ email: newUserEmail.trim() });
    
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);
    try {
      // Chamar edge function para adicionar usuário
      const { data, error } = await supabase.functions.invoke('manage-user-access', {
        body: { email: newUserEmail.trim(), role: newUserRole }
      });

      if (error) {
        console.error('Erro ao adicionar usuário (edge function):', error);
        if ((error as any).message?.includes('Invalid JWT')) {
          toast.error('Sessão inválida ao adicionar usuário. Recarregue a página e tente novamente.');
          return;
        }
        throw error;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Acesso concedido com sucesso!");
      setNewUserEmail("");
      setNewUserRole('user');
      loadUsers();
    } catch (error) {
      console.error("Erro ao adicionar usuário:", error);
      toast.error("Erro ao conceder acesso");
    } finally {
      setLoading(false);
    }
  };


  type HslColor = { h: number; s: number; l: number };

  const parseHslString = (value?: string | null): HslColor => {
    if (!value) return { h: 158, s: 64, l: 52 };
    const parts = value
      .toString()
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (parts.length < 3) return { h: 158, s: 64, l: 52 };
    const [hRaw, sRaw, lRaw] = parts;
    const h = Number.parseFloat(hRaw) || 0;
    const s = Number.parseFloat(sRaw) || 0;
    const l = Number.parseFloat(lRaw) || 0;
    return {
      h: Math.min(360, Math.max(0, h)),
      s: Math.min(100, Math.max(0, s)),
      l: Math.min(100, Math.max(0, l)),
    };
  };

  const formatHslString = ({ h, s, l }: HslColor): string => {
    return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
  };

  interface HslPickerProps {
    label: string;
    value?: string | null;
    onChange: (value: string) => void;
  }

  const HslColorPicker = ({ label, value, onChange }: HslPickerProps) => {
    const { h, s, l } = parseHslString(value);

    const update = (partial: Partial<HslColor>) => {
      const next = { h, s, l, ...partial };
      onChange(formatHslString(next));
    };

    return (
      <div className="space-y-1">
        <Label className="text-xs md:text-sm">{label}</Label>
        <div className="flex items-center gap-3">
          <div
            className="relative h-14 w-14 rounded-full border border-border flex-shrink-0"
            style={{
              backgroundImage:
                "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
            }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow"
              style={{
                transform: `translate(-50%, -50%) rotate(${h}deg) translateY(-24px)`,
              }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
              <span className="w-10">Matiz</span>
              <input
                type="range"
                min={0}
                max={360}
                value={h}
                onChange={(e) => update({ h: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
              <span className="w-10">Sat.</span>
              <input
                type="range"
                min={0}
                max={100}
                value={s}
                onChange={(e) => update({ s: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
              <span className="w-10">Lum.</span>
              <input
                type="range"
                min={0}
                max={100}
                value={l}
                onChange={(e) => update({ l: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveTheme = async () => {
    if (!user) {
      toast.error("É necessário estar autenticado para salvar o tema.");
      return;
    }

    setSavingTheme(true);
    try {
      const customConfig: CustomThemeConfig | null = customTheme;

      const payload: any = {
        user_id: user.id,
        theme_preset: themePreset,
        custom_theme: customConfig,
      };

      const { error } = await supabase
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      const { applyThemePreset } = await import("@/lib/theme-presets");
      applyThemePreset(themePreset, customConfig || undefined);

      toast.success(
        makeDefaultTheme
          ? "Tema salvo e definido como padrão para a sua conta!"
          : "Tema salvo com sucesso!",
      );
    } catch (error) {
      console.error("Erro ao salvar tema:", error);
      toast.error("Erro ao salvar tema");
    } finally {
      setSavingTheme(false);
    }
  };

  const applyPresetInstant = (preset: ThemePresetId) => {
    const customConfig: CustomThemeConfig | null = customTheme;

    import("@/lib/theme-presets").then(({ applyThemePreset }) => {
      applyThemePreset(preset, customConfig || undefined);
    });
  };


  if (isMobile) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <div className="max-w-md mx-auto px-3 py-4">
          {mobileSection === "root" && (
            <div className="space-y-3">
              <Card
                className="hover-scale cursor-pointer"
                onClick={() => setMobileSection("theme")}
              >
                <CardHeader className="flex flex-row items-center gap-3 py-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                    <Monitor className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <CardTitle className="text-sm">Tema e personalização</CardTitle>
                    <CardDescription className="text-xs">
                      Cores, modo claro/escuro e aparência geral do app.
                    </CardDescription>
                  </div>
                  <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                </CardHeader>
              </Card>

              <Card
                className="hover-scale cursor-pointer"
                onClick={() => setMobileSection("users")}
              >
                <CardHeader className="flex flex-row items-center gap-3 py-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <CardTitle className="text-sm">Usuários</CardTitle>
                    <CardDescription className="text-xs">
                      Minha conta e gerenciamento de acesso do app.
                    </CardDescription>
                  </div>
                  <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                </CardHeader>
              </Card>

              {isGroupAdmin && activeGroup && (
                <Card
                  className="hover-scale cursor-pointer"
                  onClick={() => setMobileSection("group")}
                >
                  <CardHeader className="flex flex-row items-center gap-3 py-3 px-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <CardTitle className="text-sm">Gerenciar grupo</CardTitle>
                      <CardDescription className="text-xs">
                        Senha do grupo e administração de membros.
                      </CardDescription>
                    </div>
                    <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                  </CardHeader>
                </Card>
              )}

              {canManageRestricted && (
                <Card
                  className="hover-scale cursor-pointer"
                  onClick={() => setMobileSection("data")}
                >
                  <CardHeader className="flex flex-row items-center gap-3 py-3 px-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <CardTitle className="text-sm">Importação e backup</CardTitle>
                      <CardDescription className="text-xs">
                        Importar planilhas e gerenciar backups de dados.
                      </CardDescription>
                    </div>
                    <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                  </CardHeader>
                </Card>
              )}
            </div>
          )}

          {mobileSection === "theme" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 gap-1 text-xs mb-1"
                onClick={() => setMobileSection("root")}
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </Button>

              {/* 1️⃣ Aparência do app */}
              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="text-sm">Aparência do app</CardTitle>
                  <CardDescription className="text-xs">
                    Escolha entre modo claro, escuro ou seguir o sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3 px-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Modo de exibição</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        onClick={() => setTheme("light")}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Sun className="h-3.5 w-3.5" />
                        Claro
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        onClick={() => setTheme("dark")}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Moon className="h-3.5 w-3.5" />
                        Escuro
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        onClick={() => setTheme("system")}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Sistema
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2️⃣ Paleta de cores do app */}
              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="text-sm">Paleta de cores do app</CardTitle>
                  <CardDescription className="text-xs">
                    Selecione a combinação de cores preferida para o app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3 px-3 space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    A personalização de cores ainda não está disponível no celular.
                  </p>

                  <div className="space-y-2">
                    <Label className="text-xs">Paletas disponíveis</Label>
                    <div className="flex flex-col gap-1.5">
                      {THEME_PRESETS_META.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setThemePreset(preset.id);
                            applyPresetInstant(preset.id);
                          }}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                            themePreset === preset.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">{preset.label}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {preset.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {preset.preview.primary && (
                              <span
                                className="h-4 w-4 rounded-full border border-border"
                                style={{
                                  backgroundColor: `hsl(${preset.preview.primary})`,
                                }}
                              />
                            )}
                            {preset.preview.accent && (
                              <span
                                className="h-4 w-4 rounded-full border border-border"
                                style={{
                                  backgroundColor: `hsl(${preset.preview.accent})`,
                                }}
                              />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSaveTheme}
                    disabled={savingTheme}
                    className="mt-2 gap-1.5 h-8 text-xs w-full"
                  >
                    {savingTheme ? "Salvando..." : "Salvar tema"}
                  </Button>
                </CardContent>
              </Card>

              {/* 3️⃣ Personalização da tela inicial (tablet e desktop) */}
              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="text-sm">Personalização da tela inicial</CardTitle>
                  <CardDescription className="text-xs">
                    Organização avançada disponível apenas em telas maiores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3 px-3 space-y-2">
                  <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Disponível apenas em tablets e computadores.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

          {mobileSection === "users" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 gap-1 text-xs mb-1"
                onClick={() => setMobileSection("root")}
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </Button>

              {/* Mesmos cards da aba "Usuários" no desktop */}
              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <User className="h-4 w-4" />
                    Minha conta
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Atualize seu username e, se necessário, a senha de acesso.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pb-3 px-3">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      {accountAvatarUrl ? (
                        <AvatarImage src={accountAvatarUrl} alt="Foto de perfil" />
                      ) : (
                        <AvatarFallback>
                          {(accountUsername || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 text-xs"
                        disabled={avatarSaving}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {avatarSaving ? "Salvando foto..." : "Alterar foto de perfil"}
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Ajuste a imagem como na foto de perfil do WhatsApp.
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Email</Label>
                    <Input value={accountEmail ?? ""} disabled className="text-xs" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Username</Label>
                    <Input
                      value={accountUsername}
                      onChange={(e) => setAccountUsername(e.target.value)}
                      placeholder="Seu username"
                      disabled={accountLoading}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Nova senha</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          value={accountNewPassword}
                          onChange={(e) => setAccountNewPassword(e.target.value)}
                          placeholder="Deixe em branco para manter"
                          disabled={accountLoading}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Confirmar nova senha</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          value={accountConfirmPassword}
                          onChange={(e) => setAccountConfirmPassword(e.target.value)}
                          placeholder="Repita a nova senha"
                          disabled={accountLoading}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleUpdateAccount}
                      disabled={accountLoading}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {accountLoading ? "Salvando..." : "Salvar alterações"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {canManageRestricted && (
                <>
                  <Card>
                    <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Shield className="h-4 w-4" />
                    Gerenciar Usuários
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Controle quem tem acesso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pb-3 px-3">
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Email do usuário"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        type="email"
                        disabled={loading}
                      />
                    </div>
                    <Select
                      value={newUserRole}
                      onValueChange={(value: "admin" | "user") => setNewUserRole(value)}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddUser}
                      disabled={loading || !newUserEmail}
                      className="gap-1.5 h-8 px-3 text-xs"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {users.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        Nenhum usuário ainda
                      </p>
                    ) : (
                      users.map((userItem) => {
                        const presence = onlineUsers.find((o) => o.user_id === userItem.id);
                        const isOnline = !!presence;
                        const lastSeen = isOnline
                          ? presence.last_active_at
                          : userLastSeen[userItem.id] ?? null;

                        return (
                          <div
                            key={userItem.id}
                            className="flex items-center justify-between p-2 border rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs truncate">
                                  {userItem.username || "(sem username)"}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {userItem.email ?? "Email não disponível"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {isOnline
                                    ? "Online agora"
                                    : lastSeen
                                      ? `Offline • Última vez online em ${new Date(lastSeen).toLocaleString("pt-BR")}`
                                      : "Offline • Nenhum registro nesta sessão"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Select
                                value={userItem.role}
                                onValueChange={(value: "admin" | "user") =>
                                  handleChangeUserRole(userItem.id, value)
                                }
                                disabled={loading}
                              >
                                <SelectTrigger className="w-[92px] h-7 text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserToDelete(userItem.id)}
                                disabled={loading || userItem.id === user?.id}
                                className="h-7 w-7 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="text-sm">Usuários online (tempo real)</CardTitle>
                  <CardDescription className="text-xs">
                    Visualize quem está conectado agora, com horário de entrada e última atividade.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pb-3 px-3">
                  {users.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum usuário com acesso configurado ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {users.map((userItem) => {
                        const presence = onlineUsers.find((o) => o.user_id === userItem.id);
                        const isOnline = !!presence;
                        const lastSeen = isOnline
                          ? presence.last_active_at
                          : userLastSeen[userItem.id] ?? null;

                        return (
                          <div
                            key={userItem.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-sm truncate">
                                {userItem.username || "(sem username)"}
                              </span>
                              <span className="text-xs text-muted-foreground break-all truncate">
                                {userItem.email ?? "Email não disponível"}
                              </span>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div className={isOnline ? "text-primary" : "text-muted-foreground"}>
                                {isOnline ? "Online agora" : "Offline"}
                              </div>
                              <div>
                                {lastSeen
                                  ? `Última atividade em ${new Date(lastSeen).toLocaleString("pt-BR")}`
                                  : "Sem registros nesta sessão"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
                </>
              )}
            </div>
          )}

          {mobileSection === "group" && isGroupAdmin && activeGroup && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 gap-1 text-xs mb-1"
                onClick={() => setMobileSection("root")}
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </Button>

              <GroupSettingsSection />

              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Shield className="h-4 w-4" />
                    Administração do grupo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Altere senha, remova membros e promova administradores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <Button
                    type="button"
                    className="w-full h-8 text-xs"
                    onClick={() => navigate("/configuracoes/grupo-admin")}
                  >
                    Abrir painel de administração
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {mobileSection === "data" && canManageRestricted && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 gap-1 text-xs mb-1"
                onClick={() => setMobileSection("root")}
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </Button>

              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <FileSpreadsheet className="h-4 w-4" />
                    Importar membros
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Importe vários membros de uma vez usando uma planilha modelo (.xlsx)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pb-3 px-3">
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs"
                      onClick={handleDownloadTemplate}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar modelo (.xlsx)
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Campos obrigatórios: <strong>nome</strong> e <strong>faixa_etaria</strong>. Datas no
                      formato <strong>DD/MM/AAAA</strong>.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs">Arquivo para importação</Label>
                    <input
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void handleImportMembers(file);
                        e.target.value = "";
                      }}
                      disabled={importing}
                      className="text-xs"
                    />
                  </div>

                  {importSummary && (
                    <div className="text-[11px] text-muted-foreground border rounded-md p-2">
                      <p>Total de linhas na planilha: {importSummary.total}</p>
                      <p>Importados com sucesso: {importSummary.imported}</p>
                      <p>Pulados por erro ou dados faltando: {importSummary.skipped}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Download className="h-4 w-4" />
                    Backup de dados
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gere um arquivo JSON com membros, reuniões, presenças, notas e lembretes, ou importe um
                    backup existente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pb-3 px-3">
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      onClick={handleDownloadBackup}
                      disabled={backupLoading}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {backupLoading ? "Gerando backup..." : "Gerar/atualizar backup (JSON)"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Recomendo gerar um novo backup antes de qualquer importação.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs">Importar backup (JSON)</Label>
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPendingBackupFile(file);
                        setConfirmImportOpen(true);
                        e.target.value = "";
                      }}
                      disabled={backupImporting}
                      className="text-xs"
                    />
                  </div>

                  {backupStatus && (
                    <p className="text-[11px] text-muted-foreground border rounded-md p-2">
                      {backupStatus}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-4xl w-full">
 
        <div className="space-y-4 md:space-y-6">
          <GroupSettingsSection />
          {/* Card de acesso rápido à administração do grupo (se for admin do grupo) */}
          {isGroupAdmin && activeGroup && (
            <Card>
              <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                  <Shield className="h-4 w-4 md:h-5 md:w-5" />
                  Administração do Grupo
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Gerencie as configurações do grupo {activeGroup.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3 md:pb-6 px-3 md:px-6">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => navigate("/configuracoes/grupo-admin")}
                  className="gap-2 h-8 md:h-10 text-xs md:text-sm"
                >
                  <Shield className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Acessar painel de administração
                </Button>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="tema" className="w-full">
            <TabsList className="mb-4 flex flex-wrap gap-2">
              <TabsTrigger value="tema">Tema e personalização</TabsTrigger>
              {!isMobile && <TabsTrigger value="sidebar">Barra Lateral</TabsTrigger>}
              {canManageRestricted && (
                <>
                  <TabsTrigger value="usuarios">Usuários e cargos</TabsTrigger>
                  <TabsTrigger value="dados">Importação e backup</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="tema" className="space-y-4 md:space-y-6">
              {/* Appearance & Theme Presets */}
              <Card>
                <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                  <CardTitle className="text-sm md:text-lg">Aparência</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Personalize tema de cores e o modo de exibição
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3 md:pb-6 px-3 md:px-6 space-y-4">
                  <div className="space-y-3 md:space-y-4">
                    <Label className="text-xs md:text-sm">Modo (claro/escuro)</Label>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        onClick={() => setTheme("light")}
                        className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                      >
                        <Sun className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        Claro
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        onClick={() => setTheme("dark")}
                        className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                      >
                        <Moon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        Escuro
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        onClick={() => setTheme("system")}
                        className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                      >
                        <Monitor className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        Sistema
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    <Label className="text-xs md:text-sm">Paleta base</Label>
                    <p className="text-[11px] md:text-xs text-muted-foreground mb-1">
                      Escolha o tom principal do app. O resultado é aplicado em tempo real em
                      botões, destaques e navegação lateral.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      {/* Azul (padrão) */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("azul");
                          applyPresetInstant("azul");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "azul" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Azul (padrão)</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Visual confiável para painéis de dados e uso diário.
                            </p>
                          </div>
                          {themePreset === "azul" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(207 64% 47%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(207 64% 57%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(215 16% 94%)" }} />
                        </div>
                      </button>

                      {/* Laranja */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("laranja");
                          applyPresetInstant("laranja");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "laranja" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Laranja</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Destaques quentes para chamadas e ações importantes.
                            </p>
                          </div>
                          {themePreset === "laranja" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(33 100% 45%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(33 100% 55%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(27 22% 95%)" }} />
                        </div>
                      </button>

                      {/* Verde */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("verde");
                          applyPresetInstant("verde");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "verde" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Verde</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Sensação de estabilidade e foco em acompanhamento.
                            </p>
                          </div>
                          {themePreset === "verde" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(138 62% 38%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(138 62% 46%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(120 18% 93%)" }} />
                        </div>
                      </button>

                      {/* Rosa */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("rosa");
                          applyPresetInstant("rosa");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "rosa" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Rosa</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Destaque marcante para interfaces mais expressivas.
                            </p>
                          </div>
                          {themePreset === "rosa" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(335 100% 42%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(335 100% 50%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(300 20% 94%)" }} />
                        </div>
                      </button>

                      {/* Roxo */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("roxo");
                          applyPresetInstant("roxo");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "roxo" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Roxo</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Aparência moderna com toques de roxo profundo.
                            </p>
                          </div>
                          {themePreset === "roxo" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(292 100% 32%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(292 100% 40%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(280 22% 92%)" }} />
                        </div>
                      </button>

                      {/* Vermelho */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("vermelho");
                          applyPresetInstant("vermelho");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "vermelho" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Vermelho</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Ênfase forte para alertas e estados críticos.
                            </p>
                          </div>
                          {themePreset === "vermelho" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(0 74% 53%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(0 74% 60%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(0 10% 93%)" }} />
                        </div>
                      </button>

                      {/* Amarelo */}
                      <button
                        type="button"
                        onClick={() => {
                          setThemePreset("amarelo");
                          applyPresetInstant("amarelo");
                        }}
                        className={`group relative flex flex-col items-start rounded-xl border bg-card p-3 md:p-4 text-left shadow-[var(--shadow-2xs)] transition hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:ring-2 hover:ring-primary/60 ${
                          themePreset === "amarelo" ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold md:text-sm">Amarelo</span>
                            <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                              Tema luminoso, ótimo para ambientes mais claros.
                            </p>
                          </div>
                          {themePreset === "amarelo" && (
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/5 border-primary/40">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-1.5 md:gap-2">
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(51 100% 50%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(51 100% 56%)" }} />
                          <span className="h-5 w-8 rounded" style={{ backgroundColor: "hsl(48 96% 93%)" }} />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Controles guiados de intensidade e contraste */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* controles de intensidade removidos */}

                    {/* controles de contraste removidos */}
                  </div>

                  {/* Pré-visualização em tempo real */}
                  <div className="mt-2 md:mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs md:text-sm">Prévia de cartão e botões</Label>
                      <div className="rounded-xl border bg-card p-3 md:p-4 space-y-2 shadow-sm">
                        <p className="text-xs md:text-sm font-medium">Reunião desta semana</p>
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          Veja rapidamente os principais indicadores da sua classe.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" className="h-7 md:h-8 text-[11px] md:text-xs">
                            Ver detalhes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 md:h-8 text-[11px] md:text-xs"
                          >
                            Registrar presença
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs md:text-sm">Prévia de gráficos e dock/sidebar</Label>
                      <div className="rounded-xl border bg-card p-3 md:p-4 space-y-3 shadow-sm">
                        <div className="flex gap-1.5 items-end h-14">
                          {["--chart-1", "--chart-2", "--chart-3", "--chart-4"].map((token, idx) => (
                            <div
                              key={token}
                              className="flex-1 rounded-t-md"
                              style={{
                                backgroundColor: `hsl(var(${token}))`,
                                height: `${40 + idx * 6}px`,
                              }}
                            />
                          ))}
                          <div
                            className="w-1 rounded-t-md"
                            style={{
                              backgroundColor: "hsl(var(--chart-muted))",
                              height: "32px",
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-full bg-muted px-3 py-1.5">
                          <div className="flex gap-2">
                            {["--primary", "--accent", "--chart-1", "--chart-2"].map((token) => (
                              <span
                                key={token}
                                className="h-6 w-6 rounded-full"
                                style={{ backgroundColor: `hsl(var(${token}))` }}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] md:text-xs text-muted-foreground">
                            Prévia da dock / sidebar
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ações de tema e dock */}
                  <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
                    <Button
                      type="button"
                      onClick={handleSaveTheme}
                      disabled={savingTheme}
                      className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                    >
                      {savingTheme ? "Salvando..." : "Salvar tema"}
                    </Button>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                        onClick={() => navigate("/?edit=1")}
                      >
                        <Edit3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        Modo edição da tela inicial
                      </Button>

                    </div>
                  </div>
                </CardContent>
               </Card>

               {/* Minha conta - disponível para todos os usuários */}
               <Card>
                 <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                   <CardTitle className="flex items-center gap-1.5 md:gap-2 text-sm md:text-lg">
                     <User className="h-4 w-4 md:h-5 md:w-5" />
                     Minha conta
                   </CardTitle>
                   <CardDescription className="text-xs md:text-sm">
                     Atualize seu username, senha de acesso e foto de perfil.
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-3 md:space-y-4 pb-3 md:pb-6 px-3 md:px-6">
                   <div className="flex items-center gap-4">
                     <Avatar className="h-14 w-14 md:h-16 md:w-16">
                       {accountAvatarUrl ? (
                         <AvatarImage src={accountAvatarUrl} alt="Foto de perfil" />
                       ) : (
                         <AvatarFallback>
                           {(accountUsername || 'U').charAt(0).toUpperCase()}
                         </AvatarFallback>
                       )}
                     </Avatar>
                     <div className="space-y-1">
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         className="gap-1.5 md:gap-2 h-8 md:h-9 text-xs md:text-sm"
                         disabled={avatarSaving}
                         onClick={() => fileInputRef.current?.click()}
                       >
                         <Camera className="h-3.5 w-3.5 md:h-4 md:w-4" />
                         {avatarSaving ? 'Salvando foto...' : 'Alterar foto de perfil'}
                       </Button>
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          Ajuste a imagem como na foto de perfil da sua conta.
                        </p>
                     </div>
                     <input
                       ref={fileInputRef}
                       type="file"
                       accept="image/*"
                       className="hidden"
                       onChange={handleAvatarFileChange}
                     />
                   </div>

                   <div className="space-y-2">
                     <Label className="text-xs md:text-sm">Email</Label>
                     <Input value={accountEmail ?? ''} disabled className="text-xs md:text-sm" />
                   </div>

                   <div className="space-y-2">
                     <Label className="text-xs md:text-sm">Username</Label>
                     <Input
                       value={accountUsername}
                       onChange={(e) => setAccountUsername(e.target.value)}
                       placeholder="Seu username"
                       disabled={accountLoading}
                     />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div className="space-y-2">
                       <Label className="text-xs md:text-sm">Nova senha</Label>
                       <div className="relative">
                         <Input
                           type={showNewPassword ? 'text' : 'password'}
                           value={accountNewPassword}
                           onChange={(e) => setAccountNewPassword(e.target.value)}
                           placeholder="Deixe em branco para manter"
                           disabled={accountLoading}
                           className="pr-10"
                         />
                         <button
                           type="button"
                           onClick={() => setShowNewPassword((prev) => !prev)}
                           className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                           aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                         >
                           {showNewPassword ? (
                             <EyeOff className="h-4 w-4" />
                           ) : (
                             <Eye className="h-4 w-4" />
                           )}
                         </button>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <Label className="text-xs md:text-sm">Confirmar nova senha</Label>
                       <div className="relative">
                         <Input
                           type={showConfirmPassword ? 'text' : 'password'}
                           value={accountConfirmPassword}
                           onChange={(e) => setAccountConfirmPassword(e.target.value)}
                           placeholder="Repita a nova senha"
                           disabled={accountLoading}
                           className="pr-10"
                         />
                         <button
                           type="button"
                           onClick={() => setShowConfirmPassword((prev) => !prev)}
                           className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                           aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                         >
                           {showConfirmPassword ? (
                             <EyeOff className="h-4 w-4" />
                           ) : (
                             <Eye className="h-4 w-4" />
                           )}
                         </button>
                       </div>
                     </div>
                   </div>

                   <div className="space-y-3">
                     <BootstrapAdminButton
                       accountEmail={accountEmail}
                       isAdmin={isAdmin}
                       onPromoted={() => {
                         void checkAdminStatus();
                         // Força recarregar lista/abas se necessário
                         window.setTimeout(() => window.location.reload(), 300);
                       }}
                     />

                     <div className="flex justify-end">
                       <Button
                         type="button"
                         onClick={handleUpdateAccount}
                         disabled={accountLoading}
                         className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                       >
                         {accountLoading ? 'Salvando...' : 'Salvar alterações'}
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>

               {avatarImageSrc && (
                 <ImageCropDialog
                   open={avatarDialogOpen}
                   onOpenChange={setAvatarDialogOpen}
                   imageSrc={avatarImageSrc}
                   onCropComplete={handleAvatarCropped}
                 />
               )}
             </TabsContent>

            {!isMobile && (
              <TabsContent value="sidebar" className="space-y-4 md:space-y-6">
                <SidebarConfigCard />
              </TabsContent>
            )}

            {isAdmin && (
              <>
                <TabsContent value="usuarios" className="space-y-4 md:space-y-6">
                  {/* Account Management for current user */}
                  <Card>
                    <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                      <CardTitle className="flex items-center gap-1.5 md:gap-2 text-sm md:text-lg">
                        <User className="h-4 w-4 md:h-5 md:w-5" />
                        Minha conta
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Atualize seu username e, se necessário, a senha de acesso.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4 pb-3 md:pb-6 px-3 md:px-6">
                       <div className="flex items-center gap-4">
                         <Avatar className="h-14 w-14 md:h-16 md:w-16">
                           {accountAvatarUrl ? (
                             <AvatarImage src={accountAvatarUrl} alt="Foto de perfil" />
                           ) : (
                             <AvatarFallback>
                               {(accountUsername || 'U').charAt(0).toUpperCase()}
                             </AvatarFallback>
                           )}
                         </Avatar>
                         <div className="space-y-1">
                           <Button
                             type="button"
                             variant="outline"
                             size="sm"
                             className="gap-1.5 md:gap-2 h-8 md:h-9 text-xs md:text-sm"
                             disabled={avatarSaving}
                             onClick={() => fileInputRef.current?.click()}
                           >
                             <Camera className="h-3.5 w-3.5 md:h-4 md:w-4" />
                             {avatarSaving ? 'Salvando foto...' : 'Alterar foto de perfil'}
                           </Button>
                           <p className="text-[11px] md:text-xs text-muted-foreground">
                             Ajuste a imagem como na foto de perfil do WhatsApp.
                           </p>
                         </div>
                         <input
                           ref={fileInputRef}
                           type="file"
                           accept="image/*"
                           className="hidden"
                           onChange={handleAvatarFileChange}
                         />
                       </div>
 
                       <div className="space-y-2">
                         <Label className="text-xs md:text-sm">Email</Label>
                         <Input value={accountEmail ?? ''} disabled className="text-xs md:text-sm" />
                       </div>
 
                       <div className="space-y-2">
                         <Label className="text-xs md:text-sm">Username</Label>
                         <Input
                           value={accountUsername}
                           onChange={(e) => setAccountUsername(e.target.value)}
                           placeholder="Seu username"
                           disabled={accountLoading}
                         />
                       </div>
 
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         <div className="space-y-2">
                           <Label className="text-xs md:text-sm">Nova senha</Label>
                           <div className="relative">
                             <Input
                               type={showNewPassword ? 'text' : 'password'}
                               value={accountNewPassword}
                               onChange={(e) => setAccountNewPassword(e.target.value)}
                               placeholder="Deixe em branco para manter"
                               disabled={accountLoading}
                               className="pr-10"
                             />
                             <button
                               type="button"
                               onClick={() => setShowNewPassword((prev) => !prev)}
                               className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                               aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                             >
                               {showNewPassword ? (
                                 <EyeOff className="h-4 w-4" />
                               ) : (
                                 <Eye className="h-4 w-4" />
                               )}
                             </button>
                           </div>
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs md:text-sm">Confirmar nova senha</Label>
                           <div className="relative">
                             <Input
                               type={showConfirmPassword ? 'text' : 'password'}
                               value={accountConfirmPassword}
                               onChange={(e) => setAccountConfirmPassword(e.target.value)}
                               placeholder="Repita a nova senha"
                               disabled={accountLoading}
                               className="pr-10"
                             />
                             <button
                               type="button"
                               onClick={() => setShowConfirmPassword((prev) => !prev)}
                               className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                               aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                             >
                               {showConfirmPassword ? (
                                 <EyeOff className="h-4 w-4" />
                               ) : (
                                 <Eye className="h-4 w-4" />
                               )}
                             </button>
                           </div>
                         </div>
                       </div>
 
                       <div className="flex justify-end">
                         <Button
                           type="button"
                           onClick={handleUpdateAccount}
                           disabled={accountLoading}
                           className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                         >
                           {accountLoading ? 'Salvando...' : 'Salvar alterações'}
                         </Button>
                       </div>
                     </CardContent>
                  </Card>
 
                  {avatarImageSrc && (
                    <ImageCropDialog
                      open={avatarDialogOpen}
                      onOpenChange={setAvatarDialogOpen}
                      imageSrc={avatarImageSrc}
                      onCropComplete={handleAvatarCropped}
                    />
                  )}
 
                   {/* User Management Section - Only visible to admins */}
                  <Card>
                    <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                      <CardTitle className="flex items-center gap-1.5 md:gap-2 text-sm md:text-lg">
                        <Shield className="h-4 w-4 md:h-5 md:w-5" />
                        Gerenciar Usuários
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Controle quem tem acesso
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4 pb-3 md:pb-6 px-3 md:px-6">
                      {/* Add User Form */}
                      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-0">
                          <Input
                            placeholder="Email do usuário"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            type="email"
                            disabled={loading}
                          />
                        </div>
                        <Select
                          value={newUserRole}
                          onValueChange={(value: 'admin' | 'user') => setNewUserRole(value)}
                          disabled={loading}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Usuário</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleAddUser}
                          disabled={loading || !newUserEmail}
                          className="gap-1.5 md:gap-2 h-8 md:h-10 px-3 md:px-4 text-xs md:text-sm"
                        >
                          <UserPlus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          Add
                        </Button>
                      </div>

                      {/* Users List */}
                      <div className="space-y-1.5 md:space-y-2">
                        {users.length === 0 ? (
                          <p className="text-xs md:text-sm text-muted-foreground text-center py-3 md:py-4">
                            Nenhum usuário ainda
                          </p>
                        ) : (
                          users.map((userItem) => {
                            const presence = onlineUsers.find((o) => o.user_id === userItem.id);
                            const isOnline = !!presence;
                            const lastSeen = isOnline
                              ? presence.last_active_at
                              : userLastSeen[userItem.id] ?? null;

                            return (
                              <div
                                key={userItem.id}
                                className="flex items-center justify-between p-2 md:p-3 border rounded-lg"
                              >
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                  <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-xs md:text-sm truncate">
                                      {userItem.username || '(sem username)'}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                                      {userItem.email ?? 'Email não disponível'}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground">
                                      {isOnline
                                        ? 'Online agora'
                                        : lastSeen
                                          ? `Offline • Última vez online em ${new Date(lastSeen).toLocaleString('pt-BR')}`
                                          : 'Offline • Nenhum registro nesta sessão'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                                  <Select
                                    value={userItem.role}
                                    onValueChange={(value: 'admin' | 'user') =>
                                      handleChangeUserRole(userItem.id, value)
                                    }
                                    disabled={loading}
                                  >
                                    <SelectTrigger className="w-[92px] h-7 md:h-8 text-[10px] md:text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="user">User</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setUserToDelete(userItem.id)}
                                    disabled={loading || userItem.id === user?.id}
                                    className="h-7 w-7 md:h-8 md:w-8 p-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>


                  {/* Usuários Online em tempo real */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Usuários online (tempo real)</CardTitle>
                      <CardDescription>
                        Visualize quem está conectado agora, com horário de entrada e última atividade.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {users.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum usuário com acesso configurado ainda.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {users.map((userItem) => {
                            const presence = onlineUsers.find((o) => o.user_id === userItem.id);
                            const isOnline = !!presence;
                            const lastSeen = isOnline
                              ? presence.last_active_at
                              : userLastSeen[userItem.id] ?? null;

                            return (
                              <div
                                key={userItem.id}
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-sm truncate">
                                    {userItem.username || '(sem username)'}
                                  </span>
                                  <span className="text-xs text-muted-foreground break-all truncate">
                                    {userItem.email ?? 'Email não disponível'}
                                  </span>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  <div className={isOnline ? 'text-primary' : 'text-muted-foreground'}>
                                    {isOnline ? 'Online agora' : 'Offline'}
                                  </div>
                                  <div>
                                    {lastSeen
                                      ? `Última atividade em ${new Date(lastSeen).toLocaleString('pt-BR')}`
                                      : 'Sem registros nesta sessão'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                 </TabsContent>

                 <TabsContent value="dados" className="space-y-4 md:space-y-6">
                  {/* Importar membros via Excel */}
                  <Card>
                    <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                      <CardTitle className="flex items-center gap-1.5 md:gap-2 text-sm md:text-lg">
                        <FileSpreadsheet className="h-4 w-4 md:h-5 md:w-5" />
                        Importar membros
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Importe vários membros de uma vez usando uma planilha modelo (.xlsx)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4 pb-3 md:pb-6 px-3 md:px-6">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                          onClick={handleDownloadTemplate}
                        >
                          <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          Baixar modelo (.xlsx)
                        </Button>
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          Campos obrigatórios: <strong>nome</strong> e <strong>faixa_etaria</strong>. Datas no
                          formato <strong>DD/MM/AAAA</strong>.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Label className="text-xs md:text-sm">Arquivo para importação</Label>
                        <input
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void handleImportMembers(file);
                            e.target.value = "";
                          }}
                          disabled={importing}
                          className="text-xs md:text-sm"
                        />
                      </div>

                      {importSummary && (
                        <div className="text-[11px] md:text-xs text-muted-foreground border rounded-md p-2 md:p-3">
                          <p>Total de linhas na planilha: {importSummary.total}</p>
                          <p>Importados com sucesso: {importSummary.imported}</p>
                          <p>Pulados por erro ou dados faltando: {importSummary.skipped}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Backup de dados */}
                  <Card>
                    <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
                      <CardTitle className="flex items-center gap-1.5 md:gap-2 text-sm md:text-lg">
                        <Download className="h-4 w-4 md:h-5 md:w-5" />
                        Backup de dados
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Gere um arquivo JSON com membros, reuniões, presenças, notas e lembretes, ou importe um
                        backup existente.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4 pb-3 md:pb-6 px-3 md:px-6">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Button
                          type="button"
                          onClick={handleDownloadBackup}
                          disabled={backupLoading}
                          className="gap-1.5 md:gap-2 h-8 md:h-10 text-xs md:text-sm"
                        >
                          <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          {backupLoading ? "Gerando backup..." : "Gerar/atualizar backup (JSON)"}
                        </Button>
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          Recomendo gerar um novo backup antes de qualquer importação.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Label className="text-xs md:text-sm">Importar backup (JSON)</Label>
                        <input
                          type="file"
                          accept="application/json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setPendingBackupFile(file);
                            setConfirmImportOpen(true);
                            e.target.value = "";
                          }}
                          disabled={backupImporting}
                          className="text-xs md:text-sm"
                        />
                      </div>

                      {backupStatus && (
                        <p className="text-[11px] md:text-xs text-muted-foreground border rounded-md p-2 md:p-3">
                          {backupStatus}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>

      {/* Delete User Dialog */}
      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar o acesso deste usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Removendo..." : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Confirm Import Backup Dialog */}
      <AlertDialog
        open={confirmImportOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmImportOpen(false);
            setPendingBackupFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar backup</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá <strong>substituir (apagar)</strong> todos os dados do grupo ativo e restaurar exatamente o que está no arquivo de backup.
              <br/><br/>
              <strong>Recomendação:</strong> Gere um novo backup dos dados atuais antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={backupImporting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={backupImporting || !pendingBackupFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingBackupFile) return;
                void handleImportBackup(pendingBackupFile);
                setPendingBackupFile(null);
                setConfirmImportOpen(false);
              }}
            >
              {backupImporting ? "Importando..." : "Confirmar importação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Configuracoes;
