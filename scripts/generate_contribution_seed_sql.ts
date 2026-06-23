#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

type SourceArticle = {
  path: string;
  name: string;
  title: string;
  date: string | null;
  tags: string[];
  body: string;
};

type ParsedArgs = {
  output: string;
  liveDir: string;
  files: string[] | null;
};

type ContributionSeed = {
  source: SourceArticle;
  personName: string;
  instruments: string[];
  rawCredit: string;
};

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  children?: MarkdownNode[];
};

type ListItemNode = MarkdownNode & {
  type: "listItem";
  children: MarkdownNode[];
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_LIVE_DIR = join(ROOT, "rawData", "articles_by_category", "Live");
const DEFAULT_OUTPUT = join(ROOT, "sql", "contribution_seed.sql");
const MARKDOWN_PROCESSOR = unified().use(remarkParse).use(remarkGfm);

const INSTRUMENT_ALIASES = new Map<string, string>([
  ["vo", "vocal"],
  ["vocal", "vocal"],
  ["vocals", "vocal"],
  ["voice", "vocal"],
  ["cho", "chorus"],
  ["chorus", "chorus"],
  ["choruses", "chorus"],
  ["gt", "guitar"],
  ["gu", "guitar"],
  ["guitar", "guitar"],
  ["guitars", "guitar"],
  ["electric gut guitar", "guitar"],
  ["ba", "bass"],
  ["bass", "bass"],
  ["dr", "drums"],
  ["drum", "drums"],
  ["drums", "drums"],
  ["perc", "percussion"],
  ["percussion", "percussion"],
  ["key", "keyboard"],
  ["keys", "keyboard"],
  ["keyboard", "keyboard"],
  ["keyboards", "keyboard"],
  ["pf", "piano"],
  ["piano", "piano"],
  ["synth", "synthesizer"],
  ["synthesizer", "synthesizer"],
  ["synthesizers", "synthesizer"],
  ["programming", "programming"],
  ["manipulator", "manipulator"],
  ["vn", "violin"],
  ["violin", "violin"],
  ["vj", "vj"],
  ["dance", "dance"],
  ["harp", "harp"],
  ["spd", "synthesizer"],
]);

const PERSON_ALIASES = new Map<string, string>([
  ["maryne", "Maryne"],
]);

function parseArgs(argv: string[]): ParsedArgs {
  let output = DEFAULT_OUTPUT;
  let liveDir = DEFAULT_LIVE_DIR;
  let files: string[] | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") {
      output = resolve(argv[++i] ?? DEFAULT_OUTPUT);
      continue;
    }
    if (arg === "--live-dir") {
      liveDir = resolve(argv[++i] ?? DEFAULT_LIVE_DIR);
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

  return { output, liveDir, files };
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
      meta[line.slice(0, colonIndex).trim()] = parseScalar(line.slice(colonIndex + 1));
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
      title: cleanText(String(meta.title ?? basename(file, extname(file)))),
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

function cleanText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\(\([^)]*\)\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownTree(markdown: string): MarkdownNode {
  return MARKDOWN_PROCESSOR.parse(markdown) as MarkdownNode;
}

function plainTextFromNode(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "code" || node.type === "html") return node.value ?? "";
  if (node.type === "break") return " ";
  if (node.type === "image") return node.alt ?? "";
  return (node.children ?? []).map(plainTextFromNode).join(" ");
}

function stripFootnotes(value: string): string {
  let result = value;
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(/\(\([^()]*\)\)/g, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

function parseSupportMemberLines(source: SourceArticle): string[] {
  const astLines = parseSupportMemberLinesFromAst(source.body);
  if (astLines.length > 0) return astLines;

  const lines = source.body.split(/\r?\n/);
  const result: string[] = [];
  let inSupportBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line)) {
      inSupportBlock = false;
      continue;
    }

    const supportMatch = line.match(/^\s*[-*]\s*サポートメンバー(?:[:：]\s*(.*)|\s*)$/);
    if (supportMatch) {
      inSupportBlock = true;
      const inlineValue = (supportMatch[1] ?? "").trim();
      if (inlineValue && !isEmptySupportValue(inlineValue)) result.push(inlineValue);
      if (inlineValue && isEmptySupportValue(inlineValue)) inSupportBlock = false;
      continue;
    }

    if (!inSupportBlock) continue;
    if (/^\s*$/.test(line)) continue;

    const nestedItem = line.match(/^\s{2,}[-*]\s+(.+)$/);
    if (nestedItem) {
      result.push(nestedItem[1].trim());
      continue;
    }

    if (/^\s*[-*]\s+\S/.test(line)) {
      inSupportBlock = false;
    }
  }

  return result;
}

function parseSupportMemberLinesFromAst(body: string): string[] {
  const result: string[] = [];
  const tree = markdownTree(body);

  for (const item of directListItems(tree)) {
    const ownText = cleanText(listItemOwnText(item));
    const supportMatch = ownText.match(/^サポートメンバー(?:[:：]\s*(.*)|\s*)$/);
    if (!supportMatch) continue;

    const inlineValue = (supportMatch[1] ?? "").trim();
    if (inlineValue && !isEmptySupportValue(inlineValue)) result.push(inlineValue);
    if (inlineValue && isEmptySupportValue(inlineValue)) continue;

    for (const child of item.children) {
      if (child.type !== "list") continue;
      for (const nested of child.children ?? []) {
        if (nested.type !== "listItem") continue;
        const value = cleanText(listItemOwnText(nested as ListItemNode));
        if (value) result.push(value);
      }
    }
  }

  return result;
}

function directListItems(node: MarkdownNode): ListItemNode[] {
  const result: ListItemNode[] = [];
  for (const child of node.children ?? []) {
    if (child.type === "list") {
      for (const item of child.children ?? []) {
        if (item.type === "listItem") result.push(item as ListItemNode);
      }
      continue;
    }
    result.push(...directListItems(child));
  }
  return result;
}

function listItemOwnText(item: ListItemNode): string {
  return item.children
    .filter((child) => child.type !== "list")
    .map(plainTextFromNode)
    .join(" ");
}

function isEmptySupportValue(value: string): boolean {
  const normalized = cleanText(value).toLowerCase();
  return !normalized || normalized === "なし" || normalized === "不明" || normalized === "none" || normalized === "unknown";
}

function parseSupportCredit(source: SourceArticle, rawLine: string): ContributionSeed | null {
  const rawCredit = cleanText(stripFootnotes(rawLine));
  if (isEmptySupportValue(rawCredit)) return null;
  if (/はセットリスト|特記した曲のみ参加/.test(rawCredit)) return null;

  const parenValues = [...rawCredit.matchAll(/[（(]([^（）()]*)[）)]/gu)].map((match) => cleanText(match[1]));
  let base = cleanText(rawCredit.replace(/[（(][^（）()]*[）)]/gu, " "));
  const instruments = new Set<string>();
  for (const value of parenValues) {
    for (const instrument of parseInstruments(value)) instruments.add(instrument);
  }

  const prefix = base.match(/^([A-Za-z.,&/\s]+)\s+(.+)$/u);
  if (prefix) {
    const prefixInstruments = parseInstruments(prefix[1]);
    if (prefixInstruments.length > 0) {
      for (const instrument of prefixInstruments) instruments.add(instrument);
      base = prefix[2].trim();
    }
  }

  if (base.includes("=")) {
    base = base.slice(base.lastIndexOf("=") + 1).trim();
  }

  const personName = canonicalPersonName(base);
  if (!personName) return null;

  return {
    source,
    personName,
    instruments: [...instruments],
    rawCredit,
  };
}

function parseInstruments(value: string): string[] {
  const normalized = value
    .replace(/など|他|etc\.?/gi, "")
    .replace(/and/gi, "/")
    .replace(/&/g, "/")
    .replace(/,/g, "/")
    .replace(/・/g, "/")
    .replace(/\./g, "");

  const result: string[] = [];
  for (const token of normalized.split("/")) {
    const key = token.trim().toLowerCase();
    const instrument = INSTRUMENT_ALIASES.get(key);
    if (instrument && !result.includes(instrument)) result.push(instrument);
  }
  return result;
}

function canonicalPersonName(value: string): string | null {
  let name = cleanText(value)
    .replace(/\s*※\s*$/u, "")
    .replace(/\s*[?？]+\s*$/u, "")
    .replace(/\s*….*$/u, "")
    .replace(/^\[|\]$/g, "")
    .trim();

  name = name.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, "");
  name = PERSON_ALIASES.get(name.toLowerCase()) ?? name;
  if (!name || name === "友人" || name.startsWith("(")) return null;
  return name;
}

function collectContributions(sources: SourceArticle[]): ContributionSeed[] {
  const contributions: ContributionSeed[] = [];
  for (const source of sources) {
    if (source.tags[0] !== "Live") continue;
    for (const rawLine of parseSupportMemberLines(source)) {
      const parsed = parseSupportCredit(source, rawLine);
      if (parsed) contributions.push(parsed);
    }
  }
  return contributions;
}

function renderSql(contributions: ContributionSeed[]): string {
  const lines: string[] = [];
  const people = new Set(contributions.map((contribution) => contribution.personName));
  const instruments = new Set(contributions.flatMap((contribution) => contribution.instruments));
  const supportRoleId = stableUuid("role", "support_performer");
  const emittedKeys = new Set<string>();
  let emitted = 0;

  lines.push("-- Generated by scripts/generate_contribution_seed_sql.ts");
  lines.push("-- Initial scope: live support member credits only.");
  lines.push("-- Requires event rows generated by scripts/generate_rawdata_seed_sql.ts --types live.");
  lines.push(`-- live_support_contributions: ${contributions.length}`);
  lines.push("BEGIN;");
  lines.push("");

  lines.push("INSERT INTO role (id, name, category, description)");
  lines.push(`VALUES (${sqlText(supportRoleId)}, 'support_performer', 'performance', 'ライブサポート演奏者')`);
  lines.push("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;");
  lines.push("");

  for (const instrument of [...instruments].sort((a, b) => a.localeCompare(b, "ja"))) {
    const instrumentId = stableUuid("instrument", instrument);
    lines.push("INSERT INTO instrument (id, name, description)");
    lines.push(`VALUES (${sqlText(instrumentId)}, ${sqlText(instrument)}, NULL)`);
    lines.push("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;");
    lines.push("");
  }

  for (const personName of [...people].sort((a, b) => a.localeCompare(b, "ja"))) {
    const personId = stableUuid("person", personName);
    lines.push("INSERT INTO person (id, name, description, birth_date, death_date, active_from, active_to)");
    lines.push(`VALUES (${sqlText(personId)}, ${sqlText(personName)}, ${sqlText("source=contribution_seed")}, NULL, NULL, NULL, NULL)`);
    lines.push("ON CONFLICT (id) DO UPDATE");
    lines.push("SET name = EXCLUDED.name,");
    lines.push("    description = COALESCE(person.description, EXCLUDED.description);");
    lines.push("");
  }

  for (const contribution of contributions) {
    const eventId = stableUuid("event", contribution.source.name);
    const personId = stableUuid("person", contribution.personName);
    const contributionInstruments = contribution.instruments.length > 0 ? contribution.instruments : [null];
    for (const instrument of contributionInstruments) {
      const instrumentId = instrument ? stableUuid("instrument", instrument) : null;
      const key = `${contribution.source.name}|${contribution.personName}|${instrument ?? ""}|${contribution.rawCredit}`;
      if (emittedKeys.has(key)) continue;
      emittedKeys.add(key);

      const contributionId = stableUuid("contribution", `event:${key}`);
      const notes = [`source_file=${contribution.source.name}`, `raw_credit=${contribution.rawCredit}`].join("\n");
      lines.push("INSERT INTO contribution (id, person_id, role_id, instrument_id, recording_id, release_id, event_id, notes)");
      lines.push(
        `VALUES (${sqlText(contributionId)}, ${sqlText(personId)}, ${sqlText(supportRoleId)}, ${sqlText(instrumentId)}, NULL, NULL, ${sqlText(eventId)}, ${sqlText(notes)})`,
      );
      lines.push("ON CONFLICT (id) DO UPDATE");
      lines.push("SET person_id = EXCLUDED.person_id,");
      lines.push("    role_id = EXCLUDED.role_id,");
      lines.push("    instrument_id = EXCLUDED.instrument_id,");
      lines.push("    event_id = EXCLUDED.event_id,");
      lines.push("    notes = EXCLUDED.notes;");
      lines.push("");
      emitted += 1;
    }
  }

  lines.push(`-- emitted_contributions: ${emitted}`);
  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));
  let liveSources = await loadSources(args.liveDir);
  if (args.files && args.files.length > 0) {
    const wanted = new Set(args.files);
    liveSources = liveSources.filter((source) => wanted.has(source.name));
  }

  const contributions = collectContributions(liveSources);
  const sql = renderSql(contributions);
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, sql, "utf8");
  console.log(`Wrote ${args.output}`);
  console.log(`Live support credits: ${contributions.length}`);
}

await main();
