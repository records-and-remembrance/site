import type { APIRoute } from 'astro';
import { siteData } from '../data';

/**
 * 「この日なんの日」用の MM-DD インデックス（設計書 §4.1 / §5）。
 * 閲覧日はビルド時に決まらないため、ホームのHTMLへ全件を埋め込まず、
 * ホームを開いたときだけこの静的JSONを引く。DBアクセスは発生しない。
 */
export const GET: APIRoute = () =>
	new Response(JSON.stringify(siteData.indexes.monthDay), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
