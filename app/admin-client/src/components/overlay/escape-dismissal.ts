import { useEffect, useRef } from 'react';

interface KeydownTarget {
	addEventListener(type: 'keydown', listener: EventListener): void;
	removeEventListener(type: 'keydown', listener: EventListener): void;
}

export interface EscapeDismissalManager {
	register(onClose: () => void): () => void;
	dispose(): void;
}

export function createEscapeDismissalManager(target: KeydownTarget): EscapeDismissalManager {
	const overlays: Array<() => void> = [];
	const handleKeyDown: EventListener = (event) => {
		if (!('key' in event) || event.key !== 'Escape') return;
		const closeTopmost = overlays.at(-1);
		if (!closeTopmost) return;

		event.preventDefault();
		event.stopPropagation();
		closeTopmost();
	};

	target.addEventListener('keydown', handleKeyDown);

	return {
		register(onClose) {
			overlays.push(onClose);
			return () => {
				const index = overlays.lastIndexOf(onClose);
				if (index >= 0) overlays.splice(index, 1);
			};
		},
		dispose() {
			overlays.length = 0;
			target.removeEventListener('keydown', handleKeyDown);
		},
	};
}

let browserManager: EscapeDismissalManager | undefined;

function getBrowserManager(): EscapeDismissalManager | undefined {
	if (typeof document === 'undefined') return undefined;
	browserManager ??= createEscapeDismissalManager(document);
	return browserManager;
}

export function useCloseOnEscape(onClose: () => void): void {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => getBrowserManager()?.register(() => onCloseRef.current()), []);
}
