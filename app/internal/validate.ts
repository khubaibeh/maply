import { type ElementNameValidation, validateElementNames } from "$lib/app/core/element-name-validation";

import { parseHexColor, parseIntNumber, parseNonNegativeNumber, parsePositiveInt } from "../domain/validation";

export { type ElementNameValidation };

export const appValidate = {
	elementNames: validateElementNames,
	hexColor: parseHexColor,
	int: parseIntNumber,
	nonNegativeNumber: parseNonNegativeNumber,
	positiveInt: parsePositiveInt
} as const;
