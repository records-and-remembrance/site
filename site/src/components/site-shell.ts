export type Theme = 'light' | 'dark' | 'system';

export type NavigationItem = {
	readonly href: string;
	readonly label: string;
	readonly pending?: boolean;
};

export const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
	{ href: '/timeline', label: '年表' },
	{ href: '/projects', label: 'プロジェクト' },
	{ href: '/discography', label: '作品' },
	{ href: '/songs', label: '楽曲' },
	{ href: '/lives', label: 'ライブ' },
	{ href: '/venues', label: '会場' },
	{ href: '/people', label: '人物' },
	{ href: '/network', label: '人物相関' },
	{ href: '/library', label: '資料室' },
];

export const THEME_STORAGE_KEY = 'monden-theme';

export const normalizePath = (value: string): string => {
	const path = value.split(/[?#]/u, 1)[0] ?? '';
	const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
	return withLeadingSlash.replace(/\/{2,}/gu, '/').replace(/\/$/u, '') || '/';
};

export const isNavigationItemActive = (href: string, currentPath: string): boolean => {
	if (href.includes('#')) return false;

	const targetPath = normalizePath(href);
	const path = normalizePath(currentPath);
	return targetPath === '/' ? path === '/' : path === targetPath || path.startsWith(`${targetPath}/`);
};

export const resolveStoredTheme = (value: string | null): Theme => {
	if (value === 'light' || value === 'dark' || value === 'system') return value;
	return 'system';
};

export const themeAttribute = (theme: Theme): 'light' | 'dark' | undefined => (theme === 'system' ? undefined : theme);

export const nextTheme = (theme: Theme): Exclude<Theme, 'system'> => (theme === 'system' || theme === 'dark' ? 'light' : 'dark');
