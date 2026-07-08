import type { Project, StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import type { ProjectFilePackage } from "../project/common";
import { create, serialize } from "../project/export";
import { assign, parse } from "../project/import";
import { ioRuntime } from "./runtime";

export type IoResult<A, E> = { ok: true; value: A } | { ok: false; error: E };

function handled<A, E>(effect: Effect.Effect<A, E, never>): Promise<IoResult<A, E>> {
	return ioRuntime.runPromise(
		effect.pipe(
			Effect.match({
				onFailure: (error): IoResult<A, E> => ({ ok: false, error }),
				onSuccess: (value): IoResult<A, E> => ({ ok: true, value })
			})
		)
	);
}

export function createProject(project: Project, imageAssets: readonly StoredImageAsset[]) {
	return handled(create(project, imageAssets));
}

export function serializeProject(projectFile: ProjectFilePackage) {
	return handled(serialize(projectFile));
}

export function parseProject(text: string) {
	return handled(parse(text));
}

export function assignProject(projectFile: ProjectFilePackage, projectId: string) {
	return handled(assign(projectFile, projectId));
}
