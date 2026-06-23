import type { Element } from "../domain/elements";

export type ElementNameIssue =
	| "empty"
	| "spaces"
	| "starts-with-number"
	| "starts-with-hyphen"
	| "invalid-symbols"
	| "duplicate";

export type ElementNameValidation = {
	id: string;
	name: string;
	valid: boolean;
	issues: ElementNameIssue[];
	messages: string[];
	suggestion: string | null;
};

const VALID_SELECTOR_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/;

const issueMessages: Record<ElementNameIssue, string> = {
	empty: "empty name",
	spaces: "spaces",
	"starts-with-number": "starts with a number",
	"starts-with-hyphen": "starts with a hyphen",
	"invalid-symbols": "invalid symbols",
	duplicate: "duplication"
};

export function isValidElementSelectorName(name: string): boolean {
	return VALID_SELECTOR_ID.test(name.trim());
}

export function validateElementNames(elements: Element[]): Map<string, ElementNameValidation> {
	const nameCounts = new Map<string, number>();

	for (const element of elements) {
		const name = element.name.trim();
		nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
	}

	return new Map(
		elements.map((element) => {
			const issues = getElementNameIssues(element.name, nameCounts);

			return [
				element.id,
				{
					id: element.id,
					name: element.name,
					valid: issues.length === 0,
					issues,
					messages: issues.map((issue) => issueMessages[issue]),
					suggestion: issues.length > 0 ? createElementNameAutofix(element.name, elements, element.id) : null
				}
			];
		})
	);
}

export function createUniqueElementName(baseName: string, elements: Element[], currentElementId?: string): string {
	const base = normalizeElementSelectorName(baseName);
	const usedNames = new Set(
		elements.filter((element) => element.id !== currentElementId).map((element) => element.name.trim())
	);

	if (!usedNames.has(base)) return base;

	let count = 2;
	let nextName = `${base}-${count}`;

	while (usedNames.has(nextName)) {
		count += 1;
		nextName = `${base}-${count}`;
	}

	return nextName;
}

export function createElementNameAutofix(name: string, elements: Element[], currentElementId?: string): string {
	return createUniqueElementName(name, elements, currentElementId);
}

function getElementNameIssues(name: string, nameCounts: Map<string, number>): ElementNameIssue[] {
	const trimmed = name.trim();
	const issues: ElementNameIssue[] = [];

	if (!trimmed) {
		issues.push("empty");
	} else {
		if (/\s/.test(trimmed)) issues.push("spaces");
		if (/^[0-9]/.test(trimmed)) issues.push("starts-with-number");
		if (/^-/.test(trimmed)) issues.push("starts-with-hyphen");
		if (/[^A-Za-z0-9_\-\s]/.test(trimmed)) issues.push("invalid-symbols");
	}

	if (trimmed && (nameCounts.get(trimmed) ?? 0) > 1) {
		issues.push("duplicate");
	}

	return issues;
}

function normalizeElementSelectorName(name: string): string {
	let nextName = name.trim().replace(/[^A-Za-z0-9_-]+/g, "-");
	nextName = nextName.replace(/-+/g, "-").replace(/^-+|-+$/g, "");

	if (!nextName) return "element";
	if (!/^[A-Za-z_]/.test(nextName)) return `element-${nextName}`;

	return nextName;
}
