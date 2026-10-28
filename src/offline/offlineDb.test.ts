import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearOfflineData,
  deleteOfflineDraft,
  deleteOfflineMutation,
  enqueueOfflineMutation,
  listOfflineMutations,
  readOfflineDraft,
  saveOfflineDraft,
} from "@/offline/offlineDb";

describe("offline form persistence", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("zelo-offline");
  });

  it("keeps the latest form draft across reads and removes it after publishing", async () => {
    await saveOfflineDraft("user-1", "group-1", "meeting", { tema: "Primeiro" });
    await saveOfflineDraft("user-1", "group-1", "meeting", { tema: "Atualizado" });

    expect(await readOfflineDraft("user-1", "group-1", "meeting")).toMatchObject({
      value: { tema: "Atualizado" },
      userId: "user-1",
    });

    await deleteOfflineDraft("user-1", "group-1", "meeting");
    expect(await readOfflineDraft("user-1", "group-1", "meeting")).toBeNull();
  });

  it("stores queued writes by account and removes them after successful synchronization", async () => {
    const mutation = {
      key: "user-1:meeting-1",
      userId: "user-1",
      groupId: "group-1",
      createdAt: new Date().toISOString(),
      steps: [{ table: "reunioes", rows: [{ id: "meeting-1" }] }],
    };
    await enqueueOfflineMutation(mutation);

    expect(await listOfflineMutations("user-1")).toEqual([mutation]);
    expect(await listOfflineMutations("user-2")).toEqual([]);

    await deleteOfflineMutation(mutation.key);
    expect(await listOfflineMutations("user-1")).toEqual([]);
  });
});
