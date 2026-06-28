export const adminDevCommands = [
  ["bun", "run", "admin:server"],
  ["bun", "run", "admin:client"],
] as const;

if (import.meta.main) {
  const children = adminDevCommands.map((command) =>
    Bun.spawn([...command], {
      cwd: import.meta.dir + "/..",
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );

  const stopChildren = (signal: NodeJS.Signals = "SIGTERM") => {
    for (const child of children) {
      if (!child.killed) child.kill(signal);
    }
  };

  process.once("SIGINT", () => stopChildren("SIGINT"));
  process.once("SIGTERM", () => stopChildren("SIGTERM"));

  const result = await Promise.race(
    children.map(async (child) => ({ child, exitCode: await child.exited })),
  );
  stopChildren();
  await Promise.all(children.map((child) => child.exited));

  if (result.exitCode !== 0 && result.exitCode !== 130 && result.exitCode !== 143) {
    process.exitCode = result.exitCode;
  }
}
