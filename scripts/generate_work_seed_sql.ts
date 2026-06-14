#!/usr/bin/env bun

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

type SourceArticle = {
  path: string;
  name: string;
  stem: string;
  title: string;
  date: string | null;
  tags: string[];
  body: string;
};

type TrackSource = {
  number: number;
  title: string;
  notes: string | null;
};

type ParsedArgs = {
  output: string;
  sourceDir: string;
  files: string[] | null;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_SOURCE_DIR = join(ROOT, "rawData", "articles");

function parseArgs(argv: string[]): ParsedArgs {
  let output: string | null = null;
  let sourceDir = DEFAULT_SOURCE_DIR;
  let files: string[] | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") {
      output = argv[++i] ?? null;
      continue;
    }
    if (arg === "--source-dir") {
      sourceDir = resolve(argv[++i] ?? DEFAULT_SOURCE_DIR);
      continue;
    }
    if (arg === "--files") {
      const collected: string[] = [];
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        collected.push(argv[++i]);
      }
      files = collected;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!output) {
    throw new Error("Missing required --output");
  }

  return {
    output: resolve(output),
    sourceDir,
    files,
  };
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && (trimmed.startsWith("'") && trimmed.endsWith("'") || trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontMatter(text: string): { meta: Record<string, string | string[]>; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("missing front matter");
  }

  const meta: Record<string, string | string[]> = {};
  const tags: string[] = [];
  let index = 1;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "---") {
      index += 1;
      break;
    }

    if (line.startsWith("tags:")) {
      index += 1;
      while (index < lines.length && lines[index].startsWith("  - ")) {
        tags.push(parseScalar(lines[index].slice(4)));
        index += 1;
      }
      meta.tags = tags;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex >= 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = parseScalar(line.slice(colonIndex + 1));
      meta[key] = value;
    }
    index += 1;
  }

  return {
    meta,
    body: lines.slice(index).join("\n").trim(),
  };
}

async function loadSources(sourceDir: string): Promise<SourceArticle[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const sources: SourceArticle[] = [];
  for (const file of files) {
    const path = join(sourceDir, file);
    const raw = await readFile(path, "utf8");
    const { meta, body } = parseFrontMatter(raw);
    sources.push({
      path,
      name: file,
      stem: basename(file, extname(file)),
      title: String(meta.title ?? basename(file, extname(file))),
      date: String(meta.date ?? "").slice(0, 10) || null,
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
      body,
    });
  }
  return sources;
}

function stableUuid(namespace: string, value: string): string {
  const hash = createHash("sha1").update(`mondenDatabase/${namespace}/${value}`).digest("hex");
  const chars = hash.slice(0, 32).split("");
  chars[12] = "5";
  const variant = Number.parseInt(chars[16], 16);
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

function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string[]> = { _root: [] };
  let current = "_root";
  for (const line of body.split(/\r?\n/)) {
    const match = line.trim().match(/^##\s+(.+)$/);
    if (match) {
      current = match[1].trim();
      sections[current] ??= [];
      continue;
    }
    sections[current] ??= [];
    sections[current].push(line);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]),
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\(\([^)]+\)\)/g, " ")
    .replace(/^\s*[-*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTrackTitle(value: string): string {
  return stripMarkdown(value)
    .replace(/\s+【[^】]+のみ収録】$/u, "")
    .replace(/\s+\(bonus track\)$/i, "")
    .trim();
}

function compactNote(source: SourceArticle, lines: string[]): string {
  void lines;
  return `source_file=${source.name}`;
}

function parseTrackList(section: string, source: SourceArticle): TrackSource[] {
  const tracks: TrackSource[] = [];
  let current: { number: number; title: string; noteLines: string[] } | null = null;

  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trackMatch = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (trackMatch) {
      if (current) {
        tracks.push({
          number: current.number,
          title: normalizeTrackTitle(current.title),
          notes: compactNote(source, current.noteLines),
        });
      }
      current = {
        number: tracks.length + 1,
        title: trackMatch[2].trim(),
        noteLines: [],
      };
      continue;
    }

    if (!current) continue;

    const noteMatch = line.match(/^\s{2,}[-*]\s+(.+)$/);
    if (noteMatch) {
      current.noteLines.push(noteMatch[1].trim());
      continue;
    }

    if (line.trim() && /^\s{2,}/.test(line)) {
      current.noteLines.push(line.trim());
    }
  }

  if (current) {
    tracks.push({
      number: current.number,
      title: normalizeTrackTitle(current.title),
      notes: compactNote(source, current.noteLines),
    });
  }

  return tracks.filter((track) => track.title.length > 0);
}

class SqlBuilder {
  readonly lines: string[] = [];

  line(value = ""): void {
    this.lines.push(value);
  }

  compositionUpsert(title: string, notes: string | null): string {
    const compositionId = stableUuid("composition", title);
    this.line("INSERT INTO composition (id, title, description)");
    this.line(`VALUES (${sqlText(compositionId)}, ${sqlText(title)}, ${sqlText(notes)})`);
    this.line("ON CONFLICT (id) DO UPDATE");
    this.line("SET title = EXCLUDED.title,");
    this.line("    description = COALESCE(composition.description, EXCLUDED.description);");
    this.line();
    return compositionId;
  }

  recordingUpsert(params: {
    source: SourceArticle;
    compositionId: string;
    track: TrackSource;
  }): string {
    const recordingId = stableUuid("recording", `${params.source.name}:${params.track.number}:${params.track.title}`);
    this.line("INSERT INTO recording (id, composition_id, recording_year, type, recorded_date, recorded_from, recorded_to, release_date, notes)");
    this.line(
      `VALUES (${sqlText(recordingId)}, ${sqlText(params.compositionId)}, NULL, ${sqlText("studio")}, NULL, NULL, NULL, ${sqlText(params.source.date)}, ${sqlText(params.track.notes)})`,
    );
    this.line("ON CONFLICT (id) DO UPDATE");
    this.line("SET composition_id = EXCLUDED.composition_id,");
    this.line("    release_date = COALESCE(recording.release_date, EXCLUDED.release_date),");
    this.line("    notes = EXCLUDED.notes;");
    this.line();
    return recordingId;
  }

  trackUpsert(params: {
    source: SourceArticle;
    releaseId: string;
    recordingId: string;
    track: TrackSource;
  }): void {
    const trackId = stableUuid("track", `${params.source.name}:${params.track.number}`);
    this.line("INSERT INTO track (id, release_id, recording_id, track_number, recorded_date, notes)");
    this.line(
      `VALUES (${sqlText(trackId)}, ${sqlText(params.releaseId)}, ${sqlText(params.recordingId)}, ${params.track.number}, NULL, ${sqlText(`source_file=${params.source.name}`)})`,
    );
    this.line("ON CONFLICT (id) DO UPDATE");
    this.line("SET recording_id = EXCLUDED.recording_id,");
    this.line("    track_number = EXCLUDED.track_number,");
    this.line("    notes = EXCLUDED.notes;");
    this.line();
  }
}

function isReleaseSource(source: SourceArticle): boolean {
  return source.tags[0] === "Release";
}

function emitSource(builder: SqlBuilder, source: SourceArticle): boolean {
  const sections = parseSections(source.body);
  const trackSection = sections["収録曲"];
  if (!trackSection) return false;

  const tracks = parseTrackList(trackSection, source);
  if (tracks.length === 0) return false;

  const releaseId = stableUuid("release", source.name);
  builder.line(`-- source: ${source.path}`);
  builder.line();

  for (const track of tracks) {
    const compositionId = builder.compositionUpsert(track.title, null);
    const recordingId = builder.recordingUpsert({ source, compositionId, track });
    builder.trackUpsert({ source, releaseId, recordingId, track });
  }

  return true;
}

function renderSql(sources: SourceArticle[]): string {
  const builder = new SqlBuilder();
  const skipped: string[] = [];

  builder.line("-- Generated by scripts/generate_work_seed_sql.ts");
  builder.line("-- Requires release rows generated by scripts/generate_rawdata_seed_sql.ts.");
  builder.line("BEGIN;");
  builder.line();

  for (const source of sources) {
    if (!isReleaseSource(source)) {
      skipped.push(source.name);
      continue;
    }
    if (!emitSource(builder, source)) {
      skipped.push(source.name);
    }
  }

  if (skipped.length > 0) {
    builder.line(`-- skipped: ${skipped.length} files`);
    for (const name of skipped.slice(0, 20)) {
      builder.line(`-- skipped_file: ${name}`);
    }
    builder.line();
  }

  builder.line("COMMIT;");
  builder.line();
  return builder.lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let sources = await loadSources(args.sourceDir);
  if (args.files && args.files.length > 0) {
    const wanted = new Set(args.files);
    sources = sources.filter((source) => wanted.has(source.name));
  }

  const sql = renderSql(sources);
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, sql, "utf8");
}

await main();
