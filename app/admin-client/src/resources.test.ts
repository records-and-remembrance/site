import { describe, expect, test } from "bun:test";
import {
  editorConfigs,
  mainResourceOrder,
  resourceConfigs,
  selectRelationRows,
} from "./resources";

describe("admin screen configuration", () => {
  test("defines every main domain screen", () => {
    expect(mainResourceOrder).toEqual([
      "people",
      "projects",
      "works",
      "compositions",
      "events",
      "articles",
      "contributions",
    ]);

    for (const resource of mainResourceOrder) {
      const config = resourceConfigs[resource];
      expect(config.title).toBeTruthy();
      expect(config.columns.length).toBeGreaterThan(1);
      expect(config.fields.length).toBeGreaterThan(0);
      expect(config.defaultSort).toBeTruthy();
    }
  });

  test("uses human-readable foreign key selectors", () => {
    for (const resource of mainResourceOrder) {
      for (const field of resourceConfigs[resource].fields) {
        if (field.key.endsWith("Id") && field.key !== "id") {
          expect(["combobox", "target"]).toContain(field.type);
        }
      }
    }
  });

  test("keeps first-milestone relations inside parent details", () => {
    expect(resourceConfigs.people.relations?.map((relation) => relation.resource)).toContain(
      "memberships",
    );
    expect(resourceConfigs.projects.relations?.map((relation) => relation.resource)).toEqual(
      expect.arrayContaining(["memberships", "works", "events"]),
    );
    expect(resourceConfigs.works.relations?.map((relation) => relation.resource)).toContain(
      "releases",
    );
    expect(
      resourceConfigs.works.relations?.find((relation) => relation.resource === "releases")
        ?.nestedAction?.resource,
    ).toBe("label-relations");
    expect(
      resourceConfigs.works.relations?.find((relation) => relation.resource === "releases")
        ?.nestedAction?.itemsKey,
    ).toBe("labels");
    expect(
      resourceConfigs.people.relations?.find((relation) => relation.resource === "memberships")
        ?.nestedAction?.itemsKey,
    ).toBe("roles");
    expect(resourceConfigs.events.relations?.map((relation) => relation.resource)).toContain(
      "event-performances",
    );
  });

  test("defines remaining screen detail relationships", () => {
    expect(resourceConfigs.compositions.relations?.map((relation) => relation.resource)).toContain(
      "recordings",
    );
    expect(resourceConfigs.articles.relations?.map((relation) => relation.resource)).toContain(
      "article-mentions",
    );
    expect(resourceConfigs.contributions.fields.map((field) => field.type)).toContain("target");
  });

  test("provides human-readable lookups for every target type", () => {
    expect(["work", "event", "person"]).toEqual(
      expect.arrayContaining(["work", "event", "person"]),
    );
  });

  test("allows membership support status to be edited", () => {
    expect(editorConfigs.memberships.fields).toContainEqual({
      key: "support",
      label: "サポート",
      type: "checkbox",
    });
  });

  test("splits project memberships into regular and support sections", () => {
    const membershipRelations = resourceConfigs.projects.relations?.filter(
      (relation) => relation.resource === "memberships",
    );

    expect(membershipRelations).toEqual([
      expect.objectContaining({
        key: "members",
        label: "メンバー",
        filter: { key: "support", value: false },
        defaults: { support: false },
      }),
      expect.objectContaining({
        key: "supportMembers",
        sourceKey: "members",
        label: "サポートメンバー",
        filter: { key: "support", value: true },
        defaults: { support: true },
      }),
    ]);
  });

  test("selects relation rows by source and support status", () => {
    const related = {
      members: [
        { id: "regular", support: false },
        { id: "support", support: true },
      ],
    };
    const supportRelation = resourceConfigs.projects.relations?.find(
      (relation) => relation.key === "supportMembers",
    );

    expect(selectRelationRows(related, supportRelation!)).toEqual([
      { id: "support", support: true },
    ]);
  });
});
