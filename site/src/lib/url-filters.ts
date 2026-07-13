export type FilterSchema = Readonly<Record<string, readonly string[]>>;
export type FilterState = Readonly<Record<string, readonly string[]>>;
export type FilterValues = Readonly<Record<string, readonly string[]>>;

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const searchParamsOf = (input: string | URLSearchParams): URLSearchParams => {
	if (input instanceof URLSearchParams) return new URLSearchParams(input);
	const value = input.includes('?') ? new URL(input, 'https://monden.invalid').search : input;
	return new URLSearchParams(value.startsWith('?') ? value.slice(1) : value);
};

export const parseFilterQuery = (input: string | URLSearchParams, schema: FilterSchema): FilterState => {
	const searchParams = searchParamsOf(input);
	const allowed = Object.fromEntries(Object.entries(schema).map(([key, values]) => [key, new Set(values)])) as Record<string, Set<string>>;
	return Object.fromEntries(Object.keys(schema).map((key) => [key, uniqueSorted(searchParams.getAll(key).filter((value) => allowed[key]?.has(value)))])) as FilterState;
};

export const serializeFilterQuery = (state: FilterState, schema: FilterSchema): string => {
	const searchParams = new URLSearchParams();
	for (const key of Object.keys(schema).sort()) {
		for (const value of uniqueSorted((state[key] ?? []).filter((candidate) => schema[key]?.includes(candidate)))) {
			searchParams.append(key, value);
		}
	}
	return searchParams.toString();
};

export const serializeFilterUrl = (currentUrl: string, state: FilterState, schema: FilterSchema): string => {
	const url = new URL(currentUrl, 'https://monden.invalid');
	url.search = serializeFilterQuery(state, schema);
	return `${url.pathname}${url.search}${url.hash}`;
};

export const normalizeFilterUrl = (currentUrl: string, schema: FilterSchema): string => serializeFilterUrl(currentUrl, parseFilterQuery(currentUrl, schema), schema);

export const matchesFilterValues = (values: FilterValues, state: FilterState): boolean =>
	Object.entries(state).every(([key, selected]) => selected.length === 0 || selected.some((value) => values[key]?.includes(value)));
