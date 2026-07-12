import { Effect, pipe } from "effect";

import { ImageInvalidSvgError, ImageUnsupportedFormatError } from "./errors";

const SVG_MIME_TYPE = "image/svg+xml";
const SVG_XMLNS = "http://www.w3.org/2000/svg";
const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", SVG_MIME_TYPE]);

export type PreparedImage = {
	name: string;
	mimeType: string;
	dataUrl: string;
	width: number;
	height: number;
};

/**
 * Validates that a MIME type is a supported image format (png, jpeg, svg+xml).
 * Normalizes the input to lowercase and trims whitespace.
 *
 * @fails ImageUnsupportedFormatError — MIME type is not in the allowed set
 */
export function validateImageMimeType(mimeType: string): Effect.Effect<string, ImageUnsupportedFormatError> {
	const normalized = mimeType.toLowerCase().trim();

	if (SUPPORTED_MIME_TYPES.has(normalized) || isSvgMimeType(normalized)) {
		return Effect.succeed(normalized);
	}

	return Effect.fail(
		new ImageUnsupportedFormatError({
			message: `Unsupported image format: ${normalized}`,
			mimeType: normalized
		})
	);
}

/**
 * Validates and sanitizes SVG markup. Intentionally conservative: scans raw
 * markup, so text/CDATA containing script-like patterns is rejected.
 */
export const validateSvgMarkup = (markup: string): Effect.Effect<string, ImageInvalidSvgError> =>
	pipe(
		Effect.succeed(markup),
		Effect.map(stripBom),
		Effect.map(stripProlog),
		Effect.map((s) => s.trim()),
		Effect.flatMap(ensureSvgRoot),
		Effect.flatMap(ensureNoUnsafeTag("script")),
		Effect.flatMap(ensureNoEventHandlers),
		Effect.flatMap(ensureSelfContainedHrefs),
		Effect.flatMap(ensureValidXmlns)
	);

/** Returns true if the MIME type corresponds to SVG (image/svg+xml). */
export function isSvgMimeType(mimeType: string): boolean {
	return mimeType.trim().toLowerCase() === SVG_MIME_TYPE;
}

/** Encodes sanitized SVG markup as a UTF-8 data URL. */
export function svgToDataUrl(markup: string): string {
	return `data:${SVG_MIME_TYPE};charset=utf-8,${encodeURIComponent(markup)}`;
}

// --- validation steps ---

const invalid = (message: string) => Effect.fail(new ImageInvalidSvgError({ message }));

const ensureSvgRoot = (source: string) =>
	isSvgRootTag(source) ? Effect.succeed(source) : invalid("SVG uploads must contain a root <svg> element.");

const ensureNoUnsafeTag = (tag: string) => (source: string) =>
	hasUnsafeTag(source, tag) ? invalid(`SVG uploads with <${tag}> are not supported.`) : Effect.succeed(source);

const ensureNoEventHandlers = (source: string) =>
	hasEventHandler(source)
		? invalid("SVG uploads with inline event handlers are not supported.")
		: Effect.succeed(source);

const ensureSelfContainedHrefs = (source: string) => {
	const error = findExternalHref(source);
	return error ? invalid(error) : Effect.succeed(source);
};

const ensureValidXmlns = (source: string) => {
	const state = checkXmlns(source);
	if (state === "wrong") return invalid("SVG root has an incorrect default namespace.");
	if (state === "missing") {
		const tagEnd = indexOfTagEnd(source);
		return Effect.succeed(source.slice(0, tagEnd) + ` xmlns="${SVG_XMLNS}"` + source.slice(tagEnd));
	}
	return Effect.succeed(source);
};

// --- pure transforms ---

function stripBom(source: string): string {
	return source.startsWith("﻿") ? source.slice(1) : source;
}

function stripProlog(source: string): string {
	let result = stripLeadingTag(source, "<?xml", "?>");
	result = stripLeadingTag(result, "<!doctype", ">");

	return result;
}

function stripLeadingTag(source: string, open: string, close: string): string {
	const trimmed = source.trimStart();
	const lower = trimmed.toLowerCase();

	if (!lower.startsWith(open)) return source;

	const end = trimmed.indexOf(close, open.length);
	if (end === -1) return source;

	return trimmed.slice(end + close.length);
}

// --- pure predicates ---

function isSvgRootTag(source: string): boolean {
	const lower = source.toLowerCase();
	if (!lower.startsWith("<svg")) return false;

	const ch = source[4];

	return ch === undefined || ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ">" || ch === "/";
}

function hasUnsafeTag(source: string, tag: string): boolean {
	const lower = source.toLowerCase();
	const open = `<${tag}`;

	let i = 0;

	while (true) {
		i = lower.indexOf(open, i);
		if (i === -1) return false;

		const ch = lower[i + open.length];

		if (ch === undefined || ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ">" || ch === "/") {
			return true;
		}

		i += open.length;
	}
}

function hasEventHandler(source: string): boolean {
	const lower = source.toLowerCase();

	let i = 0;
	while (true) {
		i = lower.indexOf("on", i);
		if (i === -1) return false;

		if (i > 0) {
			const before = lower[i - 1];
			if (before !== " " && before !== "\t" && before !== "\n" && before !== "\r") {
				i += 2;
				continue;
			}
		}

		let j = i + 2;
		while (j < lower.length && lower[j] >= "a" && lower[j] <= "z") j++;
		if (j === i + 2) {
			i += 2;
			continue;
		}

		while (j < lower.length && (lower[j] === " " || lower[j] === "\t" || lower[j] === "\n" || lower[j] === "\r"))
			j++;

		if (j < lower.length && lower[j] === "=") return true;
		i += 2;
	}
}

function findExternalHref(source: string): string | null {
	const lower = source.toLowerCase();

	let i = 0;
	while (true) {
		i = lower.indexOf("href", i);
		if (i === -1) return null;

		if (i > 0) {
			const before = lower[i - 1];
			if (before !== " " && before !== "\t" && before !== "\n" && before !== "\r" && before !== ":") {
				i += 4;
				continue;
			}
		}

		let j = i + 4;
		while (j < lower.length && (lower[j] === " " || lower[j] === "\t" || lower[j] === "\n" || lower[j] === "\r"))
			j++;

		if (j >= lower.length || lower[j] !== "=") {
			i = j;
			continue;
		}
		j++;

		while (j < lower.length && (lower[j] === " " || lower[j] === "\t" || lower[j] === "\n" || lower[j] === "\r"))
			j++;

		const quote = source[j];
		if (quote !== '"' && quote !== "'") {
			i = j;
			continue;
		}

		const closeIdx = source.indexOf(quote, j + 1);
		if (closeIdx === -1) {
			i = j;
			continue;
		}

		const value = source.slice(j + 1, closeIdx).toLowerCase();
		if (!value.startsWith("#") && !value.startsWith("data:")) {
			return "SVG uploads must be self-contained.";
		}

		i = closeIdx + 1;
	}
}

function checkXmlns(source: string): "correct" | "wrong" | "missing" {
	const rootEnd = findRootTagClose(source);
	if (rootEnd === -1) return "missing";

	const rootTag = source.slice(0, rootEnd).toLowerCase();

	let i = rootTag.indexOf("xmlns");
	while (i !== -1) {
		if (i > 0) {
			const before = rootTag[i - 1];
			if (before !== " " && before !== "\t" && before !== "\n" && before !== "\r") {
				i = rootTag.indexOf("xmlns", i + 5);
				continue;
			}
		}

		const after = rootTag[i + 5];
		if (
			after !== undefined &&
			after !== "=" &&
			after !== " " &&
			after !== "\t" &&
			after !== "\n" &&
			after !== "\r"
		) {
			i = rootTag.indexOf("xmlns", i + 5);
			continue;
		}

		let j = i + 5;
		while (
			j < rootTag.length &&
			(rootTag[j] === " " || rootTag[j] === "\t" || rootTag[j] === "\n" || rootTag[j] === "\r")
		)
			j++;

		if (j < rootTag.length && rootTag[j] === "=") {
			j++;
			while (
				j < rootTag.length &&
				(rootTag[j] === " " || rootTag[j] === "\t" || rootTag[j] === "\n" || rootTag[j] === "\r")
			)
				j++;

			const quote = rootTag[j];
			if (quote === '"' || quote === "'") {
				const closeIdx = rootTag.indexOf(quote, j + 1);
				if (closeIdx !== -1) {
					const value = rootTag.slice(j + 1, closeIdx);
					if (value === "http://www.w3.org/2000/svg") return "correct";
					return "wrong";
				}
			}
		}

		i = rootTag.indexOf("xmlns", i + 5);
	}

	return "missing";
}

function findRootTagClose(source: string): number {
	let quote: string | null = null;

	for (let i = 0; i < source.length; i++) {
		const ch = source[i];

		if (quote) {
			if (ch === quote) quote = null;
			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}

		if (ch === ">") return i;
		if (ch === "/" && i + 1 < source.length && source[i + 1] === ">") return i;
	}

	return -1;
}

function indexOfTagEnd(source: string): number {
	const lower = source.toLowerCase();
	const start = lower.indexOf("<svg");

	if (start === -1) return 4;

	return start + 4;
}
