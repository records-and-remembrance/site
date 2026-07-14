import { spawnSync } from 'node:child_process';

export type ReleaseEnvironment = {
	snapshotGeneratedAt: string;
	publicUrl: string;
};

export type ReleaseCommand = {
	command: string;
	args: string[];
	env?: Record<string, string>;
};

export type ReleaseRunResult = {
	completed: number;
	failed?: {
		command: string;
		args: string[];
		status: number;
	};
};

export type CommandRunner = (command: string, args: readonly string[], env?: Record<string, string>) => number;

function normalizePublicUrl(value: string): string {
	const url = new URL(value);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('SITE_PUBLIC_URL must use http or https');
	url.hash = '';
	url.search = '';
	return url.toString().replace(/\/+$/u, '');
}

export function readReleaseEnvironment(env: Readonly<Record<string, string | undefined>>): ReleaseEnvironment {
	const snapshotGeneratedAt = env.SITE_SNAPSHOT_GENERATED_AT ?? env.SNAPSHOT_GENERATED_AT;
	if (!snapshotGeneratedAt) throw new Error('SITE_SNAPSHOT_GENERATED_AT is required for reproducible site:release');
	if (!env.SITE_PUBLIC_URL) throw new Error('SITE_PUBLIC_URL is required for post-deploy smoke check');

	return { snapshotGeneratedAt, publicUrl: normalizePublicUrl(env.SITE_PUBLIC_URL) };
}

export function buildReleaseCommands(environment: ReleaseEnvironment): ReleaseCommand[] {
	return [
		{ command: 'bun', args: ['site/export/export.ts', '--snapshot-generated-at', environment.snapshotGeneratedAt] },
		{ command: 'bun', args: ['run', 'site:build'] },
		{ command: 'bun', args: ['run', 'site:search:index'] },
		{ command: 'bun', args: ['scripts/site_check.ts'] },
		{ command: 'bun', args: ['run', 'site:deploy'] },
		{ command: 'bun', args: ['scripts/site_smoke_check.ts'], env: { SITE_PUBLIC_URL: environment.publicUrl } },
	];
}

export function runRelease(commands: readonly ReleaseCommand[], run: CommandRunner): ReleaseRunResult {
	let completed = 0;
	for (const command of commands) {
		const status = run(command.command, command.args, command.env);
		if (status !== 0) return { completed, failed: { command: command.command, args: command.args, status } };
		completed += 1;
	}
	return { completed };
}

function runCommand(command: string, args: readonly string[], env?: Record<string, string>): number {
	const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
	return result.status ?? 1;
}

function main(): void {
	const environment = readReleaseEnvironment(Bun.env);
	const result = runRelease(buildReleaseCommands(environment), runCommand);
	if (result.failed) throw new Error(`${result.failed.command} ${result.failed.args.join(' ')} failed with ${result.failed.status}`);
}

if (import.meta.main) main();
