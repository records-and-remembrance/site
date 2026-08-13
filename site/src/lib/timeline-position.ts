const day = (value: string): number => {
	const [year, month = 1, date = 1] = value.split('-').map(Number);
	return Date.UTC(year, month - 1, date);
};

export const buildTimelinePosition = (from: string | undefined | null, rangeStart: string, rangeEnd: string, to?: string | null): { left: number; width: number } => {
	const start = day(rangeStart);
	const end = Math.max(start + 1, day(rangeEnd));
	const left = Math.min(100, Math.max(0, ((day(from || rangeStart) - start) / (end - start)) * 100));
	const right = Math.min(100, Math.max(left, ((day(to || rangeEnd) - start) / (end - start)) * 100));
	return { left: Number(left.toFixed(2)), width: Number(Math.max(1, right - left).toFixed(2)) };
};
