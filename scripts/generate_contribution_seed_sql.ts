#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { resolvePersonAlias } from "./lib/personAliases";

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
  releaseDir: string;
  files: string[] | null;
};

type ContributionTarget =
  | { type: "event"; id: string }
  | { type: "release"; id: string };

type ContributionSeed = {
  source: SourceArticle;
  target: ContributionTarget;
  personName: string;
  roleName: string;
  roleCategory: string;
  roleDescription: string;
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
const DEFAULT_RELEASE_DIR = join(ROOT, "rawData", "articles_by_category", "release");
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

const RELEASE_ROLE_PATTERNS: {
  pattern: RegExp;
  name: string;
  category: string;
  description: string;
}[] = [
  { pattern: /\b(executive\s+producer)\b/i, name: "executive_producer", category: "production", description: "エグゼクティブプロデューサー" },
  { pattern: /\b(lyrics?|lyricist|作詞)\b/i, name: "lyricist", category: "composition", description: "作詞" },
  { pattern: /\b(music|compos(?:ed|er|ition)|written|作曲)\b/i, name: "composer", category: "composition", description: "作曲" },
  { pattern: /\b(arrang(?:ed|er|ement)|編曲)\b/i, name: "arranger", category: "production", description: "編曲" },
  { pattern: /\b(sound\s+produc|produc(?:ed|er|tion)|produce|プロデュース)\b/i, name: "producer", category: "production", description: "プロデュース" },
  { pattern: /\b(record(?:ed|ing)?(?:,?\s*mix(?:ed|ing))?|engineer(?:ed|ing)?|録音|レコーディング)\b/i, name: "recording_engineer", category: "engineering", description: "録音エンジニア" },
  { pattern: /\b(mix(?:ed|ing)|ミックス)\b/i, name: "mixing_engineer", category: "engineering", description: "ミックスエンジニア" },
  { pattern: /\b(master(?:ed|ing)|マスタリング)\b/i, name: "mastering_engineer", category: "engineering", description: "マスタリングエンジニア" },
  { pattern: /\b(artwork|illustration|painted|photography|design|designed|direction|camera|映像|写真)\b/i, name: "artwork", category: "creative", description: "アートワーク/デザイン" },
  { pattern: /\b(a\s*&\s*r|a\+r|label\s+a&r)\b/i, name: "a_and_r", category: "management", description: "A&R" },
  { pattern: /\b(management|manager)\b/i, name: "management", category: "management", description: "マネジメント" },
];

const SKIP_RELEASE_ROLE_PATTERNS = [
  /\b(at|studio|recorded at|mixed at|mastered at|thanks|special thanks)\b/i,
  /^-$/,
  /^#?\d/,
  /参加アーティスト/,
  /voice strings/i,
];

const NON_PERSON_VALUE_PATTERNS = [
  /\b(staff|friends?|famil(?:y|ies)|everyone|you|residents|people|all\s+)/i,
  /\b(studio|records?|music|production|productions|label|arts|signs|city|garage|loft)\b/i,
  /住民|全員|スタッフ|友人|家族|皆|レーベル|スタジオ/,
  /Good Dog Happy Men|BURGER NUDS|Poet-type\.M|Bohemian Arts|castle|tearbridge|I WILL|PCI MUSIC|LUCKON GRAPHICS/i,
];

function parseArgs(argv: string[]): ParsedArgs {
  let output = DEFAULT_OUTPUT;
  let liveDir = DEFAULT_LIVE_DIR;
  let releaseDir = DEFAULT_RELEASE_DIR;
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
    if (arg === "--release-dir") {
      releaseDir = resolve(argv[++i] ?? DEFAULT_RELEASE_DIR);
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

  return { output, liveDir, releaseDir, files };
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
    target: { type: "event", id: stableUuid("event", source.name) },
    personName,
    roleName: "support_performer",
    roleCategory: "performance",
    roleDescription: "ライブサポート演奏者",
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
    .replace(/^["“”']|["“”']$/g, "")
    .replace(/^(.+?)\s*\{([^{}]+)\}.*$/u, "$2")
    .replace(/\s+(?:at|for)\s+.+$/iu, "")
    .replace(/\s*※\s*$/u, "")
    .replace(/\s*[?？]+\s*$/u, "")
    .replace(/\s*….*$/u, "")
    .replace(/^\[|\]$/g, "")
    .trim();

  name = name.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, "");
  name = resolvePersonAlias(name);
  if (!name || name === "友人" || name.startsWith("(")) return null;
  return name;
}

function collectLiveContributions(sources: SourceArticle[]): ContributionSeed[] {
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

function collectReleaseContributions(sources: SourceArticle[]): ContributionSeed[] {
  const contributions: ContributionSeed[] = [];
  for (const source of sources) {
    if (source.tags[0] !== "Release") continue;
    for (const row of parseReleaseCreditRows(source.body)) {
      const roles = normalizeReleaseRoles(row.role);
      if (roles.length === 0) continue;
      for (const role of roles) {
        for (const personName of parseCreditPeople(row.names)) {
          contributions.push({
            source,
            target: { type: "release", id: stableUuid("release", source.name) },
            personName,
            roleName: role.name,
            roleCategory: role.category,
            roleDescription: role.description,
            instruments: [],
            rawCredit: `${cleanText(row.role)} | ${cleanText(row.names)}`,
          });
        }
      }
    }
  }
  return contributions;
}

function parseReleaseCreditRows(body: string): { role: string; names: string }[] {
  const tree = markdownTree(body);
  const result: { role: string; names: string }[] = [];
  let inCreditSection = false;

  for (const child of tree.children ?? []) {
    if (child.type === "heading") {
      const heading = cleanText(plainTextFromNode(child));
      inCreditSection = heading === "クレジット";
      continue;
    }
    if (!inCreditSection || child.type !== "table") continue;

    const rows = child.children ?? [];
    if (rows.length < 2) continue;
    for (const row of rows.slice(1)) {
      const cells = row.children ?? [];
      if (cells.length < 2) continue;
      const role = cleanText(plainTextFromNode(cells[0]));
      const names = cleanText(plainTextFromNode(cells[1]));
      if (role && names) result.push({ role, names });
    }
  }

  return result;
}

function normalizeReleaseRoles(rawRole: string): { name: string; category: string; description: string }[] {
  const role = cleanText(stripFootnotes(rawRole)).replaceAll("+", "&");
  if (!role || SKIP_RELEASE_ROLE_PATTERNS.some((pattern) => pattern.test(role))) return [];
  const roles: { name: string; category: string; description: string }[] = [];
  for (const entry of RELEASE_ROLE_PATTERNS) {
    if (!entry.pattern.test(role)) continue;
    if (roles.some((existing) => existing.name === entry.name)) continue;
    roles.push({ name: entry.name, category: entry.category, description: entry.description });
  }
  return roles;
}

function parseCreditPeople(rawNames: string): string[] {
  const braceValues = [...rawNames.matchAll(/\{([^{}]+)\}/g)]
    .flatMap((match) => splitPersonCandidates(match[1]))
    .filter((candidate) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(candidate));
  const source = braceValues.length > 0 ? braceValues.join(" / ") : rawNames;
  const withoutFootnotes = stripFootnotes(source)
    .replace(/\([^()]*\)/g, " ")
    .replace(/（[^（）]*）/g, " ");

  const withoutLocations = withoutFootnotes.replace(/\s+(?:at|for)\s+.+$/iu, "");
  const candidates = splitPersonCandidates(withoutLocations)
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  const people: string[] = [];
  for (const candidate of candidates) {
    if (NON_PERSON_VALUE_PATTERNS.some((pattern) => pattern.test(candidate))) continue;
    const personName = canonicalPersonName(candidate);
    if (!personName) continue;
    if (/^[A-Za-z\s.]+$/.test(personName) && personName.split(/\s+/).length < 2) continue;
    if (!people.includes(personName)) people.push(personName);
  }
  return people;
}

function splitPersonCandidates(value: string): string[] {
  return value.split(/\s*(?:\/|&| and |,|、|・)\s*/iu);
}

function renderSql(contributions: ContributionSeed[]): string {
  const lines: string[] = [];
  const people = new Set(contributions.map((contribution) => contribution.personName));
  const instruments = new Set(contributions.flatMap((contribution) => contribution.instruments));
  const roles = new Map<string, { category: string; description: string }>();
  for (const contribution of contributions) {
    roles.set(contribution.roleName, { category: contribution.roleCategory, description: contribution.roleDescription });
  }
  const emittedKeys = new Set<string>();
  let emitted = 0;

  lines.push("-- Generated by scripts/generate_contribution_seed_sql.ts");
  lines.push("-- Scope: live support member credits and release-level credit tables.");
  lines.push("-- Requires event rows generated by scripts/generate_rawdata_seed_sql.ts --types live.");
  lines.push("-- Requires release rows generated by scripts/generate_rawdata_seed_sql.ts --types release.");
  lines.push(`-- contributions: ${contributions.length}`);
  lines.push("BEGIN;");
  lines.push("");

  for (const [roleName, role] of [...roles].sort(([a], [b]) => a.localeCompare(b, "ja"))) {
    const roleId = stableUuid("role", roleName);
    lines.push("INSERT INTO role (id, name, category, description)");
    lines.push(`VALUES (${sqlText(roleId)}, ${sqlText(roleName)}, ${sqlText(role.category)}, ${sqlText(role.description)})`);
    lines.push("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;");
    lines.push("");
  }

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
    const personId = stableUuid("person", contribution.personName);
    const roleId = stableUuid("role", contribution.roleName);
    const contributionInstruments = contribution.instruments.length > 0 ? contribution.instruments : [null];
    for (const instrument of contributionInstruments) {
      const instrumentId = instrument ? stableUuid("instrument", instrument) : null;
      const key = `${contribution.target.type}|${contribution.source.name}|${contribution.personName}|${contribution.roleName}|${instrument ?? ""}|${contribution.rawCredit}`;
      if (emittedKeys.has(key)) continue;
      emittedKeys.add(key);

      const contributionId =
        contribution.target.type === "event"
          ? stableUuid("contribution", `event:${contribution.source.name}|${contribution.personName}|${instrument ?? ""}|${contribution.rawCredit}`)
          : stableUuid("contribution", key);
      const notes = [`source_file=${contribution.source.name}`, `raw_credit=${contribution.rawCredit}`].join("\n");
      const recordingId = null;
      const releaseId = contribution.target.type === "release" ? contribution.target.id : null;
      const eventId = contribution.target.type === "event" ? contribution.target.id : null;
      lines.push("INSERT INTO contribution (id, person_id, role_id, instrument_id, recording_id, release_id, event_id, notes)");
      lines.push(
        `VALUES (${sqlText(contributionId)}, ${sqlText(personId)}, ${sqlText(roleId)}, ${sqlText(instrumentId)}, ${sqlText(recordingId)}, ${sqlText(releaseId)}, ${sqlText(eventId)}, ${sqlText(notes)})`,
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
  let releaseSources = await loadSources(args.releaseDir);
  if (args.files && args.files.length > 0) {
    const wanted = new Set(args.files);
    liveSources = liveSources.filter((source) => wanted.has(source.name));
    releaseSources = releaseSources.filter((source) => wanted.has(source.name));
  }

  const liveContributions = collectLiveContributions(liveSources);
  const releaseContributions = collectReleaseContributions(releaseSources);
  const contributions = [...liveContributions, ...releaseContributions];
  const sql = renderSql(contributions);
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, sql, "utf8");
  console.log(`Wrote ${args.output}`);
  console.log(`Live support credits: ${liveContributions.length}`);
  console.log(`Release credits: ${releaseContributions.length}`);
}

await main();
