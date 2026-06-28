import { parseAsString, parseAsStringLiteral } from 'nuqs';
import { editorConfigs, mainResourceOrder, type EditorResource } from './resources';

const editorResourceOrder = Object.keys(editorConfigs) as EditorResource[];

export const adminSearchParams = {
	resource: parseAsStringLiteral(mainResourceOrder).withDefault('people'),
	detailResource: parseAsStringLiteral(editorResourceOrder),
	detailId: parseAsString,
};
