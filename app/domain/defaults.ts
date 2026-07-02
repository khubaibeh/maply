import type { Element } from "./elements";
import type { Project } from "./project";

const sampleElements: Element[] = [
	{
		id: "9103ef60-ae4c-4119-bffc-d4b53eb5fdb6",
		name: "horizontal",
		type: "rect",
		x: 323,
		y: 347,
		width: 217,
		height: 61,
		fill: "#FDA5A5",
		stroke: "#000000",
		strokeWidth: 0
	},
	{
		id: "el-circle-1",
		name: "circle",
		type: "circle",
		cx: 455,
		cy: 280,
		r: 60,
		fill: "#AF87C5",
		stroke: "#000000",
		strokeWidth: 0
	},
	{
		id: "cc57f0fa-5b24-480f-80e8-0dae8bfb9cfe",
		name: "polygon",
		type: "path",
		x: 49,
		y: 357,
		d: "M322,570 L234,715 L396,715 Z",
		fill: "#A1D968",
		stroke: "#000000",
		strokeWidth: 0,
		closed: true
	},
	{
		id: "db2395ca-3d4f-48a3-b9fc-058d8564e2b8",
		name: "vertical",
		type: "rect",
		x: 277,
		y: 155,
		width: 112,
		height: 231,
		fill: "#D2D39C",
		stroke: "#000000",
		strokeWidth: 0
	},
	{
		id: "2a1f024c-febc-42ac-a207-b96edd75409b",
		name: "polygon-2",
		type: "path",
		x: 109,
		y: 335,
		d: "M322,570 L234,715 L396,715 Z",
		fill: "#EDF2EE",
		stroke: "#000000",
		strokeWidth: 0,
		closed: true
	},
	{
		id: "4c596cb5-d31f-4051-bff2-83e5a06eb4f8",
		name: "path",
		type: "path",
		x: 86,
		y: 99,
		d: "M136,103 L73,185 L225,118 L71,294 Z",
		fill: "#2D3B53",
		stroke: "#000000",
		strokeWidth: 0,
		closed: true
	}
];

export const defaultProject: Project = {
	id: "prod",
	name: "UntitledProject",
	canvas: {
		width: 800,
		height: 800,
		color: "#ffffff",
		x: 0,
		y: 0
	},
	elements: [],
	importExportState: {
		importsOpen: true,
		elementsOpen: true
	},
	camera: {
		x: -302.23521459629404,
		y: -92.0446555125453,
		zoom: 1.0327974561434663
	}
};

export function createDefaultProject(id = defaultProject.id): Project {
	return {
		...defaultProject,
		id,
		canvas: { ...defaultProject.canvas },
		elements: defaultProject.elements.map((element) => ({ ...element })),
		importExportState: { ...defaultProject.importExportState },
		camera: defaultProject.camera ? { ...defaultProject.camera } : undefined
	};
}

export function createSampleProject(id = defaultProject.id): Project {
	const project = createDefaultProject(id);
	project.elements = sampleElements.map((element) => ({ ...element }));
	project.canvas = {
		width: 600,
		height: 600,
		color: "#D3DED4",
		x: 0,
		y: 0
	};
	project.camera = {
		x: -302.23521459629404,
		y: -92.0446555125453,
		zoom: 1.0327974561434663
	};
	return project;
}
