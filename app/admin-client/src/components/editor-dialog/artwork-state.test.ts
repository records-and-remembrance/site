import { describe, expect, test } from 'bun:test';
import { artworkUploadFailed, artworkUploadStarted, artworkUploadSucceeded, initialArtworkState } from './artwork-state';

describe('release artwork upload state', () => {
	test('represents an upload in progress without losing the existing artwork', () => {
		const existing = initialArtworkState({ artworkUrl: 'https://cdn.example/old.jpg', artworkWidth: 800, artworkHeight: 600 });

		expect(artworkUploadStarted(existing)).toEqual({
			status: 'uploading',
			url: 'https://cdn.example/old.jpg',
			width: 800,
			height: 600,
			message: null,
		});
	});

	test('replaces all artwork metadata together after a successful upload', () => {
		const existing = initialArtworkState({ artworkUrl: 'https://cdn.example/old.jpg', artworkWidth: 800, artworkHeight: 600 });

		expect(
			artworkUploadSucceeded(existing, {
				artworkUrl: 'https://cdn.example/new.png',
				artworkWidth: 1200,
				artworkHeight: 1200,
			}),
		).toEqual({
			status: 'success',
			url: 'https://cdn.example/new.png',
			width: 1200,
			height: 1200,
			message: null,
		});
	});

	test('keeps the current artwork visible and exposes a recoverable failure', () => {
		const existing = artworkUploadStarted(initialArtworkState({ artworkUrl: 'https://cdn.example/old.jpg', artworkWidth: 800, artworkHeight: 600 }));

		expect(artworkUploadFailed(existing, '画像を保存できませんでした')).toEqual({
			status: 'error',
			url: 'https://cdn.example/old.jpg',
			width: 800,
			height: 600,
			message: '画像を保存できませんでした',
		});
	});
});
