import { describe, expect, test } from 'bun:test';
import { createEscapeDismissalManager } from './escape-dismissal';

function keydown(key: string): Event {
	return Object.assign(new Event('keydown', { cancelable: true }), { key });
}

describe('overlay escape dismissal', () => {
	test('Escape closes only the topmost Dialog or Drawer', () => {
		const target = new EventTarget();
		const manager = createEscapeDismissalManager(target);
		const closed: string[] = [];
		const unregisterDrawer = manager.register(() => closed.push('drawer'));
		const unregisterDialog = manager.register(() => closed.push('dialog'));

		target.dispatchEvent(keydown('Escape'));
		expect(closed).toEqual(['dialog']);

		unregisterDialog();
		target.dispatchEvent(keydown('Escape'));
		expect(closed).toEqual(['dialog', 'drawer']);

		unregisterDrawer();
		manager.dispose();
	});

	test('keys other than Escape do not close an overlay', () => {
		const target = new EventTarget();
		const manager = createEscapeDismissalManager(target);
		let closeCount = 0;
		manager.register(() => closeCount++);

		target.dispatchEvent(keydown('Enter'));
		expect(closeCount).toBe(0);

		manager.dispose();
	});
});
