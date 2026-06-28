import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { adminResources, lookupResources } from "./types";
import {
  DrizzleAdminRepository,
  joinedResourceDefinitions,
  lookupDefinitions,
  relatedLoaders,
  resourceTables,
  simpleResourceDefinitions,
} from "./repository";

describe("admin repository definitions", () => {
  test("separates persistence tables from read models", () => {
    const readResources = adminResources.filter((resource) => resource !== "article-mentions");
    expect(Object.keys(resourceTables).sort()).toEqual([...readResources].sort());

    const simpleResources = Object.keys(simpleResourceDefinitions);
    const joinedResources = Object.keys(joinedResourceDefinitions);

    expect(simpleResources.filter((resource) => joinedResources.includes(resource))).toEqual([]);
    expect([...simpleResources, ...joinedResources].sort()).toEqual([...readResources].sort());

    for (const definition of [
      ...Object.values(simpleResourceDefinitions),
      ...Object.values(joinedResourceDefinitions),
    ]) {
      expect(definition.select["id"]).toBeTruthy();
      expect(definition.searchColumns.length).toBeGreaterThan(0);
      expect(definition.sortColumns["id"]).toBeTruthy();
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
    expect(joinedResourceDefinitions.works.select["projectName"]).toBeTruthy();
    expect(joinedResourceDefinitions.events.select["projectName"]).toBeTruthy();
    expect(joinedResourceDefinitions.events.select["venueName"]).toBeTruthy();
    expect(joinedResourceDefinitions.contributions.select["personName"]).toBeTruthy();
    expect(joinedResourceDefinitions.contributions.select["roleName"]).toBeTruthy();
    expect(joinedResourceDefinitions.articles.select["publicationName"]).toBeTruthy();
  });

  test("defines dedicated loaders only for resources with related detail data", () => {
    expect(Object.keys(relatedLoaders).sort()).toEqual(
      ["articles", "compositions", "events", "people", "projects", "works"].sort(),
    );
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
