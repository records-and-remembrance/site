import { mkdir, copyFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const DEFAULT_INPUT_DIR = "rawData/articles";
const DEFAULT_OUTPUT_DIR = "rawData/articles_by_category";

type ArticleCategory = {
  tag: string;
  dirName: string;
  files: string[];
};

type CliOptions = {
  inputDir: string;
  outputDir: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputDir: DEFAULT_INPUT_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--input" && next) {
      options.inputDir = next;
      index += 1;
      continue;
    }

    if (arg === "--output" && next) {
      options.outputDir = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return options;
}

function extractFirstTag(markdown: string): string | null {
  const frontMatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) return null;

  const lines = frontMatterMatch[1]!.split(/\r?\n/);
  const tagsIndex = lines.findIndex((line) => line.trim() === "tags:");
  if (tagsIndex < 0) return null;

  for (const line of lines.slice(tagsIndex + 1)) {
    if (/^\S/.test(line)) return null;

    const tagMatch = line.match(/^\s*-\s*(.+?)\s*$/);
    if (tagMatch) {
      return stripYamlQuotes(tagMatch[1]!);
    }
  }

  return null;
}

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function toSafeDirName(tag: string): string {
  return tag
    .trim()
    .replace(/[/:\\?%*"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^\.+$/, "_");
}

function renderIndex(categories: ArticleCategory[], missingTagFiles: string[]): string {
  const lines: string[] = [
    "# articles_by_category",
    "",
    "`rawData/articles/*.md` を front matter の `tags[0]` ごとにコピーした作業用ディレクトリです。",
    "元ファイルは移動していません。",
    "",
    "## Categories",
    "",
    "| tag | directory | files |",
    "| --- | --- | ---: |",
  ];

  for (const category of categories) {
    lines.push(
      `| ${escapeMarkdownCell(category.tag)} | \`${category.dirName}/\` | ${category.files.length} |`,
    );
  }

  if (missingTagFiles.length > 0) {
    lines.push("", "## Missing Tags", "");
    for (const file of missingTagFiles) {
      lines.push(`- \`${file}\``);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const options = parseArgs(Bun.argv.slice(2));
  const entries = await readdir(options.inputDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const categoriesByTag = new Map<string, ArticleCategory>();
  const missingTagFiles: string[] = [];

  await mkdir(options.outputDir, { recursive: true });

  for (const fileName of markdownFiles) {
    const sourcePath = join(options.inputDir, fileName);
    const markdown = await Bun.file(sourcePath).text();
    const firstTag = extractFirstTag(markdown);

    if (!firstTag) {
      missingTagFiles.push(fileName);
      continue;
    }

    const dirName = toSafeDirName(firstTag);
    const category =
      categoriesByTag.get(firstTag) ?? {
        tag: firstTag,
        dirName,
        files: [],
      };

    category.files.push(fileName);
    categoriesByTag.set(firstTag, category);

    const outputDir = join(options.outputDir, dirName);
    await mkdir(outputDir, { recursive: true });
    await copyFile(sourcePath, join(outputDir, basename(fileName)));
  }

  const categories = [...categoriesByTag.values()].sort((a, b) => {
    const countDiff = b.files.length - a.files.length;
    return countDiff !== 0 ? countDiff : a.tag.localeCompare(b.tag);
  });

  await writeFile(
    join(options.outputDir, "README.md"),
    renderIndex(categories, missingTagFiles),
    "utf-8",
  );

  console.log(`input: ${options.inputDir}`);
  console.log(`output: ${options.outputDir}`);
  console.log(`files: ${markdownFiles.length}`);
  for (const category of categories) {
    console.log(`${category.files.length.toString().padStart(3)}  ${category.tag} -> ${category.dirName}/`);
  }
  if (missingTagFiles.length > 0) {
    console.log(`missing tags: ${missingTagFiles.length}`);
  }
}

await main();
