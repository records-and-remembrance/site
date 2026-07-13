export interface ArtworkUploadState {
	status: 'idle' | 'uploading' | 'success' | 'error';
	url: string | null;
	width: number | null;
	height: number | null;
	message: string | null;
}

export function initialArtworkState(record: Record<string, unknown> | undefined): ArtworkUploadState {
	return {
		status: 'idle',
		url: nullableString(record?.artworkUrl),
		width: positiveInteger(record?.artworkWidth),
		height: positiveInteger(record?.artworkHeight),
		message: null,
	};
}

export function artworkUploadStarted(state: ArtworkUploadState): ArtworkUploadState {
	return { ...state, status: 'uploading', message: null };
}

export function artworkUploadSucceeded(state: ArtworkUploadState, record: Record<string, unknown>): ArtworkUploadState {
	return {
		status: 'success',
		url: nullableString(record.artworkUrl),
		width: positiveInteger(record.artworkWidth),
		height: positiveInteger(record.artworkHeight),
		message: null,
	};
}

export function artworkUploadFailed(state: ArtworkUploadState, message: string): ArtworkUploadState {
	return { ...state, status: 'error', message };
}

function nullableString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function positiveInteger(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}
