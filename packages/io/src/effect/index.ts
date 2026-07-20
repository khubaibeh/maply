export {
	ImageDimensionError,
	ImageInvalidSvgError,
	ImageReadError,
	ImageUnsupportedFormatError
} from "../image/errors";
export { validateImageMimeType, validateSvgMarkup } from "../image/prepare";
export {
	ProjectFileAssetReferenceError,
	ProjectFileJsonError,
	type ProjectFileOperation,
	ProjectFileSchemaError,
	type ProjectFileSection,
	ProjectFileSerializeError,
	UnsupportedProjectFileError
} from "../project/errors";
export {
	SvgRecoveryAssetError,
	SvgRecoveryFormatError,
	SvgRecoveryMetadataError,
	SvgRenderError,
	SvgGenericError,
	SvgImageDecodeError,
	SvgEmptyDocumentError,
	SvgParseError,
	SvgSynopticError
} from "../svg/errors";
export { exportSvg } from "../svg/export";
export { importSvg } from "../svg/import";
export { SvgImportWarningType } from "../svg/types";
export type { SvgImport, SvgImportWarning, SvgOptions } from "../svg/types";
export { IoLayer, ioRuntime } from "./runtime";

import { create, serialize } from "../project/export";
import { assign, parse } from "../project/import";
import { exportSvg } from "../svg/export";
import { importSvg } from "../svg/import";

export const project = {
	file: {
		create,
		serialize,
		parse,
		assign
	}
} as const;

export const svg = {
	export: exportSvg,
	import: importSvg
} as const;
