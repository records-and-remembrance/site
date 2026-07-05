import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import { humanReviewDecisionStatuses, type MagazineReviewRepository } from './types';

const decisionSchema = z.strictObject({
	status: z.enum(humanReviewDecisionStatuses),
	notes: z.string().trim().max(2_000),
});

export function createMagazineReviewRoutes(repository: MagazineReviewRepository): Hono {
	const app = new Hono();

	app.get('/', async (context) => context.json({ data: await repository.get() }));

	app.put('/records/:sourceKey/decision', async (context) => {
		const input = decisionSchema.parse(await context.req.json());
		return context.json({
			data: await repository.saveDecision(context.req.param('sourceKey'), input),
		});
	});

	app.onError((error, context) => {
		if (error instanceof ZodError || error instanceof SyntaxError) {
			return context.json(
				{
					error: {
						code: 'VALIDATION_ERROR',
						message: '判定内容を確認してください',
					},
				},
				400,
			);
		}
		if (error instanceof Error && error.message === 'Magazine review record was not found') {
			return context.json(
				{
					error: {
						code: 'NOT_FOUND',
						message: error.message,
					},
				},
				404,
			);
		}
		throw error;
	});

	return app;
}
