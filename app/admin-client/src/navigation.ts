import { parseAsString, parseAsStringLiteral } from 'nuqs';
import { editorConfigs, mainResourceOrder, type EditorResource } from './resources';

const editorResourceOrder = Object.keys(editorConfigs) as EditorResource[];
export const adminSectionOrder = [...mainResourceOrder, 'recording-organizer'] as const;
export type AdminSection = (typeof adminSectionOrder)[number];

export const adminSearchParams = {
	resource: parseAsStringLiteral(adminSectionOrder).withDefault('people'),
	detailResource: parseAsStringLiteral(editorResourceOrder),
	detailId: parseAsString,
};
