import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthError } from "@supabase/supabase-js";
import { Loader2, Eye, EyeOff, Mail, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const SAVED_ACCOUNTS_KEY = "zelo_saved_accounts";
const PENDING_INVITE_KEY = "zelo_pending_invite_token";

type AuthMode = "login" | "signup" | "forgot" | "reset";

type SavedAccount = {
  id: string;
  email: string;
  username: string | null;
  lastLoginAt: string;
};

type FieldErrors = {
  email?: string;
  username?: string;
  password?: string;
  resetEmail?: string;
  resetPassword?: string;
};

const passwordPolicyMessage =
  "A senha precisa ter no minimo 8 caracteres, com letra maiuscula, letra minuscula e numero.";

const strongPasswordSchema = z
  .string()
  .min(8, passwordPolicyMessage)
  .max(100, "A senha deve ter no maximo 100 caracteres.")
  .regex(/[a-z]/, passwordPolicyMessage)
  .regex(/[A-Z]/, passwordPolicyMessage)
  .regex(/[0-9]/, passwordPolicyMessage);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Informe seu email ou nome de usuario.").max(255),
  password: z.string().min(1, "Informe sua senha.").max(100, "A senha deve ter no maximo 100 caracteres."),
});

const signupSchema = z.object({
  email: z.string().trim().min(1, "Informe seu email.").email("Digite um email valido.").max(255),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `O nome de usuario precisa ter pelo menos ${USERNAME_MIN_LENGTH} caracteres.`)
    .max(USERNAME_MAX_LENGTH, `O nome de usuario deve ter no maximo ${USERNAME_MAX_LENGTH} caracteres.`)
    .regex(/^[a-z0-9._-]+$/, "Use apenas letras, numeros, ponto, traco ou underline no nome de usuario."),
  password: strongPasswordSchema,
});

function normalizeUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[._-]{2,}/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
}

function readSavedAccounts(): SavedAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveAccount(account: SavedAccount) {
  const accounts = readSavedAccounts().filter((item) => item.id !== account.id && item.email !== account.email);
  const next = [account, ...accounts].slice(0, 6);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
}

function removeSavedAccount(accountId: string) {
  const next = readSavedAccounts().filter((item) => item.id !== accountId);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
}

function getAuthErrorMessage(error: AuthError) {
  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Email, nome de usuario ou senha incorretos. Confira os dados ou use 'Esqueci minha senha'.";
  }

  if (message.includes("email not confirmed")) {
    return "Seu email ainda nao foi confirmado. Abra o email de confirmacao enviado pelo Supabase e tente novamente.";
  }

  if (message.includes("user already registered") || message.includes("already registered")) {
    return "Este email ja esta cadastrado. Entre com ele ou use outro email.";
  }

  if (message.includes("weak password") || message.includes("password")) {
    return passwordPolicyMessage;
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  if (message.includes("signup disabled")) {
    return "O cadastro esta desativado no Supabase. Ative novos cadastros nas configuracoes de autenticacao.";
  }

  return "Nao foi possivel concluir agora. Verifique sua conexao e tente novamente.";
}

async function bootstrapCurrentUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  const { error } = await supabase.functions.invoke("manage-user-access", {
    body: { action: "bootstrap_user" },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.warn("[Auth] Nao foi possivel preparar acesso base do usuario:", error);
  }
}

function getPendingInviteDestination() {
  const token = localStorage.getItem(PENDING_INVITE_KEY);
  return token ? `/convite/${encodeURIComponent(token)}` : null;
}

async function getPostAuthDestination(userId: string) {
  const pendingInvite = getPendingInviteDestination();
  if (pendingInvite) return pendingInvite;

  const { data, error } = await supabase
    .from("user_active_group")
    .select("group_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[Auth] Nao foi possivel checar grupo ativo:", error);
    return "/grupo";
  }

  return data?.group_id ? "/" : "/grupo";
}

async function isUsernameAvailable(username: string) {
  const { data, error } = await supabase.functions.invoke("resolve-username", {
    body: { username },
  });

  if (data?.email) return false;

  const status = (error as any)?.context?.status;
  if (error && status !== 404) {
    console.warn("[Auth] Nao foi possivel verificar username antes do cadastro:", error);
  }

  return true;
}

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("reset") === "1" ? "reset" : "login";
  });
  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => readSavedAccounts());
  const [emailConfirmationNotice, setEmailConfirmationNotice] = useState<string | null>(null);

  const title = useMemo(() => {
    if (isSignup) return "Criar conta";
    if (isForgot) return "Recuperar senha";
    if (isReset) return "Nova senha";
    return "Bem-vindo";
  }, [isForgot, isReset, isSignup]);

  const description = useMemo(() => {
    if (isSignup) return "Cadastre-se para comecar a usar o sistema.";
    if (isForgot) return "Informe o email da conta para receber o link de recuperacao.";
    if (isReset) return "Defina uma nova senha para sua conta.";
    return "Entre com seu email ou nome de usuario para acessar o sistema.";
  }, [isForgot, isReset, isSignup]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setPassword("");
        setResetPassword("");
        setConfirmResetPassword("");
        setFieldErrors({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const redirectIfAlreadyLoggedIn = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session?.user || isReset) return;

      const destination = await getPostAuthDestination(session.user.id);
      if (!cancelled) {
        navigate(destination, { replace: true });
      }
    };

    void redirectIfAlreadyLoggedIn();

    return () => {
      cancelled = true;
    };
  }, [isReset, navigate]);

  const resetForm = (nextMode: AuthMode) => {
    setMode(nextMode);
    setIdentifier("");
    setEmail("");
    setUsername("");
    setPassword("");
    setResetEmail("");
    setResetPassword("");
    setConfirmResetPassword("");
    setFieldErrors({});
    setEmailConfirmationNotice(null);
  };

  const resolveLoginEmail = async (rawIdentifier: string) => {
    const trimmedIdentifier = rawIdentifier.trim();
    if (trimmedIdentifier.includes("@")) return trimmedIdentifier;

    const normalizedIdentifier = normalizeUsername(trimmedIdentifier);
    if (!normalizedIdentifier) {
      throw new Error("Informe um nome de usuario valido.");
    }

    const { data: resolved, error } = await supabase.functions.invoke("resolve-username", {
      body: { username: normalizedIdentifier },
    });

    if (error || !resolved || typeof resolved.email !== "string") {
      throw new Error("Usuario nao encontrado. Confira o nome ou entre com o email.");
    }

    return resolved.email;
  };

  const rememberCurrentAccount = async (userId: string, fallbackEmail: string) => {
    let profileUsername: string | null = null;
    let profileEmail = fallbackEmail;

    const { data } = await supabase
      .from("profiles")
      .select("username, email")
      .eq("id", userId)
      .maybeSingle();

    if (data?.username) profileUsername = data.username;
    if (data?.email) profileEmail = data.email;

    saveAccount({
      id: userId,
      email: profileEmail,
      username: profileUsername,
      lastLoginAt: new Date().toISOString(),
    });
    setSavedAccounts(readSavedAccounts());
  };

  const handleLogin = async () => {
    const validation = loginSchema.safeParse({
      identifier,
      password,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message ?? "Confira os dados de login.");
      return;
    }

    setIsLoading(true);

    let loginEmail: string;
    try {
      loginEmail = await resolveLoginEmail(identifier);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel localizar este usuario.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      toast.error(getAuthErrorMessage(error));
      setIsLoading(false);
      return;
    }

    await bootstrapCurrentUser();
    const userId = data.user?.id;
    if (userId) {
      await rememberCurrentAccount(userId, data.user?.email ?? loginEmail);
    }

    const destination = userId ? await getPostAuthDestination(userId) : "/";
    toast.success("Login realizado com sucesso.");
    navigate(destination, { replace: true });
  };

  const handleSignup = async () => {
    setFieldErrors({});
    setEmailConfirmationNotice(null);

    const normalizedUsername = normalizeUsername(username);
    const validation = signupSchema.safeParse({
      email: email.trim(),
      username: normalizedUsername,
      password,
    });

    if (!validation.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of validation.error.errors) {
        const field = issue.path[0];
        if ((field === "email" || field === "username" || field === "password") && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      toast.error(validation.error.errors[0]?.message ?? "Confira os dados do cadastro.");
      return;
    }

    setIsLoading(true);

    const usernameAvailable = await isUsernameAvailable(normalizedUsername);
    if (!usernameAvailable) {
      setFieldErrors((prev) => ({ ...prev, username: "Este nome de usuario ja esta em uso." }));
      toast.error("Este nome de usuario ja esta em uso. Escolha outro.");
      setIsLoading(false);
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: normalizedUsername,
        },
      },
    });

    if (error) {
      toast.error(getAuthErrorMessage(error));
      setIsLoading(false);
      return;
    }

    const identities = (signUpData.user as any)?.identities;
    if (Array.isArray(identities) && identities.length === 0) {
      setMode("login");
      setIdentifier(email.trim());
      setPassword("");
      toast.error("Este email ja esta cadastrado. Entre com ele ou use 'Esqueci minha senha'.");
      setIsLoading(false);
      return;
    }

    if (signUpData.session && signUpData.user) {
      await bootstrapCurrentUser();
      await rememberCurrentAccount(signUpData.user.id, signUpData.user.email ?? email.trim());
      const destination = await getPostAuthDestination(signUpData.user.id);
      toast.success("Cadastro realizado com sucesso.");
      navigate(destination, { replace: true });
      return;
    }

    setMode("login");
    setIdentifier(email.trim());
    setPassword("");
    setEmailConfirmationNotice(
      "Cadastro criado. Antes de entrar, confirme seu email pelo link enviado para sua caixa de entrada.",
    );
    toast.success("Cadastro criado. Confirme seu email para liberar o acesso.");
  };

  const handleSendPasswordReset = async () => {
    setFieldErrors({});
    const rawIdentifier = resetEmail.trim() || identifier.trim();

    if (!rawIdentifier) {
      setFieldErrors({ resetEmail: "Informe o email ou nome de usuario da conta." });
      toast.error("Informe o email ou nome de usuario da conta.");
      return;
    }

    setIsLoading(true);
    try {
      const targetEmail = await resolveLoginEmail(rawIdentifier);
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=1`,
      });

      if (error) {
        toast.error(getAuthErrorMessage(error));
        return;
      }

      setMode("login");
      setIdentifier(targetEmail);
      toast.success("Enviamos um link de recuperacao para seu email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o email de recuperacao.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRecoveredPassword = async () => {
    setFieldErrors({});
    const validation = strongPasswordSchema.safeParse(resetPassword);

    if (!validation.success) {
      setFieldErrors({ resetPassword: validation.error.errors[0]?.message ?? passwordPolicyMessage });
      toast.error(validation.error.errors[0]?.message ?? passwordPolicyMessage);
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      setFieldErrors({ resetPassword: "As senhas nao coincidem." });
      toast.error("As senhas nao coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: resetPassword });
      if (error) {
        toast.error(getAuthErrorMessage(error));
        return;
      }

      await bootstrapCurrentUser();
      const destination = data.user?.id ? await getPostAuthDestination(data.user.id) : "/";
      toast.success("Senha alterada com sucesso.");
      navigate(destination, { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    try {
      if (isLogin) await handleLogin();
      if (isSignup) await handleSignup();
      if (isForgot) await handleSendPasswordReset();
      if (isReset) await handleUpdateRecoveredPassword();
    } catch (error) {
      console.error("[Auth] Erro na autenticacao:", error);
      toast.error("Nao foi possivel concluir agora. Verifique sua conexao e tente novamente.");
      setIsLoading(false);
    }
  };

  const handleSavedAccountClick = (account: SavedAccount) => {
    setMode("login");
    setIdentifier(account.username || account.email);
    setPassword("");
    setEmailConfirmationNotice(null);
  };

  const handleRemoveSavedAccount = (accountId: string) => {
    removeSavedAccount(accountId);
    setSavedAccounts(readSavedAccounts());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {emailConfirmationNotice && (
            <div className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {emailConfirmationNotice}
            </div>
          )}

          {isLogin && savedAccounts.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Contas neste aparelho
              </p>
              <div className="space-y-2">
                {savedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleSavedAccountClick(account)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {account.username || account.email}
                        </span>
                        {account.username && (
                          <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSavedAccount(account.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remover conta salva"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4" noValidate>
            {(isLogin || isForgot) && (
              <div className="space-y-2">
                <Label htmlFor={isForgot ? "resetEmail" : "identifier"}>
                  {isForgot ? "Email ou nome de usuario" : "Email ou nome de usuario"}
                </Label>
                <Input
                  id={isForgot ? "resetEmail" : "identifier"}
                  type="text"
                  placeholder="seu@email.com ou seu_usuario"
                  value={isForgot ? resetEmail : identifier}
                  onChange={(e) => {
                    if (isForgot) {
                      setResetEmail(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, resetEmail: undefined }));
                    } else {
                      setIdentifier(e.target.value);
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  disabled={isLoading}
                  required
                />
                {fieldErrors.resetEmail && <p className="text-sm text-destructive">{fieldErrors.resetEmail}</p>}
              </div>
            )}

            {isSignup && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Ex: igor_martins"
                    value={username}
                    onBlur={() => setUsername((current) => normalizeUsername(current))}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    disabled={isLoading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Pode digitar com espacos; o app ajusta para o formato aceito.
                  </p>
                  {fieldErrors.username && <p className="text-sm text-destructive">{fieldErrors.username}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    disabled={isLoading}
                    required
                  />
                  {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
                </div>
              </>
            )}

            {(isLogin || isSignup) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Senha</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setResetEmail(identifier);
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                      disabled={isLoading}
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (isSignup) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    disabled={isLoading}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignup && (
                  <p className="text-xs text-muted-foreground">
                    Minimo 8 caracteres, com maiuscula, minuscula e numero.
                  </p>
                )}
                {isSignup && fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>
            )}

            {isReset && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="resetPassword">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="resetPassword"
                      type={showResetPassword ? "text" : "password"}
                      placeholder="********"
                      value={resetPassword}
                      onChange={(e) => {
                        setResetPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, resetPassword: undefined }));
                      }}
                      autoComplete="new-password"
                      disabled={isLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showResetPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimo 8 caracteres, com maiuscula, minuscula e numero.
                  </p>
                  {fieldErrors.resetPassword && (
                    <p className="text-sm text-destructive">{fieldErrors.resetPassword}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmResetPassword">Confirmar nova senha</Label>
                  <Input
                    id="confirmResetPassword"
                    type={showResetPassword ? "text" : "password"}
                    placeholder="********"
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : isForgot ? (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar link
                </>
              ) : isReset ? (
                "Alterar senha"
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {isForgot || isReset ? (
              <button
                type="button"
                onClick={() => resetForm("login")}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                Voltar para login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => resetForm(isLogin ? "signup" : "login")}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                {isLogin ? "Nao tem uma conta? Cadastre-se" : "Ja tem uma conta? Faca login"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
