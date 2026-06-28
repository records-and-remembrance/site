import {
  lstatSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";

const LINE_THRESHOLD = 1000;

export function parseNumstat(numstat) {
  return numstat
    .split("\n")
    .filter(Boolean)
    .reduce((total, line) => {
      const [additions, deletions] = line.split("\t", 2);

      if (additions === "-" || deletions === "-") {
        return total;
      }

      return total + Number(additions) + Number(deletions);
    }, 0);
}

export function countChangedLines(repository) {
  const diff = runGit(repository, "diff", "--numstat", "HEAD", "--");
  if (diff === null) {
    return 0;
  }

  return (
    parseNumstat(diff.toString()) +
    countUntrackedTextLines(repository)
  );
}

export function buildHookOutput(changedLines) {
  if (changedLines <= LINE_THRESHOLD) {
    return null;
  }

  return {
    systemMessage:
      `Git差分が${changedLines}行あります（基準: ${LINE_THRESHOLD}行）。` +
      "レビューしやすい単位でコミットすることを推奨します。",
  };
}

function countUntrackedTextLines(repository) {
  const output = runGit(
    repository,
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  );
  if (output === null) {
    return 0;
  }

  return output
    .toString()
    .split("\0")
    .filter(Boolean)
    .reduce((total, relativePath) => {
      const path = resolve(repository, relativePath);

      try {
        if (!lstatSync(path).isFile()) {
          return total;
        }

        const content = readFileSync(path);
        if (content.includes(0)) {
          return total;
        }

        const newlineCount = content.reduce(
          (count, byte) => count + Number(byte === 10),
          0,
        );
        const finalLineCount =
          content.length > 0 && content.at(-1) !== 10 ? 1 : 0;

        return total + newlineCount + finalLineCount;
      } catch {
        return total;
      }
    }, 0);
}

function runGit(repository, ...args) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
  });

  return result.exitCode === 0 ? result.stdout : null;
}

async function main() {
  try {
    const input = JSON.parse(await Bun.stdin.text());
    const repositoryOutput = runGit(input.cwd, "rev-parse", "--show-toplevel");
    if (repositoryOutput === null) {
      return;
    }

    const repository = repositoryOutput.toString().trim();
    const output = buildHookOutput(countChangedLines(repository));
    if (output !== null) {
      process.stdout.write(JSON.stringify(output));
    }
  } catch (error) {
    console.error(`Git差分の確認に失敗しました: ${error.message}`);
  }
}

if (import.meta.main) {
  await main();
}
