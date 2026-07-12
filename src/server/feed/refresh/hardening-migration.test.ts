import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260712002724_harden_feed_refresh.sql",
);

describe("feed refresh hardening migration", () => {
  it("deterministically reconciles extra running rows before adding the unique index", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
    const reconciliation = sql.indexOf("row_number() over");
    const uniqueIndex = sql.indexOf(
      "create unique index if not exists capcheck_refresh_runs_one_running_idx",
    );

    expect(reconciliation).toBeGreaterThan(-1);
    expect(sql).toContain("order by started_at desc, id desc");
    expect(sql).toContain("status = 'failed'");
    expect(reconciliation).toBeLessThan(uniqueIndex);
  });
});
