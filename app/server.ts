#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { listDrafts, readDraft, saveDraft, validateSavePayload } from "./lib/compositionDrafts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_DIR = join(ROOT, "app", "public");

const app = new Hono();

app.get("/", async (c) => {
  return c.html(await readPublicFile("index.html"));
});

app.get("/app.js", async (c) => {
  return new Response(await readPublicFile("app.js"), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

app.get("/api/drafts", async (c) => {
  return c.json(await listDrafts());
});

app.get("/api/drafts/:file", async (c) => {
  return c.json(await readDraft(c.req.param("file")));
});

app.put("/api/drafts/:file", async (c) => {
  const payload = validateSavePayload(await c.req.json());
  return c.json(await saveDraft(c.req.param("file"), payload));
});

app.notFound((c) => c.json({ error: "not found" }, 404));

app.onError((error, c) => {
  return c.json({ error: error.message }, 400);
});

async function readPublicFile(fileName: string): Promise<string> {
  return await readFile(join(PUBLIC_DIR, fileName), "utf8");
}

const port = Number(Bun.env.PORT ?? "3000");
Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Composition draft review UI: http://localhost:${port}`);
