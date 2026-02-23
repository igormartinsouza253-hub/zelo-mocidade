import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function toUsernameCandidate(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 50);

  return normalized.length >= 3 ? normalized : null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // THEN check for existing session (guard against promise rejection)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        console.error("Erro ao obter sessão:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // Safety fallback: never keep the app stuck loading indefinitely
    const fallback = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    return () => {
      mounted = false;
      window.clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  // Garantir que usuários vindos de OAuth (ex.: Google) tenham profile para o app.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const ensureProfile = async () => {
      try {
        // Garantir que o usuário tenha o role base 'user' (necessário para listar grupos).
        // Isso não concede privilégios elevados; apenas cria o role se estiver faltando.
        try {
          const { error: roleErr } = await supabase.functions.invoke("manage-user-access", {
            body: { action: "bootstrap_user" },
          });
          if (roleErr) {
            console.error("Erro ao bootstrap_user:", roleErr);
          }
        } catch (err) {
          console.error("Erro ao chamar bootstrap_user:", err);
        }

        const { data: existing, error: readError } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("id", user.id)
          .maybeSingle();

        if (readError) throw readError;
        if (cancelled) return;

        const email = user.email ?? null;
        const meta: any = user.user_metadata ?? {};
        const avatarUrl: string | null =
          typeof meta.avatar_url === "string" ? meta.avatar_url : null;

        // Só definimos username automaticamente se o profile não existir.
        if (!existing) {
          const rawName =
            (typeof meta.full_name === "string" ? meta.full_name : null) ??
            (typeof meta.name === "string" ? meta.name : null) ??
            (typeof meta.preferred_username === "string"
              ? meta.preferred_username
              : null) ??
            (email ? email.split("@")[0] : null) ??
            "usuario";

          const username =
            toUsernameCandidate(rawName) ??
            (email ? toUsernameCandidate(email.split("@")[0]) : null) ??
            `user_${user.id.slice(0, 8)}`;

          const { error: insertError } = await supabase.from("profiles").insert({
            id: user.id,
            username,
            email,
            avatar_url: avatarUrl,
          });

          if (insertError) throw insertError;
          return;
        }

        // Profile existe: mantemos username e apenas atualizamos email/avatar.
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            email,
            avatar_url: avatarUrl,
          })
          .eq("id", user.id);

        if (updateError) throw updateError;
      } catch (err) {
        // Não bloqueia a navegação do app, mas ajuda no diagnóstico.
        console.error("Erro ao garantir profile do usuário:", err);
      }
    };

    void ensureProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signOut,
  };
};
