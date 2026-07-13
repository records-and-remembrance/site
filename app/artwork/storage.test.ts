import { describe, expect, test } from 'bun:test';
import { ARTWORK_MAX_BYTES, createFetchArtworkStorage, createR2ArtworkStorage, inspectArtwork } from './storage';

const pngFixture = (width: number, height: number) => {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes.set([0, 0, 0, 13], 8);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12);
	new DataView(bytes.buffer).setUint32(16, width);
	new DataView(bytes.buffer).setUint32(20, height);
	return bytes;
};

const jpegFixture = (width: number, height: number) =>
	new Uint8Array([
		0xff,
		0xd8,
		0xff,
		0xc0,
		0x00,
		0x11,
		0x08,
		(height >> 8) & 0xff,
		height & 0xff,
		(width >> 8) & 0xff,
		width & 0xff,
		0x03,
		0x01,
		0x11,
		0x00,
		0x02,
		0x11,
		0x00,
		0x03,
		0x11,
		0x00,
		0xff,
		0xd9,
	]);

const webpFixture = (width: number, height: number) => {
	const bytes = new Uint8Array(32);
	bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	bytes[24] = (width - 1) & 0xff;
	bytes[25] = ((width - 1) >> 8) & 0xff;
	bytes[26] = ((width - 1) >> 16) & 0xff;
	bytes[27] = (height - 1) & 0xff;
	bytes[28] = ((height - 1) >> 8) & 0xff;
	bytes[29] = ((height - 1) >> 16) & 0xff;
	return bytes;
};

const webpLossyFixture = (width: number, height: number) => {
	const bytes = new Uint8Array(30);
	bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	bytes.set([0x9d, 0x01, 0x2a], 23);
	new DataView(bytes.buffer).setUint16(26, width, true);
	new DataView(bytes.buffer).setUint16(28, height, true);
	return bytes;
};

const webpLosslessFixture = (width: number, height: number) => {
	const bytes = new Uint8Array(25);
	bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x05, 0, 0, 0, 0x2f], 0);
	const dimensions = (width - 1) | ((height - 1) << 14);
	new DataView(bytes.buffer).setUint32(21, dimensions, true);
	return bytes;
};

describe('artwork storage contract', () => {
	test('extracts dimensions for landscape, portrait, and square artwork', async () => {
		await expect(inspectArtwork(new File([pngFixture(1200, 800)], 'landscape.png', { type: 'image/png' }))).resolves.toMatchObject({
			contentType: 'image/png',
			width: 1200,
			height: 800,
			extension: 'png',
		});
		await expect(inspectArtwork(new File([jpegFixture(800, 1200)], 'portrait.jpg', { type: 'image/jpeg' }))).resolves.toMatchObject({
			contentType: 'image/jpeg',
			width: 800,
			height: 1200,
			extension: 'jpg',
		});
		await expect(inspectArtwork(new File([webpFixture(1000, 1000)], 'square.webp', { type: 'image/webp' }))).resolves.toMatchObject({
			contentType: 'image/webp',
			width: 1000,
			height: 1000,
			extension: 'webp',
		});
		await expect(inspectArtwork(new File([webpLossyFixture(640, 480)], 'lossy.webp', { type: 'image/webp' }))).resolves.toMatchObject({ width: 640, height: 480 });
		await expect(inspectArtwork(new File([webpLosslessFixture(320, 240)], 'lossless.webp', { type: 'image/webp' }))).resolves.toMatchObject({ width: 320, height: 240 });
	});

	test('rejects an unsupported format before storage', async () => {
		await expect(inspectArtwork(new File(['not an image'], 'cover.gif', { type: 'image/gif' }))).rejects.toMatchObject({ code: 'ARTWORK_FORMAT_NOT_ALLOWED' });
	});

	test('rejects artwork over the byte limit', async () => {
		await expect(inspectArtwork(new File([new Uint8Array(ARTWORK_MAX_BYTES + 1)], 'huge.png', { type: 'image/png' }))).rejects.toMatchObject({
			code: 'ARTWORK_TOO_LARGE',
		});
	});

	test('rejects a valid format whose dimensions cannot be read', async () => {
		await expect(inspectArtwork(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'broken.png', { type: 'image/png' }))).rejects.toMatchObject({
			code: 'ARTWORK_DIMENSIONS_INVALID',
		});
	});

	test('uses an injected fetch implementation for the environment-backed adapter', async () => {
		const requests: Array<{ url: string; method: string | undefined; contentType: string | null; body: unknown }> = [];
		const storage = createFetchArtworkStorage({
			uploadUrl: 'https://upload.example/artwork',
			publicUrl: 'https://cdn.example/artwork',
			fetchImpl: async (input, init) => {
				requests.push({
					url: String(input),
					method: init?.method,
					contentType: new Headers(init?.headers).get('content-type'),
					body: init?.body,
				});
				return new Response(null, { status: 201 });
			},
		});

		await expect(storage.put({ key: 'release-artwork/release-1/cover.png', body: new Uint8Array([1, 2, 3]), contentType: 'image/png' })).resolves.toEqual({
			key: 'release-artwork/release-1/cover.png',
			url: 'https://cdn.example/artwork/release-artwork/release-1/cover.png',
		});
		expect(requests[0]).toMatchObject({
			url: 'https://upload.example/artwork/release-artwork/release-1/cover.png',
			method: 'PUT',
			contentType: 'image/png',
		});
	});

	test('uses an injected R2 binding and public URL without a global bucket reference', async () => {
		const calls: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
		const storage = createR2ArtworkStorage({
			publicBaseUrl: 'https://cdn.example/artwork',
			bucket: {
				put: async (key, body, options) => {
					calls.push({ key, body, contentType: options.httpMetadata.contentType });
				},
			},
		});

		await storage.put({ key: 'release-artwork/release-1/cover.webp', body: new Uint8Array([4, 5]), contentType: 'image/webp' });
		expect(calls).toEqual([{ key: 'release-artwork/release-1/cover.webp', body: new Uint8Array([4, 5]), contentType: 'image/webp' }]);
	});
});
