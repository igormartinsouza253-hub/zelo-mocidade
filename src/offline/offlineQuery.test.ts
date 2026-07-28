import { beforeEach, describe, expect, it, vi } from "vitest";

const { readTable } = vi.hoisted(() => ({
  readTable: vi.fn(),
}));

vi.mock("@/offline/offlineDb", () => ({
  getOfflineIdentity: () => "user-1",
  readTable,
}));

import { OfflineQueryBuilder } from "@/offline/offlineQuery";

describe("OfflineQueryBuilder", () => {
  beforeEach(() => {
    readTable.mockResolvedValue([
      { id: "1", group_id: "group-1", nome: "Ana", ativo: true, tags: ["liderança"] },
      { id: "2", group_id: "group-1", nome: "Bruno", ativo: false, tags: [] },
      { id: "3", group_id: "group-1", nome: "Carla", ativo: true, tags: ["música"] },
    ]);
  });

  it("filtra, ordena, limita e projeta dados locais", async () => {
    const result = await new OfflineQueryBuilder("membros")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", { ascending: false })
      .limit(1);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: "3", nome: "Carla" }]);
  });

  it("suporta busca ilike e alternativas usadas pela busca global", async () => {
    const result = await new OfflineQueryBuilder("membros")
      .select("*")
      .or("nome.ilike.%bru%,nome.ilike.%car%");

    expect(result.data.map((row: { id: string }) => row.id)).toEqual(["2", "3"]);
  });

  it("retorna um registro singular", async () => {
    const result = await new OfflineQueryBuilder("membros")
      .select("id, nome")
      .eq("id", "1")
      .single();

    expect(result).toMatchObject({ data: { id: "1", nome: "Ana" }, error: null });
  });

  it("bloqueia qualquer mutação offline", async () => {
    const result = await new OfflineQueryBuilder("membros")
      .update({ nome: "Outro nome" } as never)
      .eq("id", "1");

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("Alterações não são permitidas");
  });
});
