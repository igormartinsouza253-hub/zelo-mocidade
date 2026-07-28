import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineReadOnly } from "@/offline/connectivity";
import {
  clearOfflineData,
  getCachedOfflineUser,
  getOfflineIdentity,
  setCachedOfflineUser,
} from "@/offline/offlineDb";
import { subscribeConnectivity } from "@/offline/connectivity";

function cacheAuthenticatedUser(user: User) {
  setCachedOfflineUser({
    id: user.id,
    email: user.email,
    aud: user.aud,
    created_at: user.created_at,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
  });
}

function cachedUserForOffline() {
  if (!isOfflineReadOnly()) return null;
  const cached = getCachedOfflineUser();
  return cached?.id === getOfflineIdentity() ? cached as User : null;
}

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
      if (session?.user) {
        cacheAuthenticatedUser(session.user);
        setUser(session.user);
      } else {
        setUser(cachedUserForOffline());
      }
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
        if (session?.user) {
          cacheAuthenticatedUser(session.user);
          setUser(session.user);
        } else {
          setUser(cachedUserForOffline());
        }
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

  useEffect(() => subscribeConnectivity((status) => {
    if (status !== "online") {
      const cached = cachedUserForOffline();
      if (cached) {
        setSession(null);
        setUser(cached);
        setLoading(false);
      }
      return;
    }
    void (async () => {
      const current = await supabase.auth.getSession();
      let nextSession = current.data.session;
      if (nextSession?.expires_at && nextSession.expires_at * 1000 <= Date.now()) {
        const refreshed = await supabase.auth.refreshSession();
        nextSession = refreshed.data.session;
      }
      setSession(nextSession);
      if (nextSession?.user) {
        cacheAuthenticatedUser(nextSession.user);
        setUser(nextSession.user);
      } else {
        setUser(null);
      }
    })().catch((error) => {
      console.warn("Não foi possível revalidar a sessão ao voltar para o modo online:", error);
      setSession(null);
      setUser(null);
    });
  }), []);

  // Garantir que usuários vindos de OAuth (ex.: Google) tenham profile para o app.
  useEffect(() => {
    if (!user || !session?.access_token) return;

    let cancelled = false;

    const ensureProfile = async () => {
      if (isOfflineReadOnly()) return;
      try {
        // Garantir que o usuário tenha o role base 'user' (necessário para listar grupos).
        // Isso não concede privilégios elevados; apenas cria o role se estiver faltando.
        try {
          const { error: roleErr } = await supabase.functions.invoke("manage-user-access", {
            body: { action: "bootstrap_user" },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (roleErr && !roleErr.message.includes("401")) {
            console.warn("Não foi possível preparar o acesso base agora. O app continuará tentando pelos fluxos principais.", roleErr);
          }
        } catch (err) {
          console.warn("Não foi possível chamar bootstrap_user agora. O app continuará tentando pelos fluxos principais.", err);
        }

        const { data: existing, error: readError } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("id", user.id)
          .maybeSingle();

        if (readError) throw readError;
        if (cancelled) return;

        const email = user.email ?? null;
        const meta = user.user_metadata as Record<string, unknown>;
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
        console.warn("Não foi possível sincronizar o perfil do usuário agora:", err);
      }
    };

    void ensureProfile();

    return () => {
      cancelled = true;
    };
  }, [user, session?.access_token]);

  const signOut = async () => {
    const currentUserId = user?.id ?? null;
    await supabase.auth.signOut({ scope: isOfflineReadOnly() ? "local" : "global" });
    await clearOfflineData(currentUserId);
  };

  return {
    user,
    session,
    loading,
    signOut,
  };
};
