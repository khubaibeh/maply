import { Effect } from "effect";

import { create } from "../../project/export";
import type { SvgImport } from "../types";
import { importGeneric } from "./parser-generic";
import { importRecovery } from "./parser-recovery";
import { importSynoptic } from "./parser-synoptic";

export function importSvg(svg: string) {
	return Effect.gen(function* () {
		const recovered = yield* importRecovery(svg);
		if (recovered) return recovered;

		const imported = yield* importSynoptic(svg);
		if (imported) {
			const file = yield* create(imported.project, imported.imageAssets);
			return { file, source: "synoptic" as const, warnings: imported.warnings } satisfies SvgImport;
		}

		const generic = yield* importGeneric(svg);
		const file = yield* create(generic.project, generic.imageAssets);
		return { file, source: "generic" as const, warnings: generic.warnings } satisfies SvgImport;
	});
}
