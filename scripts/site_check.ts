import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export type SiteCheckResult = { files: string[]; brokenLinks: string[]; forbiddenRequests: string[] };

export const checkSiteArtifacts = (distRoot: string): SiteCheckResult => {
	const required = [
		'index.html',
		'404.html',
		'about/index.html',
		'discography/index.html',
		'lives/index.html',
		'people/index.html',
		'projects/index.html',
		'songs/index.html',
		'venues/index.html',
		'network/index.html',
		'timeline/index.html',
		'library/index.html',
		'search/index.html',
		'pagefind/pagefind.js',
	];
	const files = required.filter((file) => existsSync(join(distRoot, file)));
	const brokenLinks: string[] = required.filter((file) => !existsSync(join(distRoot, file)));
	const forbiddenRequests: string[] = [];
	const htmlFiles = walk(distRoot).filter((file) => file.endsWith('.html'));
	for (const file of htmlFiles) {
		const html = readFileSync(file, 'utf8');
		if (/postgres|\/api\//u.test(html)) forbiddenRequests.push(relative(distRoot, file));
		for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)/gu)) {
			const path = match[1];
			if (!path || path.startsWith('/_astro/') || path.startsWith('/pagefind/') || path === '/favicon.svg') continue;
			const target = path === '/' ? 'index.html' : `${path.replace(/^\//u, '').replace(/\/$/u, '')}/index.html`;
			if (!existsSync(join(distRoot, target))) brokenLinks.push(`${relative(distRoot, file)} -> ${path}`);
		}
	}
	return { files, brokenLinks: [...new Set(brokenLinks)], forbiddenRequests };
};

export const assertSiteArtifacts = (distRoot: string): SiteCheckResult => {
	const result = checkSiteArtifacts(distRoot);
	if (result.brokenLinks.length > 0 || result.forbiddenRequests.length > 0) throw new Error(`site artifact check failed: ${JSON.stringify(result)}`);
	return result;
};

function walk(root: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = join(root, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else files.push(path);
	}
	return files;
}

if (import.meta.main) {
	const result = assertSiteArtifacts(join(process.cwd(), 'site/dist'));
	console.log(`site artifacts ok: ${result.files.length} required files`);
}
