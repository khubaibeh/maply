/** Escapes a delimited field and neutralizes spreadsheet formulas for file exports. */
export function encodeDelimitedCell(value: string, delimiter: string, neutralizeFormula = false): string {
	const safeValue = neutralizeFormula && startsSpreadsheetFormula(value) ? `'${value}` : value;
	return safeValue.includes(delimiter) || /["\r\n]/.test(safeValue)
		? `"${safeValue.replaceAll('"', '""')}"`
		: safeValue;
}

function startsSpreadsheetFormula(value: string): boolean {
	for (const character of value) {
		if (/\s/u.test(character) || character.charCodeAt(0) <= 0x1f) continue;
		return "=+-@".includes(character);
	}
	return false;
}
