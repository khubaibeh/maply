export type RectElement = {
	id: string;
	name: string;
	type: "rect";
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
	name: string;
	type: "circle";
	cx: number;
	cy: number;
	r: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
};

export type PathElement = {
	id: string;
	name: string;
	type: "path";
	x: number;
	y: number;
	d: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
};

export type TextElement = {
	id: string;
	name: string;
	type: "text";
	x: number;
	y: number;
	text: string;
	fontSize: number;
	fill: string;
};

export type ImageElement = {
	id: string;
	name: string;
	type: "image";
	x: number;
	y: number;
	width: number;
	height: number;
	href: string;
};

export type Element = RectElement | CircleElement | PathElement | TextElement | ImageElement;
export type ElementType = Element["type"];
