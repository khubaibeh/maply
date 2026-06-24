import type { Element } from "./elements";

export type Canvas = {
	width: number;
	height: number;
	color: string;
	x: number;
	y: number;
};

export type Camera = {
	x: number;
	y: number;
	zoom: number;
};

export type ImportExportState = {
	importsOpen: boolean;
	elementsOpen: boolean;
};

export type Project = {
	id: string;
	name: string;
	canvas: Canvas;
	camera?: Camera;
	elements: Element[];
	importExportState: ImportExportState;
};
