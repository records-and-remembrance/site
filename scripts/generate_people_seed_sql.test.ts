import { describe, expect, test } from "bun:test";
import { renderSql, type MembershipSeed } from "./generate_people_seed_sql";

describe("renderSql", () => {
  test("membershipのsupport区分を専用列へ出力する", () => {
    const membership: MembershipSeed = {
      personName: "サポート奏者",
      projectName: "テストバンド",
      fromDate: "2025-01-01",
      toDate: null,
      fromPrecision: "day",
      toPrecision: null,
      support: true,
      note: "source_file=test.md",
      instruments: [],
    };

    const sql = renderSql(new Map(), [membership], []);

    expect(sql).toContain(
      "INSERT INTO membership (id, person_id, project_id, from_date, to_date, from_date_precision, to_date_precision, support, note)",
    );
    expect(sql).toContain(", TRUE, 'source_file=test.md')");
    expect(sql).toContain("support = EXCLUDED.support");
    expect(sql).not.toContain("support; source_file=test.md");
  });
});
