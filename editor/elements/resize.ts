import type { Canvas, Element } from "@maply/model/types";

import { getElementBounds } from "./geometry";

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type ResizeOptions = {
	lockAspectRatio?: boolean;
	aspectRatio?: number;
};

/**
 * Resizes a rect, text, or image element by a handle delta, clamped to canvas bounds.
 * Circle resize adjusts radius by the dominant axis delta.
 * Path elements are not resizable through this function.
 */
export function resizeElement(
	element: Element,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	canvas: Canvas,
	options: ResizeOptions = {}
): Element {
	if (element.type === "circle") return resizeCircle(element, handle, dx, dy, canvas);
	if (element.type === "path") return element;

	const bounds = getElementBounds(element);

	let lockedAspectRatio: number | null = null;
	if (options.lockAspectRatio) {
		if (typeof options.aspectRatio === "number" && options.aspectRatio > 0) {
			lockedAspectRatio = options.aspectRatio;
		} else if (bounds.height > 0) {
			lockedAspectRatio = bounds.width / bounds.height;
		}
	}

	let left = bounds.x;
	let top = bounds.y;
	let right = bounds.x + bounds.width;
	let bottom = bounds.y + bounds.height;

	const canvasLeft = canvas.x;
	const canvasTop = canvas.y;
	const canvasRight = canvas.x + canvas.width;
	const canvasBottom = canvas.y + canvas.height;

	if (handle.includes("w")) left = Math.min(right - 1, Math.max(canvasLeft, left + dx));
	if (handle.includes("e")) right = Math.max(left + 1, Math.min(canvasRight, right + dx));
	if (handle.includes("n")) top = Math.min(bottom - 1, Math.max(canvasTop, top + dy));
	if (handle.includes("s")) bottom = Math.max(top + 1, Math.min(canvasBottom, bottom + dy));

	if (lockedAspectRatio !== null) {
		({ left, top, right, bottom } = applyAspectRatio(
			handle,
			lockedAspectRatio,
			bounds,
			left,
			top,
			right,
			bottom,
			canvas
		));
	}

	const width = Math.max(1, Math.round(right - left));
	const height = Math.max(1, Math.round(bottom - top));

	if (element.type === "text") {
		return { ...element, x: Math.round(left), y: Math.round(top + element.fontSize), width, height };
	}

	return { ...element, x: Math.round(left), y: Math.round(top), width, height };
}

function resizeCircle(
	element: Extract<Element, { type: "circle" }>,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	canvas: Canvas
): Extract<Element, { type: "circle" }> {
	const horizontal = handle.includes("w") ? -dx : handle.includes("e") ? dx : 0;
	const vertical = handle.includes("n") ? -dy : handle.includes("s") ? dy : 0;

	const delta =
		horizontal !== 0 && vertical !== 0
			? Math.abs(horizontal) >= Math.abs(vertical)
				? horizontal
				: vertical
			: horizontal || vertical;

	const maxRadius = Math.floor(
		Math.min(
			element.cx - canvas.x,
			canvas.x + canvas.width - element.cx,
			element.cy - canvas.y,
			canvas.y + canvas.height - element.cy
		)
	);

	return { ...element, r: Math.max(0, Math.min(maxRadius, Math.round(element.r + delta))) };
}

function applyAspectRatio(
	handle: ResizeHandle,
	aspectRatio: number,
	bounds: { x: number; y: number; width: number; height: number },
	left: number,
	top: number,
	right: number,
	bottom: number,
	canvas: Canvas
): { left: number; top: number; right: number; bottom: number } {
	const anchorX = handle.includes("w")
		? bounds.x + bounds.width
		: handle.includes("e")
			? bounds.x
			: bounds.x + bounds.width / 2;
	const anchorY = handle.includes("n")
		? bounds.y + bounds.height
		: handle.includes("s")
			? bounds.y
			: bounds.y + bounds.height / 2;

	const proposedWidth = Math.max(1, right - left);
	const proposedHeight = Math.max(1, bottom - top);

	let nextWidth = proposedWidth;
	let nextHeight = proposedHeight;

	if (!handle.includes("n") && !handle.includes("s")) {
		nextHeight = nextWidth / aspectRatio;
	} else if (!handle.includes("w") && !handle.includes("e")) {
		nextWidth = nextHeight * aspectRatio;
	} else {
		const widthChange = Math.abs(proposedWidth - bounds.width) / Math.max(1, bounds.width);
		const heightChange = Math.abs(proposedHeight - bounds.height) / Math.max(1, bounds.height);
		if (widthChange >= heightChange) {
			nextHeight = nextWidth / aspectRatio;
		} else {
			nextWidth = nextHeight * aspectRatio;
		}
	}

	if (handle.includes("w")) {
		left = anchorX - nextWidth;
		right = anchorX;
	} else if (handle.includes("e")) {
		left = anchorX;
		right = anchorX + nextWidth;
	} else {
		left = anchorX - nextWidth / 2;
		right = anchorX + nextWidth / 2;
	}

	if (handle.includes("n")) {
		top = anchorY - nextHeight;
		bottom = anchorY;
	} else if (handle.includes("s")) {
		top = anchorY;
		bottom = anchorY + nextHeight;
	} else {
		top = anchorY - nextHeight / 2;
		bottom = anchorY + nextHeight / 2;
	}

	const maxWidth = getResizeMaxWidth(handle, anchorX, anchorY, aspectRatio, canvas);
	const maxHeight = maxWidth / aspectRatio;

	if (right - left > maxWidth || bottom - top > maxHeight) {
		if (handle.includes("w")) {
			left = anchorX - maxWidth;
			right = anchorX;
		} else if (handle.includes("e")) {
			left = anchorX;
			right = anchorX + maxWidth;
		} else {
			left = anchorX - maxWidth / 2;
			right = anchorX + maxWidth / 2;
		}

		if (handle.includes("n")) {
			top = anchorY - maxHeight;
			bottom = anchorY;
		} else if (handle.includes("s")) {
			top = anchorY;
			bottom = anchorY + maxHeight;
		} else {
			top = anchorY - maxHeight / 2;
			bottom = anchorY + maxHeight / 2;
		}
	}

	return { left, top, right, bottom };
}

function getResizeMaxWidth(
	handle: ResizeHandle,
	anchorX: number,
	anchorY: number,
	aspectRatio: number,
	canvas: Canvas
): number {
	const horizontalLimit = handle.includes("w")
		? anchorX - canvas.x
		: handle.includes("e")
			? canvas.x + canvas.width - anchorX
			: Math.min(anchorX - canvas.x, canvas.x + canvas.width - anchorX) * 2;

	const verticalLimit = handle.includes("n")
		? (anchorY - canvas.y) * aspectRatio
		: handle.includes("s")
			? (canvas.y + canvas.height - anchorY) * aspectRatio
			: Math.min(anchorY - canvas.y, canvas.y + canvas.height - anchorY) * 2 * aspectRatio;

	return Math.max(1, Math.min(horizontalLimit, verticalLimit));
}
