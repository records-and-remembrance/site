import { describe, expect, test } from "bun:test";
import { adminResources, lookupResources } from "./types";
import { lookupDefinitions, resourceDefinitions } from "./repository";

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
});
