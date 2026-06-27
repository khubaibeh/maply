import type { Element } from "./elements";
import type { Project } from "./project";

const defaultElements: Element[] = [
	{
		id: "el-circle-1",
		name: "Highlight-circle",
		type: "circle",
		cx: 350,
		cy: 250,
		r: 60,
		fill: "#3b82f6",
		stroke: "#000000",
		strokeWidth: 0
	},
	{
		id: "el-path-1",
		name: "Demo-closed-path",
		type: "path",
		x: 480,
		y: 480,
		d: "M500,500 L600,480 L620,560 L560,620 L480,580 Z",
		fill: "#9ca3af",
		stroke: "#000000",
		strokeWidth: 0,
		closed: true
	},
	{
		id: "el-path-2",
		name: "Demo-open-path",
		type: "path",
		x: 100,
		y: 450,
		d: "M100,500 L150,450 L200,520 L250,480",
		fill: "none",
		stroke: "#000000",
		strokeWidth: 3,
		closed: false
	},
	{
		id: "el-text-1",
		name: "Title-text",
		type: "text",
		x: 120,
		y: 80,
		width: 220,
		height: 80,
		text: "Maply",
		fontSize: 32,
		fill: "#171717"
	},
	{
		id: "el-image-1",
		name: "Sample-image",
		type: "image",
		x: 300,
		y: 120,
		width: 160,
		height: 120,
		assetId: null,
		href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect width='160' height='120' fill='%23d4d4d4'/%3E%3Ccircle cx='80' cy='60' r='30' fill='%239ca3af'/%3E%3C/svg%3E",
		cropX: 0,
		cropY: 0,
		cropScale: 100
	},
	{
		id: "el-rect-1",
		name: "1 Background/rectangle",
		type: "rect",
		x: 100,
		y: 100,
		width: 200,
		height: 120,
		fill: "#e5e5e5",
		stroke: "#000000",
		strokeWidth: 0
	}
];

export const defaultProject: Project = {
	id: "default",
	name: "Untitled",
	canvas: {
		width: 800,
		height: 800,
		color: "#ffffff",
		x: 0,
		y: 0
	},
	elements: defaultElements,
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
		elements: defaultProject.elements.map((element) => ({ ...element })),
		importExportState: { ...defaultProject.importExportState },
		camera: defaultProject.camera ? { ...defaultProject.camera } : undefined
	};
}
