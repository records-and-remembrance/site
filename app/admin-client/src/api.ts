import type { EditorResource, LookupResource, MainResource } from './resources';

export interface ListState {
	search: string;
	page: number;
	pageSize: number;
	sort: string;
	direction: 'asc' | 'desc';
}

export interface ListResponse {
	data: Array<Record<string, unknown>>;
	meta: {
		page: number;
		pageSize: number;
		total: number;
	};
}

export interface LookupOption {
	id: string;
	label: string;
	description?: string | null;
}

export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		fields?: Record<string, string[]>;
		constraint?: string;
		details?: Record<string, unknown>;
	};
}

export class AdminApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: ApiErrorBody,
	) {
		super(message);
	}
}

type ApiResource = MainResource | EditorResource;

export async function listRecords(resource: ApiResource, state: ListState): Promise<ListResponse> {
	const search = new URLSearchParams({
		search: state.search,
		page: String(state.page),
		pageSize: String(state.pageSize),
		sort: state.sort,
		direction: state.direction,
	});
	return await request<ListResponse>(`/api/admin/${resource}?${search}`);
}

export async function getRecord(resource: ApiResource, id: string): Promise<Record<string, unknown>> {
	const response = await request<{ data: Record<string, unknown> }>(`/api/admin/${resource}/${id}`);
	return response.data;
}

export async function saveRecord(resource: ApiResource, payload: Record<string, unknown>, id?: string): Promise<Record<string, unknown>> {
	const response = await request<{ data: Record<string, unknown> }>(id ? `/api/admin/${resource}/${id}` : `/api/admin/${resource}`, {
		method: id ? 'PUT' : 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return response.data;
}

export async function lookupRecords(resource: LookupResource, search: string): Promise<LookupOption[]> {
	const query = new URLSearchParams({ search });
	const response = await request<{ data: LookupOption[] }>(`/api/admin/lookups/${resource}?${query}`);
	return response.data;
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	const body = (await response.json()) as T | ApiErrorBody;
	if (!response.ok) {
		const error = body as ApiErrorBody;
		throw new AdminApiError(error.error?.message ?? `Request failed with status ${response.status}`, response.status, error);
	}
	return body as T;
}
