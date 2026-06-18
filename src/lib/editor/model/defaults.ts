import type { Element } from "./elements";
import type { Project } from "./project";

const defaultElements: Element[] = [
	{
		id: "el-rect-1",
		name: "Background rectangle",
		type: "rect",
		x: 100,
		y: 100,
		width: 200,
		height: 120,
		fill: "#e5e5e5",
		stroke: "#000000",
		strokeWidth: 0
	},
	{
		id: "el-circle-1",
		name: "Highlight circle",
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
		name: "Decorative path",
		type: "path",
		x: 0,
		y: 0,
		d: "M50,300 Q150,250 250,300 T450,300",
		fill: "none",
		stroke: "#f97316",
		strokeWidth: 4
	},
	{
		id: "el-text-1",
		name: "Title text",
		type: "text",
		x: 120,
		y: 80,
		text: "Maply",
		fontSize: 32,
		fill: "#171717"
	},
	{
		id: "el-image-1",
		name: "Sample image",
		type: "image",
		x: 300,
		y: 120,
		width: 160,
		height: 120,
		href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect width='160' height='120' fill='%23d4d4d4'/%3E%3Ccircle cx='80' cy='60' r='30' fill='%239ca3af'/%3E%3C/svg%3E"
	}
];

export const defaultProject: Project = {
	id: "default",
	name: "Untitled",
	canvas: {
		width: 800,
		height: 800,
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
