export const adminResources = [
	'people',
	'projects',
	'works',
	'work-projects',
	'events',
	'compositions',
	'composition-credits',
	'articles',
	'contributions',
	'memberships',
	'membership-roles',
	'releases',
	'label-relations',
	'recordings',
	'tracks',
	'event-performances',
	'publication-issues',
	'article-mentions',
	'venues',
	'roles',
	'instruments',
	'labels',
	'distributors',
	'publications',
] as const;

export const lookupResources = [
	'project',
	'person',
	'composition',
	'work',
	'release',
	'recording',
	'event',
	'publication-issue',
	'venue',
	'role',
	'instrument',
	'label',
	'distributor',
	'publication',
] as const;

export type AdminResource = (typeof adminResources)[number];
export type LookupResource = (typeof lookupResources)[number];

export type SortDirection = 'asc' | 'desc';

export interface AdminListQuery {
	search: string;
	page: number;
	pageSize: number;
	sort?: string | undefined;
	direction: SortDirection;
}

export interface AdminListResult {
	items: Array<Record<string, unknown>>;
	total: number;
}

export interface LookupOption {
	id: string;
	label: string;
	description?: string | null;
}

export interface AdminRepository {
	list(resource: AdminResource, query: AdminListQuery): Promise<AdminListResult>;
	detail(resource: AdminResource, id: string): Promise<Record<string, unknown> | null>;
	create(resource: AdminResource, value: Record<string, unknown>): Promise<Record<string, unknown>>;
	update(resource: AdminResource, id: string, value: Record<string, unknown>): Promise<Record<string, unknown> | null>;
	lookup(resource: LookupResource, search: string): Promise<LookupOption[]>;
}
