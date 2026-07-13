export const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;

export const ARTWORK_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ArtworkContentType = (typeof ARTWORK_CONTENT_TYPES)[number];
export type ArtworkExtension = 'jpg' | 'png' | 'webp';

type ArtworkInputErrorCode = 'ARTWORK_FORMAT_NOT_ALLOWED' | 'ARTWORK_TOO_LARGE' | 'ARTWORK_DIMENSIONS_INVALID';

export class ArtworkInputError extends Error {
	constructor(
		readonly code: ArtworkInputErrorCode,
		message: string,
		readonly status: 400 | 413 = 400,
	) {
		super(message);
	}
}

export interface ArtworkInspection {
	body: Uint8Array;
	contentType: ArtworkContentType;
	extension: ArtworkExtension;
	width: number;
	height: number;
}

export interface ArtworkMetadata {
	artworkUrl: string;
	artworkWidth: number;
	artworkHeight: number;
}

export interface ArtworkStorageInput {
	key: string;
	body: Uint8Array;
	contentType: ArtworkContentType;
}

export interface ArtworkStorageResult {
	key: string;
	url: string;
}

export interface ArtworkStorage {
	put(input: ArtworkStorageInput): Promise<ArtworkStorageResult>;
	delete?(key: string): Promise<void>;
}

export interface R2BucketLike {
	put(key: string, value: Uint8Array, options: { httpMetadata: { contentType: ArtworkContentType } }): Promise<unknown>;
	delete?(key: string): Promise<void>;
}

export type ArtworkFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface FetchArtworkStorageOptions {
	uploadUrl: string;
	publicUrl: string;
	fetchImpl?: ArtworkFetch;
}

export interface ArtworkStorageEnvironment {
	ARTWORK_STORAGE_UPLOAD_URL?: string;
	ARTWORK_PUBLIC_URL?: string;
}

export async function inspectArtwork(file: File): Promise<ArtworkInspection> {
	if (file.size > ARTWORK_MAX_BYTES) {
		throw new ArtworkInputError('ARTWORK_TOO_LARGE', `Artwork must be ${ARTWORK_MAX_BYTES} bytes or smaller`, 413);
	}

	const contentType = parseContentType(file.type);
	const body = new Uint8Array(await file.arrayBuffer());
	const detectedContentType = detectContentType(body);
	if (!detectedContentType || detectedContentType !== contentType) {
		throw new ArtworkInputError('ARTWORK_FORMAT_NOT_ALLOWED', 'Artwork must be a JPEG, PNG, or WebP image');
	}

	const dimensions = readDimensions(body, contentType);
	if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
		throw new ArtworkInputError('ARTWORK_DIMENSIONS_INVALID', 'Artwork dimensions could not be read');
	}

	return {
		body,
		contentType,
		extension: extensionFor(contentType),
		...dimensions,
	};
}

export function createArtworkObjectKey(releaseId: string, extension: ArtworkExtension, uuid: string = crypto.randomUUID()): string {
	return `release-artwork/${releaseId}/${uuid}.${extension}`;
}

export function createR2ArtworkStorage(options: { bucket: R2BucketLike; publicBaseUrl: string }): ArtworkStorage {
	return {
		put: async (input) => {
			await options.bucket.put(input.key, input.body, { httpMetadata: { contentType: input.contentType } });
			return { key: input.key, url: publicArtworkUrl(options.publicBaseUrl, input.key) };
		},
		...(options.bucket.delete ? { delete: (key: string) => options.bucket.delete!(key) } : {}),
	};
}

export function createFetchArtworkStorage(options: FetchArtworkStorageOptions): ArtworkStorage {
	const fetchImpl = options.fetchImpl ?? fetch;
	return {
		put: async (input) => {
			const response = await fetchImpl(uploadArtworkUrl(options.uploadUrl, input.key), {
				method: 'PUT',
				headers: { 'content-type': input.contentType },
				body: input.body as unknown as BodyInit,
			});
			if (!response.ok) throw new Error(`Artwork storage returned ${response.status}`);
			return { key: input.key, url: publicArtworkUrl(options.publicUrl, input.key) };
		},
	};
}

export function createArtworkStorageFromEnv(environment: ArtworkStorageEnvironment = runtimeEnvironment()): ArtworkStorage | undefined {
	const uploadUrl = environment.ARTWORK_STORAGE_UPLOAD_URL?.trim();
	const publicUrl = environment.ARTWORK_PUBLIC_URL?.trim();
	if (!uploadUrl || !publicUrl) return undefined;
	return createFetchArtworkStorage({ uploadUrl, publicUrl });
}

function parseContentType(value: string): ArtworkContentType {
	if ((ARTWORK_CONTENT_TYPES as readonly string[]).includes(value)) return value as ArtworkContentType;
	throw new ArtworkInputError('ARTWORK_FORMAT_NOT_ALLOWED', 'Artwork must be a JPEG, PNG, or WebP image');
}

function extensionFor(contentType: ArtworkContentType): ArtworkExtension {
	if (contentType === 'image/jpeg') return 'jpg';
	if (contentType === 'image/png') return 'png';
	return 'webp';
}

function detectContentType(bytes: Uint8Array): ArtworkContentType | undefined {
	if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
	return undefined;
}

function readDimensions(bytes: Uint8Array, contentType: ArtworkContentType): { width: number; height: number } | undefined {
	if (contentType === 'image/png') return readPngDimensions(bytes);
	if (contentType === 'image/jpeg') return readJpegDimensions(bytes);
	return readWebpDimensions(bytes);
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
	if (bytes.length < 24 || !hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return undefined;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;

	let offset = 2;
	while (offset + 3 < bytes.length) {
		if (bytes[offset] !== 0xff) {
			offset += 1;
			continue;
		}
		while (bytes[offset] === 0xff) offset += 1;
		const marker = bytes[offset];
		if (marker === undefined) return undefined;
		offset += 1;
		if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
		if (offset + 1 >= bytes.length) return undefined;
		const segmentLength = readUint16(bytes, offset);
		if (segmentLength < 2 || offset + segmentLength > bytes.length) return undefined;
		if (isJpegStartOfFrame(marker)) {
			if (segmentLength < 7) return undefined;
			return {
				height: readUint16(bytes, offset + 3),
				width: readUint16(bytes, offset + 5),
			};
		}
		offset += segmentLength;
	}
	return undefined;
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
	if (bytes.length < 20 || !hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) || !hasPrefix(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return undefined;

	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const chunkType = String.fromCharCode(...bytes.subarray(offset, offset + 4));
		const chunkSize = readUint32LittleEndian(bytes, offset + 4);
		const dataOffset = offset + 8;
		if (chunkType === 'VP8X' && chunkSize >= 10 && dataOffset + 10 <= bytes.length) {
			return {
				width: readUint24LittleEndian(bytes, dataOffset + 4) + 1,
				height: readUint24LittleEndian(bytes, dataOffset + 7) + 1,
			};
		}
		if (chunkType === 'VP8 ' && chunkSize >= 10 && dataOffset + 10 <= bytes.length && hasPrefix(bytes.subarray(dataOffset + 3), [0x9d, 0x01, 0x2a])) {
			return {
				width: readUint16LittleEndian(bytes, dataOffset + 6) & 0x3fff,
				height: readUint16LittleEndian(bytes, dataOffset + 8) & 0x3fff,
			};
		}
		if (chunkType === 'VP8L' && chunkSize >= 5 && dataOffset + 5 <= bytes.length && bytes[dataOffset] === 0x2f) {
			const dimensions = bytes[dataOffset + 1]! | (bytes[dataOffset + 2]! << 8) | (bytes[dataOffset + 3]! << 16) | (bytes[dataOffset + 4]! << 24);
			return {
				width: (dimensions & 0x3fff) + 1,
				height: ((dimensions >>> 14) & 0x3fff) + 1,
			};
		}
		offset = dataOffset + chunkSize + (chunkSize % 2);
	}
	return undefined;
}

function isJpegStartOfFrame(marker: number): boolean {
	return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function readUint16(bytes: Uint8Array, offset: number): number {
	return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
	return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
	return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
	return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24);
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
	return prefix.every((value, index) => bytes[index] === value);
}

function uploadArtworkUrl(baseUrl: string, key: string): string {
	return `${baseUrl.replace(/\/$/, '')}/${encodeKey(key)}`;
}

function publicArtworkUrl(baseUrl: string, key: string): string {
	return `${baseUrl.replace(/\/$/, '')}/${encodeKey(key)}`;
}

function encodeKey(key: string): string {
	return key.split('/').map(encodeURIComponent).join('/');
}

function runtimeEnvironment(): ArtworkStorageEnvironment {
	if (typeof Bun === 'undefined') return {};
	return {
		...(Bun.env.ARTWORK_STORAGE_UPLOAD_URL ? { ARTWORK_STORAGE_UPLOAD_URL: Bun.env.ARTWORK_STORAGE_UPLOAD_URL } : {}),
		...(Bun.env.ARTWORK_PUBLIC_URL ? { ARTWORK_PUBLIC_URL: Bun.env.ARTWORK_PUBLIC_URL } : {}),
	};
}
