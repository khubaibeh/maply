import {
	assignProject,
	createProject,
	exportSvgProject,
	importSvgProject,
	parseProject,
	prepareSvg,
	serializeProject
} from "./effect/program";

export { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from "./project/common";

export { validateMimeType } from "./effect/program";

export const project = {
	file: {
		create: createProject,
		serialize: serializeProject,
		parse: parseProject,
		assign: assignProject
	}
} as const;

export const svg = {
	export: exportSvgProject,
	import: importSvgProject,
	prepare: prepareSvg
} as const;
