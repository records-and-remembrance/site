import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type DraftStatus = "draft" | "reviewed" | "merged" | "split" | "ignore";

export type DraftMeta = {
  file: string;
  canonicalTitle: string;
  status: DraftStatus;
  compositionId: string | null;
  groupKey: string;
  aliases: string[];
  sourceCount: number;
  releaseCount: number;
  liveCount: number;
};

export type DraftDetail = DraftMeta & {
  sourcesYaml: string;
  body: string;
};

export type DraftSavePayload = {
  canonicalTitle: string;
  status: DraftStatus;
  compositionId: string | null;
  aliases: string[];
  body: string;
};

export type DraftMergePayload = {
  targetFile: string;
};

export type DraftMergeResult = {
  source: DraftDetail;
  target: DraftDetail;
};

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DRAFT_DIR = join(ROOT, "drafts", "compositions");
const STATUSES = new Set<DraftStatus>(["draft", "reviewed", "merged", "split", "ignore"]);

function yamlString(value: string | null): string {
  if (value == null || value.trim() === "") return "null";
  return JSON.stringify(value);
}

function parseYamlScalar(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "~" || trimmed === "") return null;
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseFrontMatter(markdown: string): { frontMatter: string; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("missing front matter");
  }

  return {
    frontMatter: match[1],
    body: match[2] ?? "",
  };
}

function extractField(frontMatter: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = frontMatter.match(new RegExp(`^${escaped}:\\s*(.*)$`, "m"));
  return match ? parseYamlScalar(match[1]) : null;
}

function extractBlock(frontMatter: string, key: string): string {
  const lines = frontMatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start < 0) return "";

  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(line)) break;
    block.push(line);
  }

  return block.join("\n").replace(/\s+$/u, "");
}

function extractAliases(frontMatter: string): string[] {
  return extractBlock(frontMatter, "aliases")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*(.+?)\s*$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => parseYamlScalar(value))
    .filter((value): value is string => Boolean(value));
}

function countSources(sourcesYaml: string): { sourceCount: number; releaseCount: number; liveCount: number } {
  const sourceCount = (sourcesYaml.match(/^\s*-\s*$/gm) ?? []).length;
  const releaseCount = (sourcesYaml.match(/^\s*type:\s*release\s*$/gm) ?? []).length;
  const liveCount = (sourcesYaml.match(/^\s*type:\s*live\s*$/gm) ?? []).length;
  return { sourceCount, releaseCount, liveCount };
}

function parseDraft(file: string, markdown: string): DraftDetail {
  const { frontMatter, body } = parseFrontMatter(markdown);
  const status = extractField(frontMatter, "status") ?? "draft";
  if (!STATUSES.has(status as DraftStatus)) {
    throw new Error(`unsupported status in ${file}: ${status}`);
  }

  const sourcesYaml = extractBlock(frontMatter, "sources");
  const counts = countSources(sourcesYaml);

  return {
    file,
    canonicalTitle: extractField(frontMatter, "canonical_title") ?? basename(file, ".md"),
    status: status as DraftStatus,
    compositionId: extractField(frontMatter, "composition_id"),
    groupKey: extractField(frontMatter, "group_key") ?? "",
    aliases: extractAliases(frontMatter),
    sourcesYaml,
    body,
    ...counts,
  };
}

async function listDraftFiles(): Promise<string[]> {
  const entries = await readdir(DRAFT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function readDraft(file: string): Promise<DraftDetail> {
  const safeName = basename(file);
  if (safeName !== file || !safeName.endsWith(".md") || safeName === "README.md") {
    throw new Error("invalid file name");
  }

  const markdown = await readFile(join(DRAFT_DIR, safeName), "utf8");
  return parseDraft(safeName, markdown);
}

export async function listDrafts(): Promise<DraftMeta[]> {
  const files = await listDraftFiles();
  const drafts = await Promise.all(files.map(readDraft));
  return drafts
    .map(({ sourcesYaml, body, ...meta }) => {
      void sourcesYaml;
      void body;
      return meta;
    })
    .sort((a, b) => {
      const titleDiff = a.canonicalTitle.localeCompare(b.canonicalTitle, "ja");
      return titleDiff !== 0 ? titleDiff : a.file.localeCompare(b.file, "ja");
    });
}

export function validateSavePayload(value: unknown): DraftSavePayload {
  if (typeof value !== "object" || value == null) {
    throw new Error("invalid payload");
  }

  const payload = value as Record<string, unknown>;
  const status = payload.status;
  if (typeof payload.canonicalTitle !== "string" || payload.canonicalTitle.trim() === "") {
    throw new Error("canonicalTitle is required");
  }
  if (typeof status !== "string" || !STATUSES.has(status as DraftStatus)) {
    throw new Error("unsupported status");
  }
  if (!Array.isArray(payload.aliases) || payload.aliases.some((alias) => typeof alias !== "string")) {
    throw new Error("aliases must be string[]");
  }
  if (payload.compositionId != null && typeof payload.compositionId !== "string") {
    throw new Error("compositionId must be string or null");
  }
  if (typeof payload.body !== "string") {
    throw new Error("body must be string");
  }

  return {
    canonicalTitle: payload.canonicalTitle.trim(),
    status: status as DraftStatus,
    compositionId: typeof payload.compositionId === "string" ? payload.compositionId.trim() || null : null,
    aliases: [...new Set(payload.aliases.map((alias) => alias.trim()).filter(Boolean))],
    body: payload.body,
  };
}

export function validateMergePayload(value: unknown): DraftMergePayload {
  if (typeof value !== "object" || value == null) {
    throw new Error("invalid payload");
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.targetFile !== "string" || payload.targetFile.trim() === "") {
    throw new Error("targetFile is required");
  }

  return { targetFile: payload.targetFile.trim() };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function sourceEntries(sourcesYaml: string): string[] {
  const entries: string[] = [];
  let current: string[] = [];

  for (const line of sourcesYaml.split(/\r?\n/)) {
    if (/^\s*-\s*$/.test(line)) {
      if (current.length > 0) entries.push(current.join("\n"));
      current = [line];
      continue;
    }
    if (current.length > 0) current.push(line);
  }

  if (current.length > 0) entries.push(current.join("\n"));
  return entries;
}

function mergeSources(...blocks: string[]): string {
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const block of blocks) {
    for (const entry of sourceEntries(block)) {
      const key = entry.replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

  return entries.join("\n");
}

function appendReviewNote(body: string, note: string): string {
  const trimmed = body.trimEnd();
  return `${trimmed}${trimmed ? "\n\n" : ""}${note}\n`;
}

function renderMarkdown(existing: DraftDetail, payload: DraftSavePayload, sourcesYaml = existing.sourcesYaml): string {
  const aliases = payload.aliases.length > 0 ? payload.aliases : [payload.canonicalTitle];
  const lines = [
    "---",
    "# generated_by: scripts/generate_composition_drafts.ts",
    `canonical_title: ${yamlString(payload.canonicalTitle)}`,
    `status: ${payload.status}`,
    `composition_id: ${yamlString(payload.compositionId)}`,
    `group_key: ${yamlString(existing.groupKey)}`,
    "aliases:",
  ];

  for (const alias of aliases) {
    lines.push(`  - ${yamlString(alias)}`);
  }

  lines.push("sources:");
  if (sourcesYaml.trim()) {
    lines.push(sourcesYaml);
  }
  lines.push("---");
  lines.push("");
  lines.push(payload.body.trimEnd());
  lines.push("");
  return lines.join("\n");
}

export async function saveDraft(file: string, payload: DraftSavePayload): Promise<DraftDetail> {
  const existing = await readDraft(file);
  const markdown = renderMarkdown(existing, payload);
  await writeFile(join(DRAFT_DIR, existing.file), markdown, "utf8");
  return parseDraft(existing.file, markdown);
}

export async function mergeDraft(sourceFile: string, payload: DraftMergePayload): Promise<DraftMergeResult> {
  const source = await readDraft(sourceFile);
  const target = await readDraft(payload.targetFile);
  if (source.file === target.file) {
    throw new Error("source and target must be different drafts");
  }
  if (target.status === "merged") {
    throw new Error("target draft is already merged");
  }

  const mergedAt = new Date().toISOString();
  const targetPayload: DraftSavePayload = {
    canonicalTitle: target.canonicalTitle,
    status: target.status,
    compositionId: target.compositionId ?? source.compositionId,
    aliases: uniqueStrings([target.canonicalTitle, ...target.aliases, source.canonicalTitle, ...source.aliases]),
    body: appendReviewNote(target.body, `## Merge Notes\n\n- ${mergedAt}: merged sources from ${source.file}`),
  };
  const targetMarkdown = renderMarkdown(target, targetPayload, mergeSources(target.sourcesYaml, source.sourcesYaml));

  const sourcePayload: DraftSavePayload = {
    canonicalTitle: source.canonicalTitle,
    status: "merged",
    compositionId: targetPayload.compositionId,
    aliases: uniqueStrings([source.canonicalTitle, ...source.aliases]),
    body: appendReviewNote(source.body, `## Merge Notes\n\n- ${mergedAt}: merged into ${target.file}`),
  };
  const sourceMarkdown = renderMarkdown(source, sourcePayload);

  await writeFile(join(DRAFT_DIR, target.file), targetMarkdown, "utf8");
  await writeFile(join(DRAFT_DIR, source.file), sourceMarkdown, "utf8");

  return {
    source: parseDraft(source.file, sourceMarkdown),
    target: parseDraft(target.file, targetMarkdown),
  };
}
