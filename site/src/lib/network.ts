import { buildEntityHref } from './site-foundation';

export type NetworkNode = {
	id: string;
	type: 'person' | 'project';
	label: string;
	slug: string | null;
	href: string | undefined;
	projectCount: number;
	color?: string;
	muted: boolean;
};

export type NetworkEdge = {
	id: string;
	personId: string;
	projectId: string;
	support: boolean;
	personHref: string | undefined;
	projectHref: string | undefined;
};

export type NetworkModel = { nodes: NetworkNode[]; edges: NetworkEdge[] };

const PROJECT_COLORS = ['#6B7F4F', '#B3823C', '#7E5A83', '#3C7480', '#9A6B1F', '#8B575C', '#667085', '#536D4A'];

export const buildNetworkModel = (
	projects: readonly Record<string, unknown>[],
	people: readonly Record<string, unknown>[],
	memberships: readonly Record<string, unknown>[],
	options: { includeSupport?: boolean } = {},
): NetworkModel => {
	const includeSupport = options.includeSupport ?? true;
	const text = (row: Record<string, unknown>, key: string): string => (typeof row[key] === 'string' ? row[key] : '');
	const projectRows = projects.filter((project) => (text(project, 'scope') || 'monden') === 'monden' && text(project, 'id'));
	const projectIds = new Set(projectRows.map((project) => text(project, 'id')));
	const peopleById = new Map(people.map((person) => [text(person, 'id'), person]));
	const projectById = new Map(projectRows.map((project) => [text(project, 'id'), project]));
	const edges = memberships
		.filter((membership) => {
			const projectId = text(membership, 'projectId');
			return projectIds.has(projectId) && peopleById.has(text(membership, 'personId')) && (includeSupport || membership.support !== true);
		})
		.map((membership) => {
			const personId = text(membership, 'personId');
			const projectId = text(membership, 'projectId');
			const person = peopleById.get(personId);
			const project = projectById.get(projectId);
			return {
				id: `${personId}:${projectId}`,
				personId,
				projectId,
				support: membership.support === true,
				personHref: buildEntityHref('person', text(person ?? {}, 'slug')),
				projectHref: buildEntityHref('project', text(project ?? {}, 'slug')),
			};
		})
		.sort((left, right) => left.personId.localeCompare(right.personId) || left.projectId.localeCompare(right.projectId));
	const projectCountByPerson = new Map<string, number>();
	for (const edge of edges) projectCountByPerson.set(edge.personId, (projectCountByPerson.get(edge.personId) ?? 0) + 1);
	const projectNodes = projectRows
		.map((project, index) => ({
			id: text(project, 'id'),
			type: 'project' as const,
			label: text(project, 'name') || 'プロジェクト未登録',
			slug: text(project, 'slug') || null,
			href: buildEntityHref('project', text(project, 'slug')),
			projectCount: 0,
			color: text(project, 'color') || PROJECT_COLORS[index % PROJECT_COLORS.length],
			muted: false,
		}))
		.sort((left, right) => left.label.localeCompare(right.label, 'ja'));
	const connectedPersonIds = new Set(edges.map((edge) => edge.personId));
	const personNodes = [...peopleById.entries()]
		.filter(([id]) => connectedPersonIds.has(id))
		.map(([id, person]) => ({
			id,
			type: 'person' as const,
			label: text(person, 'name') || '人物未登録',
			slug: text(person, 'slug') || null,
			href: buildEntityHref('person', text(person, 'slug')),
			projectCount: projectCountByPerson.get(id) ?? 0,
			muted: (projectCountByPerson.get(id) ?? 0) < 2,
		}))
		.sort((left, right) => left.label.localeCompare(right.label, 'ja') || left.id.localeCompare(right.id));
	return { nodes: [...projectNodes, ...personNodes], edges };
};
