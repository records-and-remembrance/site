#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SourceArticle = {
  path: string;
  name: string;
  title: string;
  date: string | null;
  tags: string[];
  body: string;
};

type SetlistItem = {
  orderIndex: number;
  rawTitle: string;
  cleanedTitle: string;
  section: string;
  encore: boolean;
};

type CompositionRef = {
  id: string;
  title: string;
};

type ParsedArgs = {
  output: string;
  sourceDir: string;
  compositionDraftDir: string;
  files: string[] | null;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_SOURCE_DIR = join(ROOT, "rawData", "articles_by_category", "Live");
const DEFAULT_COMPOSITION_DRAFT_DIR = join(ROOT, "drafts", "compositions");
const DEFAULT_OUTPUT = join(ROOT, "sql", "live_performances_seed.sql");

function parseArgs(argv: string[]): ParsedArgs {
  let output = DEFAULT_OUTPUT;
  let sourceDir = DEFAULT_SOURCE_DIR;
  let compositionDraftDir = DEFAULT_COMPOSITION_DRAFT_DIR;
  let files: string[] | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") {
      output = resolve(argv[++i] ?? DEFAULT_OUTPUT);
      continue;
    }
    if (arg === "--source-dir") {
      sourceDir = resolve(argv[++i] ?? DEFAULT_SOURCE_DIR);
      continue;
    }
    if (arg === "--composition-draft-dir") {
      compositionDraftDir = resolve(argv[++i] ?? DEFAULT_COMPOSITION_DRAFT_DIR);
      continue;
    }
    if (arg === "--files") {
      const collected: string[] = [];
      while (argv[i + 1] && !argv[i + 1]!.startsWith("--")) {
        collected.push(argv[++i]!);
      }
      files = collected;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { output, sourceDir, compositionDraftDir, files };
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"')))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontMatter(text: string): { meta: Record<string, string | string[]>; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") throw new Error("missing front matter");

  const meta: Record<string, string | string[]> = {};
  const tags: string[] = [];
  let index = 1;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) break;
    if (line.trim() === "---") {
      index += 1;
      break;
    }

    if (line.startsWith("tags:")) {
      index += 1;
      while (index < lines.length && lines[index]!.startsWith("  - ")) {
        tags.push(parseScalar(lines[index]!.slice(4)));
        index += 1;
      }
      meta.tags = tags;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex >= 0) {
      const key = line.slice(0, colonIndex).trim();
      meta[key] = parseScalar(line.slice(colonIndex + 1));
    }
    index += 1;
  }

  return { meta, body: lines.slice(index).join("\n").trim() };
}

async function loadSources(sourceDir: string): Promise<SourceArticle[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const sources: SourceArticle[] = [];
  for (const file of files) {
    const path = join(sourceDir, file);
    const raw = await readFile(path, "utf8");
    const { meta, body } = parseFrontMatter(raw);
    sources.push({
      path,
      name: file,
      title: String(meta.title ?? basename(file, extname(file))),
      date: String(meta.date ?? "").slice(0, 10) || null,
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
      body,
    });
  }
  return sources;
}

function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string[]> = { _root: [] };
  let current = "_root";
  for (const line of body.split(/\r?\n/)) {
    const match = line.trim().match(/^##\s+(.+)$/);
    if (match) {
      current = match[1]!.trim();
      sections[current] ??= [];
      continue;
    }
    sections[current] ??= [];
    sections[current]!.push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]));
}

function stripMarkdown(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\(\([^)]+\)\)/g, " ")
    .replace(/^\s*[-*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string): string {
  return stripMarkdown(value)
    .replace(/\s+【[^】]+のみ収録】$/u, "")
    .replace(/\s+\(bonus track\)$/i, "")
    .trim();
}

function isIgnorableTitle(value: string): boolean {
  const normalized = cleanTitle(value).toLocaleLowerCase("ja-JP");
  return (
    normalized.length === 0 ||
    normalized === "不明" ||
    normalized === "unknown" ||
    normalized === "se" ||
    normalized === "【encore break】" ||
    normalized === "encore break"
  );
}

function parseSetlist(source: SourceArticle): SetlistItem[] {
  const sections = parseSections(source.body);
  const items: SetlistItem[] = [];

  for (const [section, content] of Object.entries(sections)) {
    if (!section.startsWith("セットリスト")) continue;
    const encore = /encore|アンコール/i.test(section);

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (!ordered && !bullet) continue;

      const rawTitle = (ordered?.[2] ?? bullet?.[1] ?? "").trim();
      if (isIgnorableTitle(rawTitle)) continue;

      items.push({
        orderIndex: items.length + 1,
        rawTitle,
        cleanedTitle: cleanTitle(rawTitle),
        section,
        encore,
      });
    }
  }

  return items;
}

function stableUuid(namespace: string, value: string): string {
  const hash = createHash("sha1").update(`mondenDatabase/${namespace}/${value}`).digest("hex");
  const chars = hash.slice(0, 32).split("");
  chars[12] = "5";
  const variant = Number.parseInt(chars[16]!, 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

function sqlText(value: string | null): string {
  if (value == null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function parseDraftFrontMatter(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error("missing front matter");
  return match[1]!;
}

function parseYamlScalar(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "~" || trimmed === "") return null;
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function extractDraftField(frontMatter: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = frontMatter.match(new RegExp(`^${escaped}:\\s*(.*)$`, "m"));
  return match ? parseYamlScalar(match[1]!) : null;
}

function extractDraftBlock(frontMatter: string, key: string): string {
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

function extractSourceField(sourceEntry: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sourceEntry.match(new RegExp(`^\\s*${escaped}:\\s*(.*)$`, "m"));
  return match ? parseYamlScalar(match[1]!) : null;
}

function compositionKey(file: string, rawTitle: string): string {
  return `${file}\u0000${cleanTitle(rawTitle)}`;
}

async function loadCompositionLookup(draftDir: string): Promise<Map<string, CompositionRef | null>> {
  const entries = await readdir(draftDir, { withFileTypes: true });
  const lookup = new Map<string, CompositionRef | null>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") continue;

    const markdown = await readFile(join(draftDir, entry.name), "utf8");
    const frontMatter = parseDraftFrontMatter(markdown);
    const status = extractDraftField(frontMatter, "status") ?? "draft";
    const canonicalTitle = extractDraftField(frontMatter, "canonical_title") ?? basename(entry.name, extname(entry.name));
    const compositionId = extractDraftField(frontMatter, "composition_id") ?? stableUuid("composition", canonicalTitle);
    const ref = status === "reviewed" ? { id: compositionId, title: canonicalTitle } : null;

    for (const sourceEntry of sourceEntries(extractDraftBlock(frontMatter, "sources"))) {
      if (extractSourceField(sourceEntry, "type") !== "live") continue;
      const file = extractSourceField(sourceEntry, "file");
      const rawTitle = extractSourceField(sourceEntry, "raw_title");
      if (!file || !rawTitle) continue;

      const key = compositionKey(file, rawTitle);
      if (ref || !lookup.has(key)) lookup.set(key, ref);
    }
  }

  return lookup;
}

function renderSql(sources: SourceArticle[], compositionLookup: Map<string, CompositionRef | null>): string {
  const lines: string[] = [];
  const skippedFiles: string[] = [];
  let emitted = 0;
  let skippedItems = 0;

  lines.push("-- Generated by scripts/generate_live_performance_seed_sql.ts");
  lines.push("-- Requires live event rows generated by scripts/generate_rawdata_seed_sql.ts and compositions generated from drafts.");
  lines.push("BEGIN;");
  lines.push("");

  for (const source of sources) {
    if (source.tags[0] !== "Live") {
      skippedFiles.push(source.name);
      continue;
    }

    const setlist = parseSetlist(source);
    if (setlist.length === 0) {
      skippedFiles.push(source.name);
      continue;
    }

    const eventId = stableUuid("event", source.name);
    lines.push(`-- source: ${source.path}`);
    lines.push("");

    for (const item of setlist) {
      const compositionRef = compositionLookup.get(compositionKey(source.name, item.rawTitle));
      if (!compositionRef) {
        lines.push(`-- skipped ignored/split/unreviewed item: ${source.name} #${item.orderIndex} ${item.rawTitle}`);
        lines.push("");
        skippedItems += 1;
        continue;
      }

      const performanceId = stableUuid("event_performance", `${source.name}:${item.orderIndex}:${item.cleanedTitle}`);
      const variationNote = item.cleanedTitle === compositionRef.title ? null : item.rawTitle;
      const notes = [`source_file=${source.name}`, `section=${item.section}`].join("\n");
      lines.push("INSERT INTO event_performance (id, event_id, composition_id, order_index, encore, variation_note, notes)");
      lines.push(
        `VALUES (${sqlText(performanceId)}, ${sqlText(eventId)}, ${sqlText(compositionRef.id)}, ${item.orderIndex}, ${item.encore ? "TRUE" : "FALSE"}, ${sqlText(variationNote)}, ${sqlText(notes)})`,
      );
      lines.push("ON CONFLICT (id) DO UPDATE");
      lines.push("SET composition_id = EXCLUDED.composition_id,");
      lines.push("    order_index = EXCLUDED.order_index,");
      lines.push("    encore = EXCLUDED.encore,");
      lines.push("    variation_note = EXCLUDED.variation_note,");
      lines.push("    notes = EXCLUDED.notes;");
      lines.push("");
      emitted += 1;
    }
  }

  if (skippedFiles.length > 0) {
    lines.push(`-- skipped_files: ${skippedFiles.length}`);
    for (const file of skippedFiles.slice(0, 30)) lines.push(`-- skipped_file: ${file}`);
    lines.push("");
  }

  lines.push(`-- emitted_performances: ${emitted}`);
  lines.push(`-- skipped_items: ${skippedItems}`);
  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));
  let sources = await loadSources(args.sourceDir);
  if (args.files && args.files.length > 0) {
    const wanted = new Set(args.files);
    sources = sources.filter((source) => wanted.has(source.name));
  }

  const compositionLookup = await loadCompositionLookup(args.compositionDraftDir);
  const sql = renderSql(sources, compositionLookup);
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, sql, "utf8");
  console.log(`Wrote ${args.output}`);
}

await main();
