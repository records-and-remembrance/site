import { useState } from 'react';
import { Label } from 'react-aria-components';
import { AdminApiError, uploadReleaseArtwork } from '../../api';
import { artworkUploadFailed, artworkUploadStarted, artworkUploadSucceeded, type ArtworkUploadState } from './artwork-state';

interface ArtworkFieldProps {
	releaseId: string;
	state: ArtworkUploadState;
	onStateChange: (state: ArtworkUploadState) => void;
}

export function ArtworkField({ releaseId, state, onStateChange }: ArtworkFieldProps) {
	const [selectedFileName, setSelectedFileName] = useState('');
	const isUploading = state.status === 'uploading';

	const handleFileChange = async (file: File | undefined) => {
		if (!file || !releaseId || isUploading) return;
		setSelectedFileName(file.name);
		onStateChange(artworkUploadStarted(state));
		try {
			const saved = await uploadReleaseArtwork(releaseId, file);
			onStateChange(artworkUploadSucceeded(state, saved));
		} catch (error) {
			const message = error instanceof AdminApiError ? error.message : error instanceof Error ? error.message : '画像を保存できませんでした';
			onStateChange(artworkUploadFailed(state, message));
		}
	};

	return (
		<div className="field artwork-field">
			<Label>ジャケット画像</Label>
			{state.url && state.width && state.height ? <img src={state.url} alt="ジャケット画像" width={state.width} height={state.height} loading="lazy" /> : <p className="muted">画像未登録</p>}
			{releaseId ? (
				<label>
					<span className="button secondary">{isUploading ? 'アップロード中…' : '画像を選択'}</span>
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp"
						disabled={isUploading}
						aria-label="ジャケット画像を選択"
						onChange={(event) => void handleFileChange(event.currentTarget.files?.[0])}
					/>
				</label>
			) : (
				<p className="muted">リリースを保存してから画像を登録できます</p>
			)}
			{selectedFileName ? <small className="muted">{selectedFileName}</small> : null}
			{state.status === 'error' && state.message ? (
				<span className="field-error" role="alert">
					{state.message}
				</span>
			) : null}
		</div>
	);
}
