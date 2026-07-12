import type { TextElement } from "@maply/model/types";

const textDescentRatio = 0.2;
const textLineHeightRatio = 1.2;
const textFontFamily = '"Inter Variable", sans-serif';
const textWrapSafetyMargin = 2;

let textMeasureContext: CanvasRenderingContext2D | null | undefined;

type TextLayout = {
	lines: string[];
	lineHeight: number;
	left: number;
	right: number;
	ascent: number;
	descent: number;
};

/** Legacy wrapped text lines used by current SVG text rendering. */
export function getWrappedTextLines(element: TextElement): string[] {
	return getWrappedTextLayout(element).lines;
}

/** Legacy wrapped text line height used by current SVG text rendering. */
export function getWrappedTextLineHeight(element: TextElement): number {
	return getWrappedTextLayout(element).lineHeight;
}

/** Legacy text visual offsets used by current text rendering and outlines. */
export function getWrappedTextMetrics(element: TextElement): Pick<TextLayout, "left" | "ascent"> {
	const { left, ascent } = getWrappedTextLayout(element);
	return { left, ascent };
}

/** Legacy text visual offsets for property editing previews. */
export function getTextLayoutMetrics(
	text: string,
	fontSize: number,
	width: number
): Pick<TextLayout, "left" | "ascent"> {
	const { left, ascent } = getWrappedTextLayoutForContent(text, fontSize, width);
	return { left, ascent };
}

function getWrappedTextLayout(element: TextElement): TextLayout {
	return getWrappedTextLayoutForContent(element.text, element.fontSize, element.width);
}

function getWrappedTextLayoutForContent(text: string, fontSize: number, width: number): TextLayout {
	const metrics = measureWrappedTextBlock(text, fontSize, width);
	if (metrics) return metrics;

	const lines = wrapTextLinesFallback(text, fontSize, width);
	const lineHeight = fontSize * textLineHeightRatio;
	const measuredWidth = Math.max(1, ...lines.map((line) => estimateSingleLineTextWidth(line, fontSize)));

	return {
		lines,
		lineHeight,
		left: 0,
		right: measuredWidth,
		ascent: fontSize,
		descent: Math.ceil(fontSize * textDescentRatio) + Math.max(0, lines.length - 1) * lineHeight
	};
}

function estimateSingleLineTextWidth(text: string, fontSize: number): number {
	return Math.max(1, Math.round(Math.max(text.length, 1) * fontSize * 0.6));
}

function measureWrappedTextBlock(text: string, fontSize: number, width: number): TextLayout | null {
	const context = getTextMeasureContext();
	if (!context) return null;

	context.font = `${fontSize}px ${textFontFamily}`;
	const lines = wrapTextLines(text, width, context);
	let left = 0;
	let right = 0;
	let ascent = fontSize;
	let descent = Math.ceil(fontSize * textDescentRatio);

	for (const line of lines) {
		const metrics = context.measureText(line || " ");
		left = Math.max(left, metrics.actualBoundingBoxLeft ?? 0);
		right = Math.max(right, metrics.actualBoundingBoxRight ?? metrics.width);
		ascent = Math.max(ascent, metrics.actualBoundingBoxAscent ?? fontSize);
		descent = Math.max(descent, metrics.actualBoundingBoxDescent ?? Math.ceil(fontSize * textDescentRatio));
	}

	const lineHeight = fontSize * textLineHeightRatio;
	const extraLineHeight = Math.max(0, lines.length - 1) * lineHeight;

	return { lines, lineHeight, left, right, ascent, descent: descent + extraLineHeight };
}

function wrapTextLinesFallback(text: string, fontSize: number, width: number): string[] {
	return wrapTextLines(text, width, null, (value) => estimateSingleLineTextWidth(value, fontSize));
}

function wrapTextLines(
	text: string,
	width: number,
	context: CanvasRenderingContext2D | null,
	measure = (value: string) => {
		if (!context) return value.length;
		return getMeasuredTextWidth(context.measureText(value || " "));
	}
): string[] {
	const safeWidth = Math.max(1, Math.max(1, width) - textWrapSafetyMargin);
	const lines: string[] = [];

	for (const paragraph of text.split("\n")) {
		if (!paragraph) {
			lines.push("");
			continue;
		}

		const words = paragraph.split(/\s+/).filter(Boolean);
		let currentLine = "";

		for (const word of words) {
			const candidate = currentLine ? `${currentLine} ${word}` : word;
			if (measure(candidate) <= safeWidth) {
				currentLine = candidate;
				continue;
			}

			if (currentLine) {
				lines.push(currentLine);
				currentLine = "";
			}

			const segments = splitWordToWidth(word, safeWidth, measure);
			if (segments.length === 0) continue;
			lines.push(...segments.slice(0, -1));
			currentLine = segments.at(-1) ?? "";
		}

		lines.push(currentLine);
	}

	return lines.length > 0 ? lines : [""];
}

function splitWordToWidth(word: string, width: number, measure: (value: string) => number): string[] {
	if (!word) return [""];
	if (measure(word) <= width) return [word];

	const segments: string[] = [];
	let remaining = word;

	while (remaining) {
		let chunk = "";
		let index = 0;

		while (index < remaining.length) {
			const nextChunk = `${chunk}${remaining[index]}`;
			const hasMore = index < remaining.length - 1;
			const candidate = hasMore ? `${nextChunk}-` : nextChunk;

			if (chunk && measure(candidate) > width) break;

			chunk = nextChunk;
			index += 1;
		}

		if (!chunk) {
			segments.push(remaining.length > 1 ? `${remaining[0]}-` : remaining[0]);
			remaining = remaining.slice(1);
			continue;
		}

		if (index < remaining.length) {
			segments.push(`${chunk}-`);
			remaining = remaining.slice(chunk.length);
			continue;
		}

		segments.push(chunk);
		break;
	}

	return segments;
}

function getMeasuredTextWidth(metrics: TextMetrics): number {
	const left = metrics.actualBoundingBoxLeft ?? 0;
	const right = metrics.actualBoundingBoxRight ?? metrics.width;
	return left + right;
}

function getTextMeasureContext(): CanvasRenderingContext2D | null {
	if (textMeasureContext !== undefined) return textMeasureContext;
	if (typeof document === "undefined") {
		textMeasureContext = null;
		return textMeasureContext;
	}

	const canvas = document.createElement("canvas");
	textMeasureContext = canvas.getContext("2d");
	return textMeasureContext;
}
