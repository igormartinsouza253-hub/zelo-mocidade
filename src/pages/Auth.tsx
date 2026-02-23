import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string()
    .trim()
    .min(1, "Email ou nome de usuário é obrigatório")
    .max(255, "Identificador deve ter no máximo 255 caracteres"),
  password: z.string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
});

const signupSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "Email é obrigatório")
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  username: z.string()
    .trim()
    .min(3, "Nome de usuário deve ter no mínimo 3 caracteres")
    .max(50, "Nome de usuário deve ter no máximo 50 caracteres")
    .regex(/^[^\s]+$/u, "Nome de usuário inválido. Não use espaços."),
  password: z.string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signupErrors, setSignupErrors] = useState<{ email?: string; username?: string; password?: string }>({});

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Volta para a tela pública (/auth) após o OAuth, evitando cair em rotas protegidas.
          redirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
      }
      // Em caso de sucesso, o browser vai redirecionar para o Google.
    } catch (err) {
      console.error("Erro ao iniciar login com Google:", err);
      toast.error("Não foi possível iniciar o login com Google.");
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isLogin) {
        // Validação para login
        const validation = loginSchema.safeParse({
          identifier: identifier.trim(),
          password,
        });

        if (!validation.success) {
          const firstError = validation.error.errors[0];
          toast.error(firstError.message);
          return;
        }

        setIsLoading(true);

        // Permitir login por email OU username
        const trimmedIdentifier = identifier.trim();
        let loginEmail = trimmedIdentifier;

        if (!trimmedIdentifier.includes("@")) {
          // Tratar como username: resolver email associado via função de backend
          const { data: resolved, error: resolveError } = await supabase.functions.invoke(
            "resolve-username",
            {
              body: { username: trimmedIdentifier },
            },
          );

          if (resolveError) {
            console.error("Erro ao resolver username via backend:", resolveError);
            toast.error("Não foi possível fazer login. Tente novamente.");
            setIsLoading(false);
            return;
          }

          if (!resolved || typeof resolved.email !== "string") {
            toast.error("Usuário não encontrado ou sem email associado. Tente entrar com o email.");
            setIsLoading(false);
            return;
          }

          loginEmail = resolved.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Credenciais incorretas");
          } else {
            toast.error(error.message);
          }
          setIsLoading(false);
          return;
        }

        toast.success("Login realizado com sucesso!");
        navigate("/");
      } else {
        // Validação para cadastro
        setSignupErrors({});
        const validation = signupSchema.safeParse({
          email: email.trim(),
          username: username.trim(),
          password,
        });

        if (!validation.success) {
          const fieldErrors: { email?: string; username?: string; password?: string } = {};
          for (const issue of validation.error.errors) {
            const field = issue.path[0];
            if (field === "email" || field === "username" || field === "password") {
              if (!fieldErrors[field]) {
                fieldErrors[field] = issue.message;
              }
            }
          }
          setSignupErrors(fieldErrors);

          const firstError = validation.error.errors[0];
          const message = firstError.path[0] === "username"
            ? `Erro no nome de usuário: ${firstError.message}`
            : firstError.message;
          toast.error(message);
          return;
        }

        setIsLoading(true);

        // Verificar se username já está em uso
        const { data: existingUsername, error: usernameError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.trim())
          .maybeSingle();

        if (usernameError) {
          console.error("Erro ao verificar username:", usernameError);
          toast.error("Não foi possível validar o nome de usuário.");
          setIsLoading(false);
          return;
        }

        if (existingUsername) {
          toast.error("Este nome de usuário já está em uso.");
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              username: username.trim(),
            },
          },
        });

        if (error) {
          if (error.message.includes("User already registered")) {
            toast.error("Este email já está cadastrado");
          } else {
            toast.error(error.message);
          }
          setIsLoading(false);
          return;
        }

        toast.success("Cadastro realizado com sucesso! Verifique seu email para confirmar o acesso.");
        navigate("/");
      }
    } catch (error) {
      console.error("Erro na autenticação:", error);
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Bem-vindo" : "Criar Conta"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? "Entre com seu email ou nome de usuário para acessar o sistema"
              : "Cadastre-se para começar a usar o sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Continuar com Google"
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isLogin ? (
              <div className="space-y-2">
                <Label htmlFor="identifier">Email ou nome de usuário</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="seu@email.com ou seu_usuario"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de usuário</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Seu nome de usuário"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setSignupErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    disabled={isLoading}
                    required
                  />
                  {signupErrors.username && (
                    <p className="text-sm text-destructive">{signupErrors.username}</p>
                  )}
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
                      setSignupErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    disabled={isLoading}
                    required
                  />
                  {signupErrors.email && (
                    <p className="text-sm text-destructive">{signupErrors.email}</p>
                  )}
                </div>
              </>
            )}
            <div className="space-y-2">
               <Label htmlFor="password">Senha</Label>
               <div className="relative">
                 <Input
                   id="password"
                   type={showPassword ? "text" : "password"}
                   placeholder="••••••••"
                   value={password}
                   onChange={(e) => {
                     setPassword(e.target.value);
                     if (!isLogin) {
                       setSignupErrors((prev) => ({ ...prev, password: undefined }));
                     }
                   }}
                   disabled={isLoading}
                   required
                   className="pr-10"
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword((prev) => !prev)}
                   className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                   aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                 >
                   {showPassword ? (
                     <EyeOff className="h-4 w-4" />
                   ) : (
                     <Eye className="h-4 w-4" />
                   )}
                 </button>
               </div>
               {!isLogin && signupErrors.password && (
                 <p className="text-sm text-destructive">{signupErrors.password}</p>
               )}
             </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setIdentifier("");
                setEmail("");
                setUsername("");
                setPassword("");
              }}
              className="text-primary hover:underline"
              disabled={isLoading}
            >
              {isLogin
                ? "Não tem uma conta? Cadastre-se"
                : "Já tem uma conta? Faça login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
