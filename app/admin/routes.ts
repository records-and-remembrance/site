import { Hono } from "hono";
import { ZodError } from "zod";
import {
  adminResources,
  lookupResources,
  type AdminRepository,
  type AdminResource,
  type LookupResource,
} from "./types";
import { listQuerySchema, resourceSchemas } from "./validation";

interface AdminRouteOptions {
  uuid?: () => string;
}

interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
}

export function createAdminRoutes(
  repository: AdminRepository,
  options: AdminRouteOptions = {},
): Hono {
  const app = new Hono();
  const generateUuid = options.uuid ?? crypto.randomUUID;

  app.get("/lookups/:resource", async (c) => {
    const resource = parseLookupResource(c.req.param("resource"));
    const search = c.req.query("search")?.trim() ?? "";
    return c.json({ data: await repository.lookup(resource, search) });
  });

  app.get("/:resource", async (c) => {
    const resource = parseAdminResource(c.req.param("resource"));
    const query = listQuerySchema.parse(c.req.query());
    const result = await repository.list(resource, query);
    return c.json({
      data: result.items,
      meta: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  });

  app.get("/:resource/:id", async (c) => {
    const resource = parseAdminResource(c.req.param("resource"));
    const id = parseUuid(c.req.param("id"));
    const result = await repository.detail(resource, id);
    if (!result) {
      return c.json(
        { error: { code: "NOT_FOUND", message: `${resource} record was not found` } },
        404,
      );
    }
    return c.json({ data: result });
  });

  app.post("/:resource", async (c) => {
    const resource = parseAdminResource(c.req.param("resource"));
    const payload = parsePayload(resource, await readJson(c.req.raw));
    const result = await repository.create(resource, { id: generateUuid(), ...payload });
    return c.json({ data: result }, 201);
  });

  app.put("/:resource/:id", async (c) => {
    const resource = parseAdminResource(c.req.param("resource"));
    const id = parseUuid(c.req.param("id"));
    const payload = parsePayload(resource, await readJson(c.req.raw));
    const result = await repository.update(resource, id, payload);
    if (!result) {
      return c.json(
        { error: { code: "NOT_FOUND", message: `${resource} record was not found` } },
        404,
      );
    }
    return c.json({ data: result });
  });

  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Admin API route was not found" } }, 404),
  );

  app.onError((error, c) => {
    if (error instanceof ZodError) {
      const fields: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "request";
        (fields[key] ??= []).push(issue.message);
      }
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            fields,
          },
        },
        400,
      );
    }

    const databaseError = error as DatabaseError;
    const mapped = mapDatabaseError(databaseError);
    if (mapped) {
      return c.json(
        {
          error: {
            code: mapped.code,
            message: mapped.message,
            ...(databaseError.constraint ? { constraint: databaseError.constraint } : {}),
          },
        },
        mapped.status,
      );
    }

    console.error(error);
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      500,
    );
  });

  return app;
}

function parsePayload(resource: AdminResource, input: unknown): Record<string, unknown> {
  return resourceSchemas[resource].parse(input) as Record<string, unknown>;
}

function parseAdminResource(value: string): AdminResource {
  if ((adminResources as readonly string[]).includes(value)) {
    return value as AdminResource;
  }
  throw new ZodError([
    {
      code: "custom",
      path: ["resource"],
      message: `Unsupported resource: ${value}`,
    },
  ]);
}

function parseLookupResource(value: string): LookupResource {
  if ((lookupResources as readonly string[]).includes(value)) {
    return value as LookupResource;
  }
  throw new ZodError([
    {
      code: "custom",
      path: ["resource"],
      message: `Unsupported lookup resource: ${value}`,
    },
  ]);
}

function parseUuid(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  throw new ZodError([
    { code: "custom", path: ["id"], message: "Invalid UUID" },
  ]);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([
      { code: "custom", path: ["body"], message: "Body must be valid JSON" },
    ]);
  }
}

function mapDatabaseError(error: DatabaseError) {
  switch (error.code) {
    case "23505":
      return {
        code: "CONFLICT",
        message: "A record with the same unique values already exists",
        status: 409 as const,
      };
    case "23503":
      return {
        code: "INVALID_REFERENCE",
        message: "A selected related record does not exist",
        status: 400 as const,
      };
    case "23514":
    case "23P01":
      return {
        code: "CONSTRAINT_VIOLATION",
        message: "The values violate a database constraint",
        status: 400 as const,
      };
    default:
      return null;
  }
}
