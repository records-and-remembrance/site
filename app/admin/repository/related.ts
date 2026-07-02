import type { AdminResource } from '../types';
import { createArticleRelatedLoader } from './articles/load-related';
import { createCompositionRelatedLoader } from './compositions/load-related';
import { createEventRelatedLoader } from './events/load-related';
import { createPeopleRelatedLoader } from './people/load-related';
import { createProjectRelatedLoader } from './projects/load-related';
import { createReleaseRelatedLoader } from './releases/load-related';
import type { AdminDb, RelatedLoader } from './types';
import { createWorkRelatedLoader } from './works/load-related';

export const createRelatedLoaders = (database: AdminDb) =>
	({
		people: createPeopleRelatedLoader(database),
		projects: createProjectRelatedLoader(database),
		works: createWorkRelatedLoader(database),
		releases: createReleaseRelatedLoader(database),
		compositions: createCompositionRelatedLoader(database),
		events: createEventRelatedLoader(database),
		articles: createArticleRelatedLoader(database),
	}) satisfies Partial<Record<AdminResource, RelatedLoader>>;
