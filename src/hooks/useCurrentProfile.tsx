import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CurrentProfile {
  username: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function useCurrentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, email, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        setProfile({
          username:
            data?.username ||
            (user.user_metadata as any)?.username ||
            user.email?.split("@")[0] ||
            null,
          email: data?.email ?? user.email ?? null,
          avatar_url: (data as any)?.avatar_url ?? null,
        });
      } catch (err) {
        console.error("Erro ao carregar perfil atual:", err);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  return { profile, loading };
}
