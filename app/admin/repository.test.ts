import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { adminResources, lookupResources } from "./types";
import {
  DrizzleAdminRepository,
  lookupDefinitions,
  resourceDefinitions,
} from "./repository";

describe("admin repository definitions", () => {
  test("defines every route resource with safe list columns", () => {
    expect(Object.keys(resourceDefinitions).sort()).toEqual([...adminResources].sort());

    for (const resource of adminResources) {
      const definition = resourceDefinitions[resource];
      expect(definition.table).toBeTruthy();
      expect(definition.select.id).toBeTruthy();
      expect(definition.searchColumns.length).toBeGreaterThan(0);
      expect(definition.sortColumns.id).toBeTruthy();
      expect(definition.defaultSort).toBeTruthy();
      expect(definition.sortColumns[definition.defaultSort]).toBeTruthy();
    }
  });

  test("defines every lookup with a human-readable label expression", () => {
    expect(Object.keys(lookupDefinitions).sort()).toEqual([...lookupResources].sort());

    for (const resource of lookupResources) {
      const definition = lookupDefinitions[resource];
      expect(definition.table).toBeTruthy();
      expect(definition.id).toBeTruthy();
      expect(definition.label).toBeTruthy();
      expect(definition.searchColumns.length).toBeGreaterThan(0);
    }
  });

  test("main list definitions expose resolved relationship labels", () => {
    expect(resourceDefinitions.works.select.projectName).toBeTruthy();
    expect(resourceDefinitions.events.select.projectName).toBeTruthy();
    expect(resourceDefinitions.events.select.venueName).toBeTruthy();
    expect(resourceDefinitions.contributions.select.personName).toBeTruthy();
    expect(resourceDefinitions.contributions.select.roleName).toBeTruthy();
    expect(resourceDefinitions.articles.select.publicationName).toBeTruthy();
  });

  test("builds an empty search clause without binding a function parameter", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const dialect = new PgDialect();
    const database = {
      async execute(statement: Parameters<PgDialect["sqlToQuery"]>[0]) {
        const query = dialect.sqlToQuery(statement);
        queries.push(query);
        return { rows: query.sql.includes("count(*)") ? [{ total: 0 }] : [] };
      },
    };
    const repository = new DrizzleAdminRepository(database as never);

    await repository.list("people", {
      search: "",
      page: 1,
      pageSize: 20,
      direction: "asc",
    });

    expect(queries).toHaveLength(2);
    expect(queries.flatMap((query) => query.params)).not.toContainEqual(expect.any(Function));
    expect(queries[0]?.sql).not.toContain("$1 order by");
  });
});
