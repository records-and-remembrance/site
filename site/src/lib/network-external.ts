import { buildEntityHref } from './site-foundation';

export type ExternalNetworkProject = {
	id: string;
	label: string;
	slug: string | null;
	href: string | undefined;
	muted: true;
};

export type ExternalNetworkMembership = {
	id: string;
	personId: string;
	personLabel: string;
	personSlug: string | null;
	personHref: string | undefined;
	fromDate?: string;
	toDate?: string;
	support: boolean;
	note?: string;
};

export type ExternalNetworkModel = {
	projectsByPerson: Map<string, ExternalNetworkProject[]>;
	membershipsByProject: Map<string, ExternalNetworkMembership[]>;
};

export const EXTERNAL_NETWORK_SCOPE_GUIDE = 'externalは、mondenの人物から直接つながる主要プロジェクトだけを登録し、人物クリック→projectクリックの2段階までで確認します。';

const text = (row: Record<string, unknown>, key: string): string | undefined => {
	const value = row[key];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const compareText = (left: string | undefined, right: string | undefined): number => (left ?? '').localeCompare(right ?? '', 'ja');

const projectScope = (row: Record<string, unknown>): string => text(row, 'scope') ?? 'monden';

const projectNode = (row: Record<string, unknown>): ExternalNetworkProject | undefined => {
	const id = text(row, 'id');
	const label = text(row, 'name');
	if (!id || !label || projectScope(row) !== 'external') return undefined;
	const slug = text(row, 'slug') ?? null;
	return { id, label, slug, href: buildEntityHref('project', slug), muted: true };
};

export const buildExternalNetworkModel = (
	projects: readonly Record<string, unknown>[],
	people: readonly Record<string, unknown>[],
	memberships: readonly Record<string, unknown>[],
): ExternalNetworkModel => {
	const mondenProjectIds = new Set(
		projects
			.filter((project) => projectScope(project) === 'monden')
			.map((project) => text(project, 'id'))
			.filter((id): id is string => Boolean(id)),
	);
	const peopleById = new Map(people.map((person) => [text(person, 'id'), person]).filter(([id]): id is string => Boolean(id)));
	const externalProjects = projects.map(projectNode).filter((project): project is ExternalNetworkProject => project !== undefined);
	const externalProjectById = new Map(externalProjects.map((project) => [project.id, project]));
	const mondenPersonIds = new Set(
		memberships
			.filter((membership) => mondenProjectIds.has(text(membership, 'projectId') ?? ''))
			.map((membership) => text(membership, 'personId'))
			.filter((id): id is string => Boolean(id) && peopleById.has(id)),
	);
	const externalMembershipRows = memberships.filter((membership) => externalProjectById.has(text(membership, 'projectId') ?? '') && peopleById.has(text(membership, 'personId') ?? ''));
	const membershipsByProject = new Map<string, ExternalNetworkMembership[]>();
	for (const membership of externalMembershipRows) {
		const projectId = text(membership, 'projectId');
		const personId = text(membership, 'personId');
		if (!projectId || !personId) continue;
		const person = peopleById.get(personId) ?? {};
		const membershipId = text(membership, 'id') ?? `${projectId}:${personId}:${text(membership, 'fromDate') ?? ''}`;
		const entry: ExternalNetworkMembership = {
			id: membershipId,
			personId,
			personLabel: text(person, 'name') ?? '人物未登録',
			personSlug: text(person, 'slug') ?? null,
			personHref: buildEntityHref('person', text(person, 'slug')),
			fromDate: text(membership, 'fromDate'),
			toDate: text(membership, 'toDate'),
			support: membership.support === true,
			note: text(membership, 'note'),
		};
		const current = membershipsByProject.get(projectId) ?? [];
		current.push(entry);
		membershipsByProject.set(projectId, current);
	}
	for (const entries of membershipsByProject.values())
		entries.sort((left, right) => compareText(left.personLabel, right.personLabel) || left.personId.localeCompare(right.personId) || left.id.localeCompare(right.id));

	const projectsByPerson = new Map<string, ExternalNetworkProject[]>();
	for (const membership of externalMembershipRows) {
		const personId = text(membership, 'personId');
		const projectId = text(membership, 'projectId');
		const project = projectId ? externalProjectById.get(projectId) : undefined;
		if (!personId || !project || !mondenPersonIds.has(personId)) continue;
		const current = projectsByPerson.get(personId) ?? [];
		if (!current.some((candidate) => candidate.id === project.id)) current.push(project);
		projectsByPerson.set(personId, current);
	}
	for (const entries of projectsByPerson.values()) entries.sort((left, right) => compareText(left.label, right.label) || left.id.localeCompare(right.id));

	return { projectsByPerson, membershipsByProject };
};
