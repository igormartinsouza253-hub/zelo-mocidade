import { deleteOfflineMutation, listOfflineMutations, markOfflineMutationStepDone, readOfflineIdentityFromDb } from "@/offline/offlineDb";

type SyncRow = { id: string; table: string; rows: Record<string, unknown>[] };

async function sendStep(step: SyncRow, token: string) {
  if (!step.rows.length) return;
  const url = new URL(`/rest/v1/${step.table}`, self.location.origin);
  url.searchParams.set("on_conflict", "id");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(step.rows),
  });
  if (!response.ok) throw new Error(`Falha ao sincronizar ${step.table}: ${response.status}`);
}

export async function flushInBackground() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const storageKey = "supabase.auth.token";
  const localAuth = localStorage.getItem(storageKey);
  const auth = localAuth ? JSON.parse(localAuth) as { access_token?: string } : null;
  if (!auth?.access_token) throw new Error("Sessão indisponível para sincronizar no background.");

  const userId = await readOfflineIdentityFromDb();
  if (!userId) throw new Error("Conta indisponível para sincronizar no background.");
  const records = await listOfflineMutations(userId);
  for (const mutation of records) {
    for (const [index, rawStep] of mutation.steps.entries()) {
      const stepKey = `${rawStep.table}:${index}`;
      if (mutation.completedSteps?.includes(stepKey)) continue;
      await sendStep({ id: mutation.key, ...rawStep }, auth.access_token);
      await markOfflineMutationStepDone(mutation.key, stepKey);
    }
    await deleteOfflineMutation(mutation.key);
  }
}
