import {
	assignProject,
	createProject,
	exportSvgProject,
	importSvgProject,
	parseProject,
	serializeProject
} from "./effect/program";
export { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from "./project/common";

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
	import: importSvgProject
} as const;
