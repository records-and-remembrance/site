import type { APIRoute } from 'astro';
import { siteData } from '../data';
import { buildDigCandidates } from '../lib/dig';

/**
 * Digの候補インデックス（設計書 §2 / §5）。
 * 初期表示の3枚はビルド時に描画済みなので、再抽選を押したときだけ取りに行く。
 * ホームのHTMLへ全候補を埋め込むと、それだけで100KB近くを初回ロードに載せてしまう。
 */
export const GET: APIRoute = () =>
	new Response(JSON.stringify(buildDigCandidates(siteData)), {
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
