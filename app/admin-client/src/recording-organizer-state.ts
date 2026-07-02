import type { RecordingGroup, RecordingOrganizerDetail, RecordingOrganizerListItem } from '../../recording-organizer/types';

export function completeSourceRecordingIds(detail: RecordingOrganizerDetail, selectedTrackIds: ReadonlySet<string>, targetRecordingId: string): string[] {
	const target = detail.groups.find((group) => group.id === targetRecordingId);
	if (target?.tracks.some((track) => selectedTrackIds.has(track.id))) return [];
	const selectedGroups = detail.groups.filter((group) => group.id !== targetRecordingId).filter((group) => group.tracks.some((track) => selectedTrackIds.has(track.id)));
	if (selectedGroups.some((group) => group.tracks.length === 0 || group.tracks.some((track) => !selectedTrackIds.has(track.id)))) {
		return [];
	}
	return selectedGroups.map((group) => group.id);
}

export function splitSourceRecording(detail: RecordingOrganizerDetail, selectedTrackIds: ReadonlySet<string>): RecordingGroup | null {
	const groups = detail.groups.filter((group) => group.tracks.some((track) => selectedTrackIds.has(track.id)));
	if (groups.length !== 1) return null;
	const group = groups[0]!;
	const count = group.tracks.filter((track) => selectedTrackIds.has(track.id)).length;
	return count > 0 && count < group.tracks.length ? group : null;
}

export function nextPendingCompositionId(items: RecordingOrganizerListItem[], currentId: string | undefined): string | null {
	const pending = items.filter((item) => item.status === 'pending');
	if (pending.length === 0) return null;
	const currentIndex = pending.findIndex((item) => item.id === currentId);
	return pending[(currentIndex + 1) % pending.length]?.id ?? null;
}
