#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type LabelSource = {
  fileName: string;
  title: string;
  body: string;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_SOURCE_DIR = join(ROOT, "rawData", "articles_by_category", "label");
const DEFAULT_OUTPUT = join(ROOT, "sql", "label_seed.sql");

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

function stripMarkdown(text: string): string {
  let result = text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s*/gm, "")
    .replace(/^\s*\d+\.\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(/\(\([\s\S]*?\)\)/g, " ").replace(/\s+/g, " ").trim();
  }
  return result;
}

function parseFrontMatter(markdown: string): { title: string; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { title: "Untitled", body: markdown };
  const frontMatter = match[1] ?? "";
  const titleMatch = frontMatter.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  return {
    title: titleMatch?.[1] ?? "Untitled",
    body: markdown.slice(match[0].length),
  };
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  const match = body.match(pattern);
  if (!match || match.index == null) return "";
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function firstBulletValue(section: string, key: string): string | null {
  const lines = section.split(/\r?\n/);
  const direct = lines.find((line) => line.trim().startsWith(`* ${key}:`) || line.trim().startsWith(`- ${key}:`));
  if (direct) {
    const value = direct.trim().replace(/^[-*]\s*[^:]+:\s*/, "").trim();
    if (value) return value;
  }

  const index = lines.findIndex((line) => line.trim() === `* ${key}:` || line.trim() === `- ${key}:`);
  if (index === -1) return null;
  const values: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (/^[-*]\s+\S/.test(line)) break;
    if (/^\s+[-*]\s+\S/.test(line)) {
      values.push(line.replace(/^\s*[-*]\s+/, "").trim());
      continue;
    }
    if (line.trim().length === 0) continue;
    break;
  }
  return values.join(" / ") || null;
}

function firstBullets(section: string, limit: number): string[] {
  return section
    .split(/\r?\n/)
    .filter((line) => /^[-*]\s+\S/.test(line))
    .map((line) => line.trim().replace(/^[-*]\s+/, "").trim())
    .filter((line) => !line.includes("|"))
    .slice(0, limit);
}

function relationSection(body: string): string | null {
  const match = body.match(/^##\s+(.+?との関係)\s*$/m);
  if (!match) return null;
  return extractSection(body, match[1] ?? "");
}

function descriptionFor(source: LabelSource): string {
  const basic = extractSection(source.body, "基本情報");
  const parts: string[] = [`source_file=rawData/articles_by_category/label/${source.fileName}`];
  const overview = firstBulletValue(basic, "概要");
  const period = firstBulletValue(basic, "所属期間");
  const relation = relationSection(source.body);

  if (overview) parts.push(`概要: ${stripMarkdown(overview)}`);
  if (!overview) {
    const fallback = firstBullets(basic, 3).map(stripMarkdown).filter(Boolean).join(" / ");
    if (fallback) parts.push(`概要: ${fallback}`);
  }
  if (period) parts.push(`所属期間: ${stripMarkdown(period)}`);
  if (relation) {
    const text = stripMarkdown(relation);
    if (text) parts.push(text.slice(0, 500));
  }

  return parts.join("\n");
}

function outputPathFromArgs(): string {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex === -1) return DEFAULT_OUTPUT;
  return resolve(process.argv[outputIndex + 1] ?? DEFAULT_OUTPUT);
}

function sourceDirFromArgs(): string {
  const sourceIndex = process.argv.indexOf("--source-dir");
  if (sourceIndex === -1) return DEFAULT_SOURCE_DIR;
  return resolve(process.argv[sourceIndex + 1] ?? DEFAULT_SOURCE_DIR);
}

async function loadSources(sourceDir: string): Promise<LabelSource[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const sources: LabelSource[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const markdown = await readFile(join(sourceDir, entry.name), "utf8");
    const parsed = parseFrontMatter(markdown);
    sources.push({ fileName: entry.name, title: parsed.title, body: parsed.body });
  }
  return sources.sort((a, b) => a.title.localeCompare(b.title));
}

async function main(): Promise<void> {
  const sourceDir = sourceDirFromArgs();
  const output = outputPathFromArgs();
  const sources = await loadSources(sourceDir);
  const lines: string[] = ["BEGIN;", ""];

  for (const source of sources) {
    const labelId = stableUuid("label", source.title);
    lines.push("INSERT INTO label (id, name, description)");
    lines.push(`VALUES (${sqlText(labelId)}, ${sqlText(source.title)}, ${sqlText(descriptionFor(source))})`);
    lines.push("ON CONFLICT (id) DO UPDATE");
    lines.push("SET name = EXCLUDED.name,");
    lines.push("    description = EXCLUDED.description;");
    lines.push("");
  }

  lines.push("COMMIT;", "");

  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, lines.join("\n"), "utf8");
}

await main();
