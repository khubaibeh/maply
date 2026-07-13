import { Schema } from "effect";

export const RectElementSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	type: Schema.Literal("rect"),
	x: Schema.Number,
	y: Schema.Number,
	width: Schema.Number,
	height: Schema.Number,
	fill: Schema.String,
	stroke: Schema.String,
	strokeWidth: Schema.Number
});

export const CircleElementSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	type: Schema.Literal("circle"),
	cx: Schema.Number,
	cy: Schema.Number,
	r: Schema.Number,
	fill: Schema.String,
	stroke: Schema.String,
	strokeWidth: Schema.Number
});

export const PathElementSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	type: Schema.Literal("path"),
	x: Schema.Number,
	y: Schema.Number,
	d: Schema.String,
	fill: Schema.String,
	stroke: Schema.String,
	strokeWidth: Schema.Number,
	closed: Schema.Boolean
});

export const TextElementSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	type: Schema.Literal("text"),
	x: Schema.Number,
	y: Schema.Number,
	width: Schema.Number,
	height: Schema.Number,
	text: Schema.String,
	fontSize: Schema.Number,
	fill: Schema.String
});

export const ImageElementSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	type: Schema.Literal("image"),
	x: Schema.Number,
	y: Schema.Number,
	width: Schema.Number,
	height: Schema.Number,
	assetId: Schema.NullOr(Schema.String),
	href: Schema.optionalKey(Schema.String),
	cropX: Schema.Number,
	cropY: Schema.Number,
	cropScale: Schema.Number
});

export const ElementSchema = Schema.Union([
	RectElementSchema,
	CircleElementSchema,
	PathElementSchema,
	TextElementSchema,
	ImageElementSchema
]);

export const ElementTypeSchema = Schema.Literals(["rect", "circle", "path", "text", "image"]);

export const StoredImageAssetSchema = Schema.Struct({
	id: Schema.String,
	projectId: Schema.String,
	name: Schema.String,
	mimeType: Schema.String,
	dataUrl: Schema.String,
	width: Schema.Number,
	height: Schema.Number
});

export const PointSchema = Schema.Struct({
	x: Schema.Number,
	y: Schema.Number
});

export const CanvasSchema = Schema.Struct({
	width: Schema.Number,
	height: Schema.Number,
	color: Schema.String,
	x: Schema.Number,
	y: Schema.Number
});

export const CameraSchema = Schema.Struct({
	x: Schema.Number,
	y: Schema.Number,
	zoom: Schema.Number
});

export const ProjectSchema = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	canvas: CanvasSchema,
	camera: Schema.optionalKey(CameraSchema),
	elements: Schema.Array(ElementSchema)
});

export const ToolSchema = Schema.Literals(["select", "hand", "rect", "circle", "path", "text", "image"]);

export type RectElement = typeof RectElementSchema.Type;
export type CircleElement = typeof CircleElementSchema.Type;
export type PathElement = typeof PathElementSchema.Type;
export type TextElement = typeof TextElementSchema.Type;
export type ImageElement = typeof ImageElementSchema.Type;
export type Element = typeof ElementSchema.Type;
export type ElementType = typeof ElementTypeSchema.Type;
export type StoredImageAsset = typeof StoredImageAssetSchema.Type;
export type Point = typeof PointSchema.Type;
export type Canvas = typeof CanvasSchema.Type;
export type Camera = typeof CameraSchema.Type;
export type Project = typeof ProjectSchema.Type;
export type Tool = typeof ToolSchema.Type;
