export const TEXT_CHARACTER_WIDTH_RATIO = 0.6;
export const TEXT_LINE_HEIGHT_RATIO = 1.2;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
