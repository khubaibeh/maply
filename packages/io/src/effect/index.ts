export {
	ProjectFileAssetReferenceError,
	ProjectFileJsonError,
	type ProjectFileOperation,
	ProjectFileSchemaError,
	type ProjectFileSection,
	ProjectFileSerializeError,
	UnsupportedProjectFileError
} from "../project/errors";
export { IoLayer, ioRuntime } from "./runtime";

import { create, serialize } from "../project/export";
import { assign, parse } from "../project/import";

export const project = {
	file: {
		create,
		serialize,
		parse,
		assign
	}
} as const;
