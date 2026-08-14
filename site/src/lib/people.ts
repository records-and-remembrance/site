import { buildEntityHref, type DatePrecision } from './site-foundation';
import { projectColorToken } from './home';

export type SiteRow = Record<string, unknown>;

export type PeopleListItem = {
	name: string;
	slug: string | null;
	description: string;
	href: string | undefined;
};

export type ActivityPeriod = {
	from: string | null;
	fromPrecision: DatePrecision;
	to: string | null;
	toPrecision: DatePrecision;
	fromDerived: boolean;
	toDerived: boolean;
};

export type MembershipView = {
	projectName: string;
	projectHref: string | undefined;
	fromDate: string | null;
	fromDatePrecision: DatePrecision;
	toDate: string | null;
	toDatePrecision: DatePrecision;
	support: boolean;
	roles: string[];
	projectColor: string;
};

export type CreditView = {
	label: string;
	href: string | undefined;
	typeLabel: string;
	orderIndex: number;
};

export type ContributionView = {
	label: string;
	href: string | undefined;
	date: string | null;
	roleLabel: string;
	instrumentLabel: string;
};

export type CoPerformerView = {
	name: string;
	href: string | undefined;
	reasons: string[];
};

export type RoleSummary = { label: string; count: number };

export type PersonPageModel = {
	name: string;
	slug: string | null;
	description: string;
	activityPeriod: ActivityPeriod;
	memberships: MembershipView[];
	credits: CreditView[];
	contributions: {
		releases: ContributionView[];
		events: ContributionView[];
		recordings: ContributionView[];
	};
	coPerformers: CoPerformerView[];
	roleSummary: RoleSummary[];
};

type Candidate = { value: string; precision: DatePrecision };

export const buildPeopleList = (rows: readonly SiteRow[]): PeopleListItem[] =>
	rows
		.map((person) => {
			const slug = optionalString(person.slug);
			return {
				name: stringValue(person.name) || '名称未設定',
				slug,
				description: stringValue(person.description),
				href: buildEntityHref('person', slug),
			};
		})
		.sort((left, right) => left.name.localeCompare(right.name, 'ja'));

export const deriveActivityPeriod = (person: SiteRow, memberships: readonly SiteRow[], contributions: readonly SiteRow[], releases: readonly SiteRow[], events: readonly SiteRow[]): ActivityPeriod => {
	const explicitFrom = optionalString(person.activeFrom);
	const explicitTo = optionalString(person.activeTo);
	const releaseById = new Map(releases.map((release) => [stringValue(release.id), release]));
	const eventById = new Map(events.map((event) => [stringValue(event.id), event]));
	const points: Candidate[] = contributions.flatMap((contribution) => {
		const release = releaseById.get(stringValue(contribution.releaseId));
		const event = eventById.get(stringValue(contribution.eventId));
		const date = optionalString(release?.releaseDate) ?? optionalString(event?.eventDate);
		return date ? [{ value: date, precision: 'day' as const }] : [];
	});
	const fromCandidates = memberships.flatMap((membership) => {
		const value = optionalString(membership.fromDate);
		return value ? [{ value, precision: precisionValue(membership.fromDatePrecision) }] : [];
	});
	const toCandidates = memberships.flatMap((membership) => {
		const value = optionalString(membership.toDate);
		return value ? [{ value, precision: precisionValue(membership.toDatePrecision) }] : [];
	});
	const derivedFrom = minCandidate([...fromCandidates, ...points]);
	const derivedTo = maxCandidate([...toCandidates, ...points]);
	return {
		from: explicitFrom ?? derivedFrom?.value ?? null,
		fromPrecision: explicitFrom ? null : (derivedFrom?.precision ?? null),
		to: explicitTo ?? derivedTo?.value ?? null,
		toPrecision: explicitTo ? null : (derivedTo?.precision ?? null),
		fromDerived: !explicitFrom && Boolean(derivedFrom),
		toDerived: !explicitTo && Boolean(derivedTo),
	};
};

export const buildPersonPageModel = (input: {
	person: SiteRow;
	people: readonly SiteRow[];
	projects: readonly SiteRow[];
	memberships: readonly SiteRow[];
	membershipRoles: readonly SiteRow[];
	roles: readonly SiteRow[];
	instruments: readonly SiteRow[];
	compositions: readonly SiteRow[];
	compositionCredits: readonly SiteRow[];
	releases: readonly SiteRow[];
	works: readonly SiteRow[];
	recordings: readonly SiteRow[];
	events: readonly SiteRow[];
	contributions: readonly SiteRow[];
}): PersonPageModel => {
	const { person, people, projects, memberships, membershipRoles, roles, instruments, compositions, compositionCredits, releases, works, recordings, events, contributions } = input;
	const personId = stringValue(person.id);
	const projectById = new Map(projects.map((project) => [stringValue(project.id), project]));
	const roleById = new Map(roles.map((role) => [stringValue(role.id), role]));
	const instrumentById = new Map(instruments.map((instrument) => [stringValue(instrument.id), instrument]));
	const compositionById = new Map(compositions.map((composition) => [stringValue(composition.id), composition]));
	const releaseById = new Map(releases.map((release) => [stringValue(release.id), release]));
	const workById = new Map(works.map((work) => [stringValue(work.id), work]));
	const recordingById = new Map(recordings.map((recording) => [stringValue(recording.id), recording]));
	const eventById = new Map(events.map((event) => [stringValue(event.id), event]));
	const publicProject = (project: SiteRow | undefined): boolean => Boolean(project) && stringValue(project?.scope) !== 'external';
	const personMemberships = memberships.filter((membership) => stringValue(membership.personId) === personId && publicProject(projectById.get(stringValue(membership.projectId))));
	const personContributions = contributions.filter((contribution) => stringValue(contribution.personId) === personId);

	const membershipViews = personMemberships
		.map((membership) => {
			const project = projectById.get(stringValue(membership.projectId));
			const membershipRoleLabels = membershipsRoles(membership, membershipRoles, roleById, instrumentById);
			return {
				projectName: stringValue(project?.name) || 'プロジェクト未設定',
				projectHref: buildEntityHref('project', optionalString(project?.slug)),
				fromDate: optionalString(membership.fromDate),
				fromDatePrecision: precisionValue(membership.fromDatePrecision),
				toDate: optionalString(membership.toDate),
				toDatePrecision: precisionValue(membership.toDatePrecision),
				support: membership.support === true,
				roles: membershipRoleLabels,
				projectColor: projectColorToken(optionalString(project?.slug) ?? undefined),
			};
		})
		.sort((left, right) => `${left.fromDate ?? ''}:${left.projectName}`.localeCompare(`${right.fromDate ?? ''}:${right.projectName}`, 'ja'));

	const credits = compositionCredits
		.filter((credit) => stringValue(credit.personId) === personId)
		.map((credit) => {
			const composition = compositionById.get(stringValue(credit.compositionId));
			if (!composition) return undefined;
			const typeLabel = stringValue(credit.creditType) === 'composer' ? '作曲' : stringValue(credit.creditType) === 'lyricist' ? '作詞' : stringValue(credit.creditType) || 'クレジット';
			return {
				label: stringValue(composition.title) || '楽曲未設定',
				href: buildEntityHref('composition', optionalString(composition.slug)),
				typeLabel,
				orderIndex: numberValue(credit.orderIndex),
			};
		})
		.filter((credit): credit is CreditView => Boolean(credit))
		.sort((left, right) => `${left.typeLabel}:${left.orderIndex}:${left.label}`.localeCompare(`${right.typeLabel}:${right.orderIndex}:${right.label}`, 'ja'));

	const contributionViews = personContributions.reduce(
		(result, contribution) => {
			const roleLabel = stringValue(roleById.get(stringValue(contribution.roleId))?.name);
			const instrumentLabel = stringValue(instrumentById.get(stringValue(contribution.instrumentId))?.name);
			const meta = { roleLabel, instrumentLabel };
			const release = releaseById.get(stringValue(contribution.releaseId));
			if (release) {
				const work = workById.get(stringValue(release.workId));
				const workHref = buildEntityHref('work', optionalString(work?.slug));
				const editionKey = optionalString(release.editionKey);
				result.releases.push({
					...meta,
					label: stringValue(work?.title) || stringValue(release.format) || 'リリース',
					href: workHref && editionKey ? `${workHref}#edition-${editionKey}` : workHref,
					date: optionalString(release.releaseDate),
				});
				return result;
			}
			const event = eventById.get(stringValue(contribution.eventId));
			if (event && publicProject(projectById.get(stringValue(event.projectId)))) {
				result.events.push({
					...meta,
					label: stringValue(event.eventName) || stringValue(event.eventDate) || 'ライブ',
					href: buildEntityHref('event', optionalString(event.slug)),
					date: optionalString(event.eventDate),
				});
				return result;
			}
			const recording = recordingById.get(stringValue(contribution.recordingId));
			if (recording) {
				const composition = compositionById.get(stringValue(recording.compositionId));
				result.recordings.push({
					...meta,
					label: stringValue(composition?.title) || stringValue(recording.versionName) || '録音',
					href: buildEntityHref('composition', optionalString(composition?.slug)),
					date: optionalString(recording.recordedDate) ?? optionalString(recording.releaseDate),
				});
			}
			return result;
		},
		{ releases: [] as ContributionView[], events: [] as ContributionView[], recordings: [] as ContributionView[] },
	);
	const roleLabels = new Map<string, string>([
		['performer', '演奏'],
		['creator', '制作'],
		['staff', 'スタッフ'],
	]);
	const roleSummary = [
		...personContributions.reduce((counts, contribution) => {
			const role = roleById.get(stringValue(contribution.roleId));
			const category = stringValue(role?.category) || stringValue(role?.name) || 'その他';
			counts.set(category, (counts.get(category) ?? 0) + 1);
			return counts;
		}, new Map<string, number>()),
	]
		.map(([category, count]) => ({ label: roleLabels.get(category) ?? category, count }))
		.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ja'));

	const coPerformerReasons = new Map<string, Set<string>>();
	const addReason = (coPersonId: string, reason: string): void => {
		if (!coPersonId || coPersonId === personId) return;
		const reasons = coPerformerReasons.get(coPersonId) ?? new Set<string>();
		reasons.add(reason);
		coPerformerReasons.set(coPersonId, reasons);
	};
	for (const membership of personMemberships) {
		const from = optionalString(membership.fromDate);
		const to = optionalString(membership.toDate);
		if (!from || !to) continue;
		for (const otherMembership of memberships) {
			if (stringValue(otherMembership.personId) === personId || stringValue(otherMembership.projectId) !== stringValue(membership.projectId)) continue;
			const otherProject = projectById.get(stringValue(otherMembership.projectId));
			const otherFrom = optionalString(otherMembership.fromDate);
			const otherTo = optionalString(otherMembership.toDate);
			if (!publicProject(otherProject) || !otherFrom || !otherTo) continue;
			if (from <= otherTo && otherFrom <= to) addReason(stringValue(otherMembership.personId), '在籍期間の重複');
		}
	}
	const eventIds = new Set(
		personContributions.map((contribution) => stringValue(contribution.eventId)).filter((eventId) => eventId && publicProject(projectById.get(stringValue(eventById.get(eventId)?.projectId)))),
	);
	for (const contribution of contributions) {
		if (eventIds.has(stringValue(contribution.eventId))) addReason(stringValue(contribution.personId), 'イベント共起');
	}
	const coPerformers = [...coPerformerReasons.entries()]
		.map(([coPersonId, reasonSet]) => {
			const coPerson = new Map(people.map((row) => [stringValue(row.id), row] as const)).get(coPersonId);
			if (!coPerson) return undefined;
			return {
				name: stringValue(coPerson.name) || '名称未設定',
				href: buildEntityHref('person', optionalString(coPerson.slug)),
				reasons: [...reasonSet].sort((left, right) => left.localeCompare(right, 'ja')),
			};
		})
		.filter((coPerson): coPerson is CoPerformerView => Boolean(coPerson))
		.sort((left, right) => left.name.localeCompare(right.name, 'ja'));

	return {
		name: stringValue(person.name) || '名称未設定',
		slug: optionalString(person.slug),
		description: stringValue(person.description),
		activityPeriod: deriveActivityPeriod(person, personMemberships, personContributions, releases, events),
		memberships: membershipViews,
		credits,
		contributions: contributionViews,
		coPerformers,
		roleSummary,
	};
};

function membershipsRoles(membership: SiteRow, membershipRoleRows: readonly SiteRow[], roleById: Map<string, SiteRow>, instrumentById: Map<string, SiteRow>): string[] {
	return membershipRoleRows
		.filter((row) => stringValue(row.membershipId) === stringValue(membership.id))
		.map((row) => {
			const roleName = stringValue(roleById.get(stringValue(row.roleId))?.name);
			const instrumentName = stringValue(instrumentById.get(stringValue(row.instrumentId))?.name);
			return [roleName, instrumentName].filter(Boolean).join(' / ');
		})
		.filter(Boolean)
		.sort((left, right) => left.localeCompare(right, 'ja'));
}

function minCandidate(candidates: readonly Candidate[]): Candidate | undefined {
	return [...candidates].sort((left, right) => left.value.localeCompare(right.value))[0];
}

function maxCandidate(candidates: readonly Candidate[]): Candidate | undefined {
	return [...candidates].sort((left, right) => right.value.localeCompare(left.value))[0];
}

function numberValue(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function optionalString(value: unknown): string | null {
	const result = stringValue(value);
	return result || null;
}

function precisionValue(value: unknown): DatePrecision {
	const result = stringValue(value);
	return result === 'year' || result === 'month' || result === 'day' || result === 'uncertain' ? result : null;
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value : '';
}
