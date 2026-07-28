import { rawSupabase } from "@/integrations/supabase/client";
import { saveSnapshot, type OfflineSnapshotPayload } from "@/offline/offlineDb";

const MEDIA_CACHE = "zelo-offline-media-v1";

async function fetchRows(
  table: string,
  filters: (query: any) => any,
  optional = false,
) {
  try {
    const query = filters((rawSupabase as any).from(table).select("*"));
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (optional) {
      console.warn(`[offline] A tabela opcional ${table} não pôde ser incluída no snapshot.`, error);
      return [];
    }
    throw error;
  }
}

async function buildSnapshotFromTables(userId: string, groupId: string): Promise<OfflineSnapshotPayload> {
  const byGroup = (query: any) => query.eq("group_id", groupId);
  const [
    managementGroups,
    groupMembers,
    membros,
    memberEditHistory,
    cargos,
    reunioes,
    presencas,
    visitas,
    eventos,
    notas,
    noteComments,
    noteVersions,
    groupUserPresence,
    groupJoinRequests,
    notifications,
    notificationPreferences,
    userPreferences,
  ] = await Promise.all([
    fetchRows("management_groups", (query) => query.eq("id", groupId)),
    fetchRows("group_members", byGroup),
    fetchRows("membros", byGroup),
    fetchRows("member_edit_history", byGroup, true),
    fetchRows("cargos", byGroup),
    fetchRows("reunioes", byGroup),
    fetchRows("presencas", byGroup),
    fetchRows("visitas", byGroup),
    fetchRows("eventos", byGroup),
    fetchRows("notas", byGroup),
    fetchRows("note_comments", byGroup, true),
    fetchRows("note_versions", byGroup, true),
    fetchRows("group_user_presence", byGroup, true),
    fetchRows("group_join_requests", byGroup, true),
    fetchRows("notifications", (query) => query.eq("user_id", userId).or(`group_id.eq.${groupId},group_id.is.null`), true),
    fetchRows("notification_preferences", (query) => query.eq("user_id", userId), true),
    fetchRows("user_preferences", (query) => query.eq("user_id", userId), true),
  ]);

  const relatedProfileIds = new Set<string>([userId]);
  groupMembers.forEach((row) => row.user_id && relatedProfileIds.add(row.user_id));
  notas.forEach((row) => {
    if (row.user_id) relatedProfileIds.add(row.user_id);
    if (row.updated_by) relatedProfileIds.add(row.updated_by);
  });
  reunioes.forEach((row) => row.created_by_user_id && relatedProfileIds.add(row.created_by_user_id));
  membros.forEach((row) => row.created_by_user_id && relatedProfileIds.add(row.created_by_user_id));
  const profiles = await fetchRows(
    "profiles",
    (query) => query.in("id", [...relatedProfileIds]),
    true,
  );

  return {
    schema_version: 1,
    synchronized_at: new Date().toISOString(),
    group_id: groupId,
    tables: {
      management_groups: managementGroups,
      group_members: groupMembers,
      profiles,
      membros,
      member_edit_history: memberEditHistory,
      cargos,
      reunioes,
      presencas,
      visitas,
      eventos,
      notas,
      note_comments: noteComments,
      note_versions: noteVersions,
      group_user_presence: groupUserPresence,
      group_join_requests: groupJoinRequests,
      notifications,
      notification_preferences: notificationPreferences,
      user_preferences: userPreferences,
    },
  };
}

function collectMediaUrls(payload: OfflineSnapshotPayload) {
  const urls = new Set<string>();
  Object.values(payload.tables ?? {}).forEach((rows) => {
    (rows ?? []).forEach((rawRow) => {
      if (!rawRow || typeof rawRow !== "object") return;
      const row = rawRow as Record<string, unknown>;
      ["foto_url", "avatar_url"].forEach((field) => {
        const value = row[field];
        if (typeof value === "string" && /^https?:\/\//.test(value)) urls.add(value);
      });
    });
  });
  return [...urls];
}

async function cacheMedia(payload: OfflineSnapshotPayload) {
  if (!("caches" in window)) return;
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.allSettled(
    collectMediaUrls(payload).map(async (url) => {
      if (await cache.match(url)) return;
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (response.ok) await cache.put(url, response);
    }),
  );
}

export async function synchronizeGroupSnapshot(userId: string, groupId: string) {
  const { data, error } = await (rawSupabase.rpc as any)("get_offline_group_snapshot", {
    _group_id: groupId,
  });
  const payload = !error && data && typeof data === "object"
    ? data as OfflineSnapshotPayload
    : await buildSnapshotFromTables(userId, groupId);
  const groupRows = payload.tables?.management_groups;
  if (Array.isArray(groupRows)) {
    await Promise.all(groupRows.map(async (rawRow) => {
      if (!rawRow || typeof rawRow !== "object") return;
      const row = rawRow as Record<string, unknown>;
      if (typeof row.photo_url !== "string" || !row.photo_url) return;
      const { data: signed } = await rawSupabase.storage
        .from("group-photos")
        .createSignedUrl(row.photo_url, 60 * 60 * 24 * 30);
      if (signed?.signedUrl) row.offline_photo_url = signed.signedUrl;
    }));
  }
  await saveSnapshot(userId, groupId, payload);
  await cacheMedia(payload);
  return payload.synchronized_at ?? new Date().toISOString();
}
