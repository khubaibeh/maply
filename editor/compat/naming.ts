import type { Element } from "@maply/model/types";

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

/** Validates element names for CSS-selector safety and uniqueness. */
export function validateElementNames(elements: readonly Element[]): Map<string, ElementNameValidation> {
	const counts = new Map<string, number>();
	for (const element of elements) {
		const name = element.name.trim();
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}

	return new Map(
		elements.map((element) => {
			const name = element.name.trim();
			const issues: ElementNameIssue[] = [];
			if (!name) issues.push("empty");
			else {
				if (/\s/.test(name)) issues.push("spaces");
				if (/^[0-9]/.test(name)) issues.push("starts-with-number");
				if (/^-/.test(name)) issues.push("starts-with-hyphen");
				if (/[^A-Za-z0-9_\-\s]/.test(name)) issues.push("invalid-symbols");
			}
			if (name && (counts.get(name) ?? 0) > 1) issues.push("duplicate");
			return [
				element.id,
				{
					id: element.id,
					name: element.name,
					valid: issues.length === 0,
					issues,
					messages: issues.map((issue) => messages[issue]),
					suggestion: issues.length ? uniqueName(element.name, elements, element.id) : null
				}
			];
		})
	);
}

function uniqueName(name: string, elements: readonly Element[], id: string): string {
	let base = name
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!base) base = "element";
	if (!/^[A-Za-z_]/.test(base)) base = `element-${base}`;
	const used = new Set(elements.filter((element) => element.id !== id).map((element) => element.name.trim()));
	if (!used.has(base)) return base;
	let count = 2;
	while (used.has(`${base}-${count}`)) count += 1;
	return `${base}-${count}`;
}
