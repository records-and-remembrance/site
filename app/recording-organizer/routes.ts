import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import { recordingTypes } from '../recording/types';
import { isRecordingOrganizerError, type RecordingOrganizerRepository } from './types';

const uuid = z.uuid();
const nullableText = z.string().trim().nullable();
const nullableDate = z.iso.date().nullable();
const metadataSchema = z.strictObject({
	versionName: nullableText,
	versionDescription: nullableText,
	recordingYear: z.number().int().nullable(),
	type: z.enum(recordingTypes),
	recordedDate: nullableDate,
	recordedFrom: nullableDate,
	recordedTo: nullableDate,
	releaseDate: nullableDate,
	notes: nullableText,
});
const listQuerySchema = z.strictObject({
	search: z.string().trim().default(''),
	status: z.enum(['pending', 'reviewed', 'all']).default('pending'),
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(500).default(20),
});
const mergeSchema = z.strictObject({
	targetRecordingId: uuid,
	sourceRecordingIds: z.array(uuid).min(1),
	metadata: metadataSchema.optional(),
});
const splitSchema = z.strictObject({
	sourceRecordingId: uuid,
	trackIds: z.array(uuid).min(1),
	metadata: metadataSchema,
	contributionIds: z.array(uuid),
});

interface DatabaseError extends Error {
	code?: string;
	constraint?: string;
	cause?: unknown;
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ZodError([{ code: 'custom', path: ['body'], message: 'Body must be valid JSON' }]);
	}
}

function zodErrorResponse(error: ZodError) {
	const fields: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'request';
		(fields[key] ??= []).push(issue.message);
	}
	return {
		error: {
			code: 'VALIDATION_ERROR',
			message: 'Request validation failed',
			fields,
		},
	};
}

function findDatabaseError(error: unknown): DatabaseError | undefined {
	let current = error;
	const visited = new Set<unknown>();
	while (current && typeof current === 'object' && !visited.has(current)) {
		visited.add(current);
		const candidate = current as DatabaseError;
		if (typeof candidate.code === 'string') return candidate;
		current = candidate.cause;
	}
	return undefined;
}

function databaseErrorResponse(error: DatabaseError | undefined) {
	switch (error?.code) {
		case '23505':
			return {
				status: 409 as const,
				code: 'CONFLICT',
				message: 'A record with the same unique values already exists',
			};
		case '23503':
			return {
				status: 400 as const,
				code: 'INVALID_REFERENCE',
				message: 'A selected related record does not exist',
			};
		case '23514':
		case '23P01':
			return {
				status: 400 as const,
				code: 'CONSTRAINT_VIOLATION',
				message: 'The values violate a database constraint',
			};
		default:
			return null;
	}
}

export function createRecordingOrganizerRoutes(repository: RecordingOrganizerRepository): Hono {
	const app = new Hono();

	app.get('/compositions', async (context) => {
		const query = listQuerySchema.parse(context.req.query());
		const result = await repository.list(query);
		return context.json({
			data: result.items,
			meta: {
				page: query.page,
				pageSize: query.pageSize,
				total: result.total,
				pending: result.pending,
				reviewed: result.reviewed,
			},
		});
	});

	app.get('/compositions/:id', async (context) => {
		const compositionId = uuid.parse(context.req.param('id'));
		const detail = await repository.detail(compositionId);
		if (!detail) {
			return context.json(
				{
					error: {
						code: 'NOT_FOUND',
						message: 'Composition was not found',
					},
				},
				404,
			);
		}
		return context.json({ data: detail });
	});

	app.post('/merge', async (context) => {
		const input = mergeSchema.parse(await readJson(context.req.raw));
		return context.json({ data: await repository.merge(input) });
	});

	app.post('/split', async (context) => {
		const input = splitSchema.parse(await readJson(context.req.raw));
		return context.json({ data: await repository.split(input) }, 201);
	});

	app.post('/compositions/:id/review', async (context) => {
		const compositionId = uuid.parse(context.req.param('id'));
		return context.json({ data: await repository.review(compositionId) });
	});

	app.onError((error, context) => {
		if (error instanceof ZodError) {
			return context.json(zodErrorResponse(error), 400);
		}
		if (isRecordingOrganizerError(error)) {
			const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'METADATA_CONFLICT' ? 409 : 400;
			return context.json(
				{
					error: {
						code: error.code,
						message: error.message,
						...(error.details ? { details: error.details } : {}),
					},
				},
				status,
			);
		}
		const databaseError = findDatabaseError(error);
		const mapped = databaseErrorResponse(databaseError);
		if (mapped) {
			return context.json(
				{
					error: {
						code: mapped.code,
						message: mapped.message,
						...(databaseError?.constraint ? { constraint: databaseError.constraint } : {}),
					},
				},
				mapped.status,
			);
		}
		console.error(error);
		return context.json(
			{
				error: {
					code: 'INTERNAL_ERROR',
					message: 'An unexpected error occurred',
				},
			},
			500,
		);
	});

	return app;
}
