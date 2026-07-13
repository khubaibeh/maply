import type { Element, ElementType } from "@maply/model/types";

const defaultNames: Record<ElementType, string> = {
	rect: "rectangle",
	circle: "circle",
	path: "path",
	text: "text",
	image: "image"
};
export type ElementNameIssue =
	"empty" | "spaces" | "starts-with-number" | "starts-with-hyphen" | "invalid-symbols" | "duplicate";

export type ElementNameValidation = {
	id: string;
	name: string;
	valid: boolean;
	issues: ElementNameIssue[];
	messages: string[];
	suggestion: string | null;
};

const messages: Record<ElementNameIssue, string> = {
	empty: "empty name",
	spaces: "spaces",
	"starts-with-number": "starts with a number",
	"starts-with-hyphen": "starts with a hyphen",
	"invalid-symbols": "invalid symbols",
	duplicate: "duplication"
};

/** Generates an element ID without requiring a browser-only dependency. */
export function createElementId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2);
}

/** Returns the default base name for an element type. */
export function defaultElementName(type: ElementType): string {
	return defaultNames[type];
}

/** Produces a unique name for a new element of the given type. */
export function nextElementName(type: ElementType, elements: readonly Element[]): string {
	const base = defaultElementName(type);
	const names = new Set(elements.map((element) => element.name.trim()));

	let n = elements.filter((element) => element.type === type).length + 1;
	while (names.has(`${base}${n}`)) n++;

	return `${base}${n}`;
}

/** Reports selector-safety issues and an autofix for every element name. */
export function validateElementNames(elements: readonly Element[]): Map<string, ElementNameValidation> {
	const counts = new Map<string, number>();

	for (const element of elements) {
		const name = element.name.trim();

		counts.set(name, (counts.get(name) ?? 0) + 1);
	}

	return new Map(
		elements.map((element) => {
			const issues = nameIssues(element.name, counts);

			return [
				element.id,
				{
					id: element.id,
					name: element.name,
					valid: issues.length === 0,
					issues,
					messages: issues.map((issue) => messages[issue]),
					suggestion: issues.length === 0 ? null : autofixElementName(element.name, elements, element.id)
				}
			];
		})
	);
}

export function autofixElementName(name: string, elements: readonly Element[], currentId?: string): string {
	let base = name
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");

	if (!base) base = "element";
	if (!/^[A-Za-z_]/.test(base)) base = `element-${base}`;

	const used = new Set(elements.filter((element) => element.id !== currentId).map((element) => element.name.trim()));

	if (!used.has(base)) return base;

	let suffix = 2;
	while (used.has(`${base}-${suffix}`)) suffix += 1;

	return `${base}-${suffix}`;
}

function nameIssues(name: string, counts: ReadonlyMap<string, number>): ElementNameIssue[] {
	const trimmed = name.trim();
	const issues: ElementNameIssue[] = [];

	if (!trimmed) issues.push("empty");
	if (/\s/.test(trimmed)) issues.push("spaces");
	if (/^[0-9]/.test(trimmed)) issues.push("starts-with-number");
	if (trimmed.startsWith("-")) issues.push("starts-with-hyphen");
	if (/[^A-Za-z0-9_\-\s]/.test(trimmed)) issues.push("invalid-symbols");
	if (trimmed && (counts.get(trimmed) ?? 0) > 1) issues.push("duplicate");

	return issues;
}
