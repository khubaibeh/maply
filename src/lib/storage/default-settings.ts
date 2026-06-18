import type { Project } from "./schema";

export const defaultProject: Project = {
	id: "default",
	name: "Untitled",
	canvas: {
		width: 800,
		height: 800,
		x: 0,
		y: 0
	},
	elements: [],
	importExportState: {
		importsOpen: true,
		elementsOpen: true
	},
	camera: {
		x: -350,
		y: -50,
		zoom: 0.9
	}
};

export function createDefaultProject(id = defaultProject.id): Project {
	return {
		...defaultProject,
		id,
		canvas: { ...defaultProject.canvas },
		elements: [...defaultProject.elements],
		importExportState: { ...defaultProject.importExportState },
		camera: defaultProject.camera ? { ...defaultProject.camera } : undefined
	};
}
