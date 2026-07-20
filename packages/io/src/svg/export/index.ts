import type { Project, StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import { create } from "../../project/export";
import { SvgRenderError } from "../errors";
import type { SvgOptions } from "../types";
import { render } from "./render";

export function exportSvg(project: Project, imageAssets: readonly StoredImageAsset[], options?: SvgOptions) {
	return Effect.gen(function* () {
		const file = yield* create(project, imageAssets);
		return yield* Effect.try({
			try: () => render(file.project, file.imageAssets, options),
			catch: (error) =>
				new SvgRenderError({
					message: error instanceof Error ? error.message : String(error),
					details: { cause: error }
				})
		});
	});
}
