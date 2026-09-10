import { project as ioProject } from "@maply/io/effect";
import { copyProjectEditorData } from "@maply/model";
import { Effect } from "effect";
import { get } from "svelte/store";

import { history } from "../history";
import { replaceProjectEffect, runStorageEffect, withEditorWriteGate } from "../session/coordinator";
import { loadEditorSessionEffect } from "../session/load";
import { projectState, updateProjectState } from "../state/document";
import { applyInternalEditorMutationEffect, withEditorMutationBlockEffect } from "../state/editing";

/** Atomically replaces the active project with an IO-validated project-file payload. */
export async function importProject(
	projectFile: Parameters<typeof ioProject.file.assign>[0]
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	return runStorageEffect(
		Effect.match(
			withEditorMutationBlockEffect(
				importProjectEffect(projectFile).pipe(
					Effect.tapErrorTag("PersistenceFailed", () =>
						applyInternalEditorMutationEffect(
							Effect.sync(() => {
								updateProjectState((state) => ({ ...state, initialized: true }), "preserve");
							})
						)
					)
				)
			),
			{
				onFailure: (error) => ({ ok: false as const, error }),
				onSuccess: () => ({ ok: true as const })
			}
		)
	);
}

const importProjectEffect = Effect.fn("editor.project.import")(function* (
	projectFile: Parameters<typeof ioProject.file.assign>[0]
) {
	const projectId = get(projectState).id;
	const assigned = yield* ioProject.file.assign(projectFile, projectId);

	yield* history.settleEffect;
	yield* applyInternalEditorMutationEffect(
		Effect.sync(() => {
			updateProjectState((state) => ({ ...state, initialized: false }), "preserve");
		})
	);
	yield* withEditorWriteGate(
		replaceProjectEffect(
			{
				...assigned.project,
				editorData: copyProjectEditorData(assigned.editorData),
				isElementNameImportOpen: true
			},
			assigned.imageAssets
		)
	);

	yield* loadEditorSessionEffect(projectId).pipe(Effect.catchTag("SessionSuperseded", () => Effect.void));
});
