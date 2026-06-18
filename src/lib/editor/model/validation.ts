export const hexColorPattern = /^#([0-9a-fA-F]{3}){1,2}$/;

export function parseNumber(value: string): number | null {
	const parsed = parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
}

export function parsePositiveInt(value: string): number | null {
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
}

export function parseNonNegativeNumber(value: string): number | null {
	const parsed = parseFloat(value);
	return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
}

export function parseHexColor(value: string): string | null {
	const trimmed = value.trim();
	return hexColorPattern.test(trimmed) ? trimmed : null;
}
