import { supabase } from "@/integrations/supabase/client";
import { deleteOfflineMutation, listOfflineMutations, markOfflineMutationStepDone } from "@/offline/offlineDb";

export async function synchronizeOfflineMutations(userId: string) {
  const mutations = await listOfflineMutations(userId);
  for (const mutation of mutations) {
    if (navigator.onLine === false) return;
    for (const step of mutation.steps) {
      if (!step.rows.length) continue;
      const stepKey = `${step.table}:${mutation.steps.indexOf(step)}`;
      if (mutation.completedSteps?.includes(stepKey)) continue;
      const { error } = await supabase.from(step.table as never).upsert(step.rows as never, { onConflict: "id" });
      if (error) throw error;
      await markOfflineMutationStepDone(mutation.key, stepKey);
    }
    await deleteOfflineMutation(mutation.key);
  }
}
