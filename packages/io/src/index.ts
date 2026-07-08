import { assignProject, createProject, parseProject, serializeProject } from "./effect/program";
export { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from "./project/common";

export const project = {
	file: {
		create: createProject,
		serialize: serializeProject,
		parse: parseProject,
		assign: assignProject
	}
} as const;
