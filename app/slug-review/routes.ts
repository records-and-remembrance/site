import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import { slugReviewDecisionStatuses, type SlugReviewRepository } from './types';

const entityTypes = ['project', 'person', 'composition', 'work', 'venue'] as const;
const decisionSchema = z.strictObject({
	status: z.enum(slugReviewDecisionStatuses),
	slug: z.string().trim().nullable(),
});

export function createSlugReviewRoutes(repository: SlugReviewRepository): Hono {
	const app = new Hono();

	app.get('/', async (context) => context.json({ data: await repository.get() }));
	app.get('/artifact', async (context) => context.json({ data: await repository.getArtifact() }));
	app.put('/records/:entityType/:id/decision', async (context) => {
		const entityType = z.enum(entityTypes).parse(context.req.param('entityType'));
		const input = decisionSchema.parse(await context.req.json());
		return context.json({ data: await repository.saveDecision(entityType, context.req.param('id'), input) });
	});

	app.onError((error, context) => {
		if (error instanceof ZodError || error instanceof SyntaxError) {
			return context.json({ error: { code: 'VALIDATION_ERROR', message: 'slug判定内容を確認してください' } }, 400);
		}
		if (error instanceof Error && error.message === 'Slug review record was not found') {
			return context.json({ error: { code: 'NOT_FOUND', message: error.message } }, 404);
		}
		if (error instanceof Error && error.message.startsWith('Approved slug is invalid')) {
			return context.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
		}
		throw error;
	});

	return app;
}
