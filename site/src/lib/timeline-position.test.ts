import { describe, expect, test } from 'bun:test';
import { buildTimelinePosition } from './timeline-position';

describe('timeline position', () => {
	test('期間を0〜100の位置へ変換し、未終了期間を終端まで伸ばす', () => {
		expect(buildTimelinePosition('2005-01-01', '2000-01-01', '2010-01-01', undefined).left).toBeCloseTo(50, 1);
		expect(buildTimelinePosition('2005-01-01', '2000-01-01', '2010-01-01', undefined).width).toBeCloseTo(50, 1);
		expect(buildTimelinePosition('2002-01-01', '2000-01-01', '2010-01-01', '2004-01-01').left).toBeCloseTo(20, 1);
		expect(buildTimelinePosition('2002-01-01', '2000-01-01', '2010-01-01', '2004-01-01').width).toBeCloseTo(20, 1);
	});
});
