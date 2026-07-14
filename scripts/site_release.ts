import { spawnSync } from 'node:child_process';

const snapshotGeneratedAt = Bun.env.SITE_SNAPSHOT_GENERATED_AT ?? Bun.env.SNAPSHOT_GENERATED_AT;
if (!snapshotGeneratedAt) throw new Error('SITE_SNAPSHOT_GENERATED_AT is required for reproducible site:release');

const run = (command: string, args: string[]) => {
	const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
	if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
};

run('bun', ['site/export/export.ts', '--snapshot-generated-at', snapshotGeneratedAt]);
run('bun', ['run', 'site:build']);
run('bun', ['run', 'site:search:index']);
run('bun', ['scripts/site_check.ts']);
run('bun', ['run', 'site:deploy']);
