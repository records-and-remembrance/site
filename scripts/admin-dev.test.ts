import { expect, test } from 'bun:test';
import packageJson from '../package.json';

test('admin dev script starts the managed API and Vite processes', async () => {
	expect(packageJson.scripts['admin:dev']).toBe('bun scripts/admin-dev.ts');

	const module = await import('./admin-dev');
	expect(module.adminDevCommands).toEqual([
		['bun', 'run', 'admin:server'],
		['bun', 'run', 'admin:client'],
	]);
});
