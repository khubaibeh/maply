import type { Element, ImageElement } from "../../domain/elements";
import type { Canvas } from "../../domain/project";
import { createUniqueElementName } from "../element-name-validation";
import { PASTE_OFFSET, MIN_SHAPE_SIZE } from "./constants";
import { getElementBounds } from "./geometry";
import { createElementId } from "./naming";
import { getTextLayoutMetrics } from "./text";
import { type ResizeHandle, type ResizeOptions } from "./types";

export function duplicateElement(element: Element, elements: Element[] = [], offset = PASTE_OFFSET): Element {
	const next = translateElement(structuredClone(element), offset, offset);
	return {
		...next,
		id: createElementId(),
		name: createUniqueElementName(`${next.name}-copy`, elements)
	} as Element;
}

export function translateElement(element: Element, dx: number, dy: number): Element {
	switch (element.type) {
		case "rect":
		case "text":
		case "image":
		case "path":
			return { ...element, x: Math.round(element.x + dx), y: Math.round(element.y + dy) };
		case "circle":
			return { ...element, cx: Math.round(element.cx + dx), cy: Math.round(element.cy + dy) };
	}
}

export function translateElementWithinCanvas(element: Element, dx: number, dy: number, canvas: Canvas): Element {
	return clampElementToCanvas(translateElement(element, dx, dy), canvas);
}

export function setElementPosition(element: Element, x: number, y: number, canvas: Canvas): Element {
	const dx = x - (element.type === "circle" ? element.cx : element.x);
	const dy = y - (element.type === "circle" ? element.cy : element.y);
	return translateElementWithinCanvas(element, dx, dy, canvas);
}

export function clampElementToCanvas(element: Element, canvas: Canvas): Element {
	// Size is clamped first so the final position clamp uses the rendered bounds.
	const resized = clampElementSize(element, canvas);
	const bounds = getElementBounds(resized);
	const dx = getClampDelta(bounds.x, bounds.width, canvas.x, canvas.width);
	const dy = getClampDelta(bounds.y, bounds.height, canvas.y, canvas.height);

	return dx === 0 && dy === 0 ? resized : translateElement(resized, dx, dy);
}

export function resizeElementWithinCanvas(
	element: Element,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	canvas: Canvas,
	options: ResizeOptions = {}
): Element {
	if (element.type === "circle") {
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

		return {
			...element,
			r: Math.max(0, Math.min(maxRadius, Math.round(element.r + delta)))
		};
	}

	if (element.type !== "rect" && element.type !== "text" && element.type !== "image") {
		return element;
	}

	const bounds = getElementBounds(element);
	const lockedAspectRatio =
		options.lockAspectRatio && typeof options.aspectRatio === "number" && options.aspectRatio > 0
			? options.aspectRatio
			: null;
	let left = bounds.x;
	let top = bounds.y;
	let right = bounds.x + bounds.width;
	let bottom = bounds.y + bounds.height;
	const minSize = 1;
	const canvasLeft = canvas.x;
	const canvasTop = canvas.y;
	const canvasRight = canvas.x + canvas.width;
	const canvasBottom = canvas.y + canvas.height;

	if (handle.includes("w")) {
		left = Math.min(right - minSize, Math.max(canvasLeft, left + dx));
	}

	if (handle.includes("e")) {
		right = Math.max(left + minSize, Math.min(canvasRight, right + dx));
	}

	if (handle.includes("n")) {
		top = Math.min(bottom - minSize, Math.max(canvasTop, top + dy));
	}

	if (handle.includes("s")) {
		bottom = Math.max(top + minSize, Math.min(canvasBottom, bottom + dy));
	}

	if (lockedAspectRatio !== null) {
		const aspectRatio = lockedAspectRatio;
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
		const proposedWidth = Math.max(minSize, right - left);
		const proposedHeight = Math.max(minSize, bottom - top);

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
	}

	const width = Math.max(1, Math.round(right - left));
	const height = Math.max(1, Math.round(bottom - top));

	if (element.type === "text") {
		const metrics = getTextLayoutMetrics(element.text, element.fontSize, width);
		return {
			...element,
			x: Math.round(left + metrics.left),
			y: Math.round(top + metrics.ascent),
			width,
			height
		};
	}

	return {
		...element,
		x: Math.round(left),
		y: Math.round(top),
		width,
		height
	};
}

function getResizeMaxWidth(
	handle: ResizeHandle,
	anchorX: number,
	anchorY: number,
	aspectRatio: number,
	canvas: Canvas
) {
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

export function resizeImageFrameWithinCanvas(
	element: ImageElement,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	canvas: Canvas
): ImageElement {
	let left = element.x;
	let top = element.y;
	let right = element.x + element.width;
	let bottom = element.y + element.height;
	const canvasLeft = canvas.x;
	const canvasTop = canvas.y;
	const canvasRight = canvas.x + canvas.width;
	const canvasBottom = canvas.y + canvas.height;

	if (handle.includes("w")) {
		left = Math.min(right - MIN_SHAPE_SIZE, Math.max(canvasLeft, left + dx));
	}

	if (handle.includes("e")) {
		right = Math.max(left + MIN_SHAPE_SIZE, Math.min(canvasRight, right + dx));
	}

	if (handle.includes("n")) {
		top = Math.min(bottom - MIN_SHAPE_SIZE, Math.max(canvasTop, top + dy));
	}

	if (handle.includes("s")) {
		bottom = Math.max(top + MIN_SHAPE_SIZE, Math.min(canvasBottom, bottom + dy));
	}

	return {
		...element,
		x: Math.round(left),
		y: Math.round(top),
		width: Math.round(right - left),
		height: Math.round(bottom - top)
	};
}

function clampElementSize(element: Element, canvas: Canvas): Element {
	switch (element.type) {
		case "rect":
		case "image":
			return {
				...element,
				width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
				height: Math.min(Math.max(1, Math.round(element.height)), canvas.height)
			};
		case "circle":
			return {
				...element,
				r: Math.min(Math.max(0, Math.round(element.r)), Math.floor(Math.min(canvas.width, canvas.height) / 2))
			};
		case "text":
			return {
				...element,
				width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
				height: Math.min(Math.max(1, Math.round(element.height)), canvas.height),
				fontSize: Math.min(Math.max(1, Math.round(element.fontSize)), canvas.height)
			};
		case "path":
			return element;
	}
}

function getClampDelta(position: number, size: number, canvasPosition: number, canvasSize: number): number {
	if (size > canvasSize) return Math.round(canvasPosition - position);
	if (position < canvasPosition) return Math.round(canvasPosition - position);
	if (position + size > canvasPosition + canvasSize)
		return Math.round(canvasPosition + canvasSize - (position + size));
	return 0;
}
