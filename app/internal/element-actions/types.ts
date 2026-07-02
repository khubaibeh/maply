export type Bounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type ResizeOptions = {
	lockAspectRatio?: boolean;
	aspectRatio?: number;
};
