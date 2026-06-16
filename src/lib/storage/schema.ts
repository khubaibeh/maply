export type RectElement = {
	id: string;
	type: 'rect';
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
};

export type CircleElement = {
	id: string;
	type: 'circle';
	cx: number;
	cy: number;
	r: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
};

export type PathElement = {
	id: string;
	type: 'path';
	d: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
};

export type TextElement = {
	id: string;
	type: 'text';
	x: number;
	y: number;
	text: string;
	fontSize: number;
	fill: string;
};

export type ImageElement = {
	id: string;
	type: 'image';
	x: number;
	y: number;
	width: number;
	height: number;
	href: string;
};

export type Element = RectElement | CircleElement | PathElement | TextElement | ImageElement;

export type Canvas = {
	width: number;
	height: number;
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
