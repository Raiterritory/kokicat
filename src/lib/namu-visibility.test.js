import { expect, test } from "bun:test";

async function call(name, args) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing backend test configuration");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { ok: response.ok, data: await response.json() };
}

async function visible(nickname, created, self = false) {
  const result = await call("namu_visible_to_viewer", {
    viewer_nickname: nickname, viewer_created_at: created, is_self: self,
  });
  expect(result.ok).toBe(true);
  return result.data;
}

test("a newly joined player sees Namu", async () => {
  expect(await visible("nuevo", "2026-10-18T18:33:07Z")).toBe(true);
});
test("an existing player cannot see Namu", async () => {
  expect(await visible("anterior", "2026-10-18T18:33:05Z")).toBe(false);
});
test("the cutoff itself is not a newly joined account", async () => {
  expect(await visible("limite", "2026-10-18T18:33:06Z")).toBe(false);
});
for (const nickname of ["Raiterritory", "mimi", "naomi", "nanairo", "naomis"]) {
  test(`${nickname} remains excluded even on a future account`, async () => {
    expect(await visible(nickname.toUpperCase(), "2026-10-19T00:00:00Z")).toBe(false);
  });
}
test("Namu retains self visibility", async () => {
  expect(await visible("namu", "2026-10-15T00:00:00Z", true)).toBe(true);
});
test("anonymous viewers cannot see Namu in global rankings", async () => {
  const result = await call("global_leaderboard_for_player", { p_mode: "normal", p_limit: 100 });
  expect(result.ok).toBe(true);
  expect(result.data.some((row) => row.nickname.toLowerCase() === "namu")).toBe(false);
});
test("a forged viewer identity is rejected", async () => {
  const result = await call("global_leaderboard_for_player", {
    p_mode: "normal", p_id: "00000000-0000-0000-0000-000000000001",
    p_secret: "00000000-0000-0000-0000-000000000002",
  });
  expect(result.ok).toBe(false);
  expect(result.data.message).toContain("invalid_player");
});