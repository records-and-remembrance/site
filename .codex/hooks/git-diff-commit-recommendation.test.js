import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHookOutput,
  countChangedLines,
  parseNumstat,
} from "./git-diff-commit-recommendation.js";

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("parseNumstat", () => {
  test("追加・削除行を合計し、バイナリファイルを除外する", () => {
    const numstat =
      "10\t3\ttracked.txt\n-\t-\timage.png\n2\t1\trenamed.txt\n";

    expect(parseNumstat(numstat)).toBe(16);
  });
});

describe("countChangedLines", () => {
  test("追跡対象の差分と未追跡テキストを数える", () => {
    const repository = mkdtempSync(join(tmpdir(), "codex-hook-test-"));
    temporaryDirectories.push(repository);

    runGit(repository, "init");
    runGit(repository, "config", "user.email", "test@example.com");
    runGit(repository, "config", "user.name", "Test User");

    const trackedPath = join(repository, "tracked.txt");
    writeFileSync(trackedPath, "one\ntwo\nthree\n");
    runGit(repository, "add", "tracked.txt");
    runGit(repository, "commit", "-m", "initial");

    writeFileSync(trackedPath, "one\ntwo\nthree\nfour\nfive\n");
    writeFileSync(join(repository, "untracked.txt"), "alpha\nbeta\ngamma");
    writeFileSync(join(repository, "binary.dat"), Buffer.from([0, 1, 2]));

    expect(countChangedLines(repository)).toBe(5);
  });
});

describe("buildHookOutput", () => {
  test("1000行を超えた場合だけコミットを推奨する", () => {
    expect(buildHookOutput(1000)).toBeNull();
    expect(buildHookOutput(1001)).toEqual({
      systemMessage:
        "Git差分が1001行あります（基準: 1000行）。" +
        "レビューしやすい単位でコミットすることを推奨します。",
    });
  });
});

function runGit(repository, ...args) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
}
