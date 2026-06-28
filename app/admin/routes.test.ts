import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createAdminRoutes } from "./routes";
import type {
  AdminListQuery,
  AdminRepository,
  AdminResource,
  LookupResource,
} from "./types";

const generatedId = "00000000-0000-4000-8000-000000000001";

class FakeRepository implements AdminRepository {
  calls: Array<{ method: string; resource: string; value?: unknown }> = [];

  async list(resource: AdminResource, query: AdminListQuery) {
    this.calls.push({ method: "list", resource, value: query });
    return { items: [{ id: generatedId, name: "門田匡陽" }], total: 1 };
  }

  async detail(resource: AdminResource, id: string) {
    this.calls.push({ method: "detail", resource, value: id });
    return { id, name: "門田匡陽", related: {} };
  }

  async create(resource: AdminResource, value: Record<string, unknown>) {
    this.calls.push({ method: "create", resource, value });
    return value;
  }

  async update(resource: AdminResource, id: string, value: Record<string, unknown>) {
    this.calls.push({ method: "update", resource, value: { id, ...value } });
    return { id, ...value };
  }

  async lookup(resource: LookupResource, search: string) {
    this.calls.push({ method: "lookup", resource, value: search });
    return [{ id: generatedId, label: "BURGER NUDS" }];
  }
}

function testApp(repository: AdminRepository) {
  const app = new Hono();
  app.route(
    "/api/admin",
    createAdminRoutes(repository, {
      uuid: () => generatedId,
    }),
  );
  return app;
}

describe("admin API", () => {
  test("passes normalized list state to the repository", async () => {
    const repository = new FakeRepository();
    const response = await testApp(repository).request(
      "/api/admin/people?search=%E9%96%80%E7%94%B0&page=2&pageSize=25&sort=name&direction=desc",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: generatedId, name: "門田匡陽" }],
      meta: { page: 2, pageSize: 25, total: 1 },
    });
    expect(repository.calls[0]).toEqual({
      method: "list",
      resource: "people",
      value: {
        search: "門田",
        page: 2,
        pageSize: 25,
        sort: "name",
        direction: "desc",
      },
    });
  });

  test("rejects invalid pagination with the shared validation error shape", async () => {
    const response = await testApp(new FakeRepository()).request(
      "/api/admin/projects?page=0&pageSize=500",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fields: expect.any(Object),
      },
    });
  });

  test("generates UUIDs on create and rejects client supplied IDs", async () => {
    const repository = new FakeRepository();
    const app = testApp(repository);

    const created = await app.request("/api/admin/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "新規人物", birthDate: "2000-01-02" }),
    });
    expect(created.status).toBe(201);
    expect(repository.calls[0]?.value).toMatchObject({
      id: generatedId,
      name: "新規人物",
      birthDate: "2000-01-02",
    });

    const rejected = await app.request("/api/admin/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: crypto.randomUUID(), name: "不正" }),
    });
    expect(rejected.status).toBe(400);
  });

  test("validates required foreign keys and date formats", async () => {
    const response = await testApp(new FakeRepository()).request("/api/admin/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "raw-project-name",
        venueId: generatedId,
        type: "live",
        eventDate: "2025/01/01",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: {
          projectId: expect.any(Array),
          eventDate: expect.any(Array),
        },
      },
    });
  });

  test("exposes all domain and lookup resource groups", async () => {
    const repository = new FakeRepository();
    const app = testApp(repository);
    const domains = [
      "people",
      "projects",
      "works",
      "events",
      "compositions",
      "articles",
      "contributions",
      "memberships",
      "releases",
      "recordings",
      "tracks",
      "event-performances",
      "article-mentions",
    ];
    const lookups = [
      "project",
      "person",
      "composition",
      "work",
      "release",
      "event",
      "venue",
      "role",
      "instrument",
      "label",
      "distributor",
      "publication",
    ];

    for (const resource of domains) {
      expect((await app.request(`/api/admin/${resource}`)).status).toBe(200);
    }
    for (const resource of lookups) {
      expect((await app.request(`/api/admin/lookups/${resource}?search=a`)).status).toBe(200);
    }
  });

  test("maps unique, foreign key and check constraint failures", async () => {
    const cases = [
      ["23505", "CONFLICT", 409],
      ["23503", "INVALID_REFERENCE", 400],
      ["23514", "CONSTRAINT_VIOLATION", 400],
    ] as const;

    for (const [databaseCode, apiCode, status] of cases) {
      const repository = new FakeRepository();
      repository.create = async () => {
        throw Object.assign(new Error("database rejected value"), {
          code: databaseCode,
          constraint: "example_constraint",
        });
      };
      const response = await testApp(repository).request("/api/admin/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "重複", type: "band" }),
      });

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({
        error: {
          code: apiCode,
          constraint: "example_constraint",
        },
      });
    }
  });
});
