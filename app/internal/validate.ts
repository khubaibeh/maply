import { parseHexColor, parseIntNumber, parseNonNegativeNumber, parsePositiveInt } from "../domain/validation";
import { type ElementNameValidation, validateElementNames } from "./element-name-validation";

export { type ElementNameValidation };

export const appValidate = {
	elementNames: validateElementNames,
	hexColor: parseHexColor,
	int: parseIntNumber,
	nonNegativeNumber: parseNonNegativeNumber,
	positiveInt: parsePositiveInt
} as const;
