import { svg } from "@maply/io";
import type { SvgImportWarning, SvgOptions } from "@maply/io/types";

import { exportProject } from "./export";
import { importProject } from "./import";

/** Converts the active editor project into SVG through the IO boundary. */
export async function exportSvg(options?: SvgOptions) {
	const projectFile = await exportProject();

	if (!projectFile.ok) return projectFile;

	return svg.export(projectFile.value.project, projectFile.value.imageAssets, options);
}

type SvgImportResult =
	{ ok: true; source: string; warnings: readonly SvgImportWarning[] } | { ok: false; error: unknown };

/** Imports SVG through IO, then atomically applies its recovered project payload. */
export async function importSvg(markup: string): Promise<SvgImportResult> {
	const imported = await svg.import(markup);

	if (!imported.ok) {
		return { ok: false, error: imported.error };
	}

	const applied = await importProject(imported.value.file);

	if (!applied.ok) {
		return { ok: false, error: applied.error };
	}

	return { ok: true, source: imported.value.source, warnings: imported.value.warnings };
}
