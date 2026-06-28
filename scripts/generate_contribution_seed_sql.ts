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
  | { type: "release"; id: string }
  | { type: "recording"; id: string };

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

type OutlineBlock = {
  top: string;
  sub: string | null;
  body: string;
};

type TrackGroup = {
  name: string | null;
  startTrackNumber: number;
  tracks: {
    number: number;
    title: string;
    notes: string | null;
  }[];
};

type MatrixContribution = {
  trackNumber: number;
  personName: string;
  instrument: string;
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
const DEFAULT_TRACK_SEED = join(ROOT, "sql", "release_tracks_seed.sql");
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
  ["electric upright bass", "contrabass"],
  ["upright bass", "contrabass"],
  ["double bass", "contrabass"],
  ["electric gut guitar", "electric_guitar"],
  ["electric guitar", "electric_guitar"],
  ["a.gt", "acoustic_guitar"],
  ["a.gt.", "acoustic_guitar"],
  ["e.gt", "electric_guitar"],
  ["e.gt.", "electric_guitar"],
  ["first violin", "violin"],
  ["second violin", "violin"],
  ["ba", "bass"],
  ["bass", "bass"],
  ["contrabass", "contrabass"],
  ["dr", "drums"],
  ["drum", "drums"],
  ["drums", "drums"],
  ["dr cho", "drums"],
  ["dr cho.", "drums"],
  ["perc", "percussion"],
  ["percussion", "percussion"],
  ["junk perc", "percussion"],
  ["junk perc.", "percussion"],
  ["kachikachi perc", "percussion"],
  ["kachikachi perc.", "percussion"],
  ["key", "keyboard"],
  ["keys", "keyboard"],
  ["keyboard", "keyboard"],
  ["keyboards", "keyboard"],
  ["pf", "piano"],
  ["piano", "piano"],
  ["electric piano", "electric_piano"],
  ["rhodes piano", "rhodes_piano"],
  ["箱", "cajon"],
  ["カホン", "cajon"],
  ["小太鼓", "snare_drum"],
  ["synth", "synthesizer"],
  ["synthesizer", "synthesizer"],
  ["synthesizers", "synthesizer"],
  ["programming", "programming"],
  ["program", "programming"],
  ["manipulator", "manipulator"],
  ["recorder", "recorder"],
  ["melodeon", "melodeon"],
  ["melodion", "melodeon"],
  ["washboard", "washboard"],
  ["kazoo", "kazoo"],
  ["bass drum", "bass_drum"],
  ["hand cymbal", "hand_cymbal"],
  ["snare drum", "snare_drum"],
  ["glockenspiel", "glockenspiel"],
  ["grockenspiel", "glockenspiel"],
  ["conga", "conga"],
  ["timpani", "timpani"],
  ["tambourine", "tambourine"],
  ["shaker", "shaker"],
  ["toys", "toys"],
  ["metronome", "metronome"],
  ["coin drop", "coin_drop"],
  ["whistle", "whistle"],
  ["vn", "violin"],
  ["violin", "violin"],
  ["vj", "vj"],
  ["dance", "dance"],
  ["harp", "harp"],
  ["spd", "synthesizer"],
]);

const INSTRUMENT_MULTI_ALIASES = new Map<string, string[]>([
  ["dr cho", ["drums", "chorus"]],
  ["dr cho.", ["drums", "chorus"]],
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
  { pattern: /\b(guest\s+vocal|guest\s+voice|guest\s+lead\s+vocal)\b/i, name: "guest_vocal", category: "performance", description: "ゲストボーカル" },
  { pattern: /\b(guest\s+chorus|guest\s+cho(?:rus)?)\b/i, name: "guest_chorus", category: "performance", description: "ゲストコーラス" },
  { pattern: /\b(guest\s+performer|guest\s+player|guest|special\s+guest)\b/i, name: "guest_performer", category: "performance", description: "ゲスト演奏" },
  { pattern: /\b(vocal\s+director|voice\s+director)\b/i, name: "vocal_director", category: "production", description: "ボーカルディレクション" },
  { pattern: /\b(assistant\s+director)\b/i, name: "assistant_director", category: "production", description: "アシスタントディレクション" },
  { pattern: /\b(director)\b/i, name: "director", category: "creative", description: "ディレクション" },
  { pattern: /\b(camera)\b/i, name: "camera", category: "creative", description: "カメラ" },
  { pattern: /\b(photograph(?:er|y)|photo)\b/i, name: "photographer", category: "creative", description: "撮影" },
  { pattern: /\b(art\s+designer|design(?:er|ing)?|art\s+design)\b/i, name: "art_designer", category: "creative", description: "アートデザイン" },
  { pattern: /\b(rights\s+management\s+officer|rights\s+management)\b/i, name: "rights_management_officer", category: "management", description: "権利管理" },
  { pattern: /\b(executive\s+manager)\b/i, name: "executive_manager", category: "management", description: "エグゼクティブマネージャー" },
  { pattern: /\b(supervisor)\b/i, name: "supervisor", category: "management", description: "監修" },
  { pattern: /\b(staff|stage\s+staff|dvd\s+staff)\b/i, name: "staff", category: "production", description: "スタッフ" },
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
    for (const instrument of extractSupportInstruments(value)) instruments.add(instrument);
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

function extractSupportInstruments(value: string): string[] {
  const parsed = parseInstruments(value);
  if (parsed.length <= 1) return parsed;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) && /\s/.test(value)) {
    return parsed.slice(0, 1);
  }
  return parsed;
}

function splitOutlineBlocks(body: string): OutlineBlock[] {
  const blocks: OutlineBlock[] = [];
  let currentTop: string | null = null;
  let currentSub: string | null = null;
  let currentLines: string[] = [];

  const pushBlock = (): void => {
    if (!currentTop || currentLines.length === 0) return;
    blocks.push({ top: currentTop, sub: currentSub, body: currentLines.join("\n").trim() });
  };

  for (const rawLine of body.split(/\r?\n/)) {
    const topMatch = rawLine.match(/^##\s+(.+)$/);
    if (topMatch) {
      pushBlock();
      currentTop = cleanText(topMatch[1]);
      currentSub = null;
      currentLines = [];
      continue;
    }

    const subMatch = rawLine.match(/^###\s+(.+)$/);
    if (subMatch) {
      pushBlock();
      currentSub = cleanText(subMatch[1]);
      currentLines = [];
      continue;
    }

    if (!currentTop) continue;
    currentLines.push(rawLine);
  }

  pushBlock();
  return blocks;
}

function parseTrackGroups(source: SourceArticle): TrackGroup[] {
  const blocks = splitOutlineBlocks(source.body).filter((block) => block.top === "収録曲");
  const groups: TrackGroup[] = [];
  let startTrackNumber = 1;

  for (const block of blocks) {
    const tracks = parseTrackListBlock(block.body, source);
    if (tracks.length === 0) continue;
    groups.push({
      name: block.sub,
      startTrackNumber,
      tracks,
    });
    startTrackNumber += tracks.length;
  }

  return groups;
}

function parseTrackListBlock(section: string, source: SourceArticle): { number: number; title: string; notes: string | null }[] {
  const tracks: { number: number; title: string; notes: string | null }[] = [];
  let current: { number: number; title: string; noteLines: string[] } | null = null;

  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trackMatch = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    const bulletMatch = line.match(/^([-*])\s+(.+)$/);
    if (trackMatch || bulletMatch) {
      if (current) {
        const noteText =
          current.noteLines.length > 0
            ? `${compactTrackNote(source, current.noteLines)}\n${cleanText(current.noteLines.join(" "))}`
            : compactTrackNote(source, current.noteLines);
        tracks.push({
          number: current.number,
          title: cleanText(stripFootnotes(current.title)),
          notes: noteText,
        });
      }
      current = {
        number: tracks.length + 1,
        title: (trackMatch?.[2] ?? bulletMatch?.[2] ?? "").trim(),
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
    const noteText =
      current.noteLines.length > 0
        ? `${compactTrackNote(source, current.noteLines)}\n${cleanText(current.noteLines.join(" "))}`
        : compactTrackNote(source, current.noteLines);
    tracks.push({
      number: current.number,
      title: cleanText(stripFootnotes(current.title)),
      notes: noteText,
    });
  }

  return tracks.filter((track) => track.title.length > 0);
}

function compactTrackNote(source: SourceArticle, lines: string[]): string | null {
  void lines;
  return `source_file=${source.name}`;
}

function buildRecordingIndex(source: SourceArticle): Map<number, { recordingId: string; title: string }> {
  const groups = parseTrackGroups(source);
  const index = new Map<number, { recordingId: string; title: string }>();
  for (const group of groups) {
    for (const track of group.tracks) {
      const absoluteTrackNumber = group.startTrackNumber + track.number - 1;
      index.set(absoluteTrackNumber, {
        recordingId: stableUuid("recording", `${source.name}:${absoluteTrackNumber}:${track.title}`),
        title: track.title,
      });
    }
  }
  return index;
}

async function loadRecordingLookupFromTrackSeed(trackSeedPath: string): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  const sql = await readFile(trackSeedPath, "utf8");
  for (const line of sql.split(/\r?\n/)) {
    if (!line.startsWith("VALUES ")) continue;
    const match = line.match(
      /^VALUES \('([^']+)', '([^']+)', '([^']+)', (\d+), NULL, '(?:source_file=)?([^']+)'\),?$/,
    );
    if (!match) continue;
    const recordingId = match[3];
    const trackNumber = Number.parseInt(match[4], 10);
    const sourceFile = match[5];
    lookup.set(`${sourceFile}|${trackNumber}`, recordingId);
  }
  return lookup;
}

function parseParticipantRoster(source: SourceArticle): string[] {
  const roster: string[] = [];
  let inRoster = false;

  for (const rawLine of source.body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line)) {
      inRoster = false;
      continue;
    }
    if (/^\s*-\s*参加アーティスト\s*$/.test(line)) {
      inRoster = true;
      continue;
    }
    if (!inRoster) continue;

    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) {
      const name = canonicalPersonName(item[1]);
      if (name && !roster.includes(name)) roster.push(name);
      continue;
    }

    if (line.trim() && !/^\s+/.test(line)) {
      inRoster = false;
    }
  }

  return roster;
}

function parseMatrixRowLabel(label: string): number | null {
  const match = cleanText(label).match(/^#\s*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function normalizeMatrixInstrument(value: string): string | null {
  const normalized = cleanText(stripFootnotes(value))
    .replace(/\([^()]*\)/g, " ")
    .replace(/\s*[:：]\s*$/, "")
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return INSTRUMENT_ALIASES.get(normalized.toLowerCase()) ?? null;
}

function parseMatrixCellPeople(value: string, fallbackInstrument: string | null, roster: string[]): { personName: string; instrument: string }[] {
  const cleaned = cleanText(stripFootnotes(value));
  if (!cleaned) return [];
  if (/^\[?\s*4\s*人\s*\]?$/.test(cleaned)) {
    return roster.map((personName) => ({ personName, instrument: fallbackInstrument ?? "performer" }));
  }

  const results: { personName: string; instrument: string }[] = [];
  for (const token of cleaned.split(/\s*(?:\/|&| and |,|、|・|＋)\s*/iu)) {
    if (!token) continue;
    const hintMatch = token.match(/^(.+?)\(([^()]+)\)$/u);
    const base = cleanText(hintMatch?.[1] ?? token);
    const hint = hintMatch ? normalizeMatrixInstrument(hintMatch[2]) : null;
    const personName = canonicalPersonName(base);
    if (!personName) continue;
    results.push({ personName, instrument: hint ?? fallbackInstrument ?? "performer" });
  }

  return results;
}

export function parseMatrixOtherCell(value: string, roster: string[]): { personName: string; instrument: string }[] {
  const cleaned = cleanText(stripFootnotes(value));
  if (!cleaned) return [];

  const results: { personName: string; instrument: string }[] = [];
  for (const segment of cleaned.split(/\s*(?:,|、)\s*/u)) {
    let rest = segment.replace(/\s*※\s*$/u, "").trim();
    if (!rest) continue;

    const instruments: string[] = [];
    while (rest) {
      const parsed = parseLeadingMatrixInstrument(rest);
      if (!parsed) break;
      instruments.push(parsed.instrument);
      rest = parsed.rest;
      if (!rest.startsWith("&")) break;
      rest = rest.slice(1).trim();
    }

    if (instruments.length > 0 && rest && rest !== "※") {
      for (const person of parseMatrixCellPeople(rest, null, roster)) {
        for (const instrument of instruments) {
          results.push({ personName: person.personName, instrument });
        }
      }
      continue;
    }

    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colonMatch = trimmed.match(/^(.+?)[：:]\s*(.+)$/u);
    if (colonMatch) {
      const instrument = normalizeMatrixInstrument(colonMatch[1]);
      if (!instrument) continue;
      for (const person of parseMatrixCellPeople(colonMatch[2], instrument, roster)) {
        results.push(person);
      }
      continue;
    }

    const labelMatch = trimmed.match(/^(.+?)\s+(.+)$/u);
    if (labelMatch) {
      const instrument = normalizeMatrixInstrument(labelMatch[1]);
      if (instrument) {
        for (const person of parseMatrixCellPeople(labelMatch[2], instrument, roster)) {
          results.push(person);
        }
        continue;
      }
    }
  }
  return results;
}

function parseLeadingMatrixInstrument(value: string): { instrument: string; rest: string } | null {
  const boundaries = [...value.matchAll(/\s+|(?=&)/g)].map((match) => match.index);
  for (const boundary of boundaries.reverse()) {
    const instrument = normalizeMatrixInstrument(value.slice(0, boundary));
    if (!instrument) continue;
    return {
      instrument,
      rest: value.slice(boundary).trim(),
    };
  }
  return null;
}

async function collectRecordingContributions(sources: SourceArticle[], recordingLookup: Map<string, string>): Promise<ContributionSeed[]> {
  const contributions: ContributionSeed[] = [];
  for (const source of sources) {
    if (source.tags[0] !== "Release") continue;

    const trackGroups = parseTrackGroups(source);
    const trackGroupStarts = new Map(trackGroups.map((group) => [group.name ?? "", group.startTrackNumber]));

    const roster = parseParticipantRoster(source);
    const blocks = splitOutlineBlocks(source.body).filter((block) => block.top === "クレジット");
    for (const block of blocks) {
      const tables = parseTablesFromMarkdown(block.body);
      for (const table of tables) {
        const header = table.headers.map((cell) => cleanText(cell));
        if (header.length < 2) continue;
        const firstHeader = header[0];
        const hasTrackMatrix = /^#|^トラック\/楽器/.test(firstHeader);
        if (!hasTrackMatrix) continue;

        const trackOffset = block.sub ? trackGroupStarts.get(block.sub) ?? null : null;
        for (const row of table.rows) {
          const rowLabel = cleanText(row[0] ?? "");
          const localTrackNumber = parseMatrixRowLabel(rowLabel);
          if (localTrackNumber == null) continue;
          const absoluteTrackNumber = trackOffset ? trackOffset + localTrackNumber - 1 : localTrackNumber;
          const recordingId = recordingLookup.get(`${source.name}|${absoluteTrackNumber}`);
          if (!recordingId) continue;

          for (let columnIndex = 1; columnIndex < header.length; columnIndex += 1) {
            const columnHeader = header[columnIndex];
            const cellValue = cleanText(row[columnIndex] ?? "");
            if (!cellValue) continue;

            const fallbackInstrument = normalizeMatrixInstrument(columnHeader);
            if (!fallbackInstrument && columnHeader !== "その他") continue;

            const people =
              columnHeader === "その他"
                ? parseMatrixOtherCell(cellValue, roster)
                : parseMatrixCellPeople(cellValue, fallbackInstrument, roster);

            for (const entry of people) {
              contributions.push({
                source,
                target: { type: "recording", id: recordingId },
                personName: entry.personName,
                roleName: "performer",
                roleCategory: "performance",
                roleDescription: "録音演奏者",
                instruments: [entry.instrument],
                rawCredit: `${rowLabel} | ${columnHeader} | ${cellValue}`,
              });
            }
          }
        }
      }
    }
  }
  return contributions;
}

function parseTablesFromMarkdown(markdown: string): { headers: string[]; rows: string[][] }[] {
  const tree = markdownTree(markdown);
  const tables: { headers: string[]; rows: string[][] }[] = [];
  for (const child of tree.children ?? []) {
    if (child.type !== "table") continue;
    const rows = child.children ?? [];
    if (rows.length === 0) continue;
    const headerCells = (rows[0].children ?? []).map((cell) => cleanText(plainTextFromNode(cell)));
    const bodyRows = rows.slice(1).map((row) => (row.children ?? []).map((cell) => cleanText(plainTextFromNode(cell))));
    tables.push({ headers: headerCells, rows: bodyRows });
  }
  return tables;
}

function parseInstruments(value: string): string[] {
  const normalized = value
    .replace(/など|他|etc\.?/gi, "")
    .replace(/and/gi, "/")
    .replace(/&/g, "/")
    .replace(/,/g, "/")
    .replace(/・/g, "/")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const result: string[] = [];
  for (const token of normalized.split("/")) {
    const key = token.trim().toLowerCase();
    if (!key) continue;

    const multiInstrument = INSTRUMENT_MULTI_ALIASES.get(key);
    if (multiInstrument) {
      for (const instrument of multiInstrument) {
        if (!result.includes(instrument)) result.push(instrument);
      }
      continue;
    }

    const exactInstrument = INSTRUMENT_ALIASES.get(key);
    if (exactInstrument) {
      if (!result.includes(exactInstrument)) result.push(exactInstrument);
      continue;
    }

    for (const [alias, instrument] of INSTRUMENT_ALIASES) {
      if (!key.startsWith(`${alias} `)) continue;
      if (!result.includes(instrument)) result.push(instrument);
      break;
    }
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

export function renderSql(contributions: ContributionSeed[], sourceFiles: string[] | null = null): string {
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
  lines.push("-- Scope: live support member credits, release-level credit tables, and recording-level matrices.");
  lines.push("-- Requires event rows generated by scripts/generate_rawdata_seed_sql.ts --types live.");
  lines.push("-- Requires release rows generated by scripts/generate_rawdata_seed_sql.ts --types release.");
  lines.push(`-- contributions: ${contributions.length}`);
  lines.push("BEGIN;");
  lines.push("");
  lines.push("-- Replace rows owned by this generator so fixed or removed credits do not remain stale.");
  if (sourceFiles == null) {
    lines.push("DELETE FROM contribution");
    lines.push("WHERE notes LIKE E'source_file=%\\nraw_credit=%';");
  } else if (sourceFiles.length > 0) {
    lines.push("DELETE FROM contribution");
    lines.push(
      `WHERE split_part(notes, E'\\n', 1) IN (${sourceFiles.map((file) => sqlText(`source_file=${file}`)).join(", ")})`,
    );
    lines.push("  AND notes LIKE E'source_file=%\\nraw_credit=%';");
  }
  lines.push("DELETE FROM person p");
  lines.push(`WHERE p.description = ${sqlText("source=contribution_seed")}`);
  lines.push("  AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.person_id = p.id)");
  lines.push("  AND NOT EXISTS (SELECT 1 FROM contribution c WHERE c.person_id = p.id)");
  lines.push("  AND NOT EXISTS (SELECT 1 FROM article_mention_person am WHERE am.person_id = p.id);");
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
      const targetId = contribution.target.id;
      const key = `${contribution.target.type}|${targetId}|${contribution.personName}|${contribution.roleName}|${instrument ?? ""}`;
      if (emittedKeys.has(key)) continue;
      emittedKeys.add(key);

      const contributionId = stableUuid("contribution", key);
      const notes = [`source_file=${contribution.source.name}`, `raw_credit=${contribution.rawCredit}`].join("\n");
      const recordingId = contribution.target.type === "recording" ? contribution.target.id : null;
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
      lines.push("    recording_id = EXCLUDED.recording_id,");
      lines.push("    release_id = EXCLUDED.release_id,");
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
  const recordingLookup = await loadRecordingLookupFromTrackSeed(DEFAULT_TRACK_SEED);
  const recordingContributions = await collectRecordingContributions(releaseSources, recordingLookup);
  const contributions = [...liveContributions, ...releaseContributions, ...recordingContributions];
  const sql = renderSql(contributions, args.files == null ? null : [...new Set([...liveSources, ...releaseSources].map((source) => source.name))]);
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, sql, "utf8");
  console.log(`Wrote ${args.output}`);
  console.log(`Live support credits: ${liveContributions.length}`);
  console.log(`Release credits: ${releaseContributions.length}`);
  console.log(`Recording credits: ${recordingContributions.length}`);
}

if (import.meta.main) await main();
