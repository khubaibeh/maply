import type { Project } from "../schema";
import project from "./project.json";
import sample from "./sample.json";

export const defaultProject = project as Project;

export function createDefaultProject(id = defaultProject.id): Project {
	return clone({ ...defaultProject, id });
}

export function createSampleProject(id = defaultProject.id): Project {
	return clone({ ...(sample as Project), id });
}

function clone(project: Project): Project {
	return {
		...project,
		canvas: { ...project.canvas },
		elements: project.elements.map((element) => ({ ...element })),
		importExportState: { ...project.importExportState },
		camera: project.camera ? { ...project.camera } : undefined
	};
}
