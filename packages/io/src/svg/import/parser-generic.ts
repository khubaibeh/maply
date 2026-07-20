import { Effect } from "effect";

import { SvgImportWarningType } from "../types";
import { parseGeneric } from "./parser-synoptic";

export function importGeneric(svg: string) {
	return parseGeneric(svg).pipe(
		Effect.map((imported) => ({
			...imported,
			warnings: [
				...imported.warnings,
				{
					type: SvgImportWarningType.GenericFallback,
					message: "Imported as generic SVG; styles and unsupported SVG features may not be preserved."
				}
			]
		}))
	);
}
