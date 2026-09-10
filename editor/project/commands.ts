import { Effect } from "effect";

import { history } from "../history";
import { resetProjectEffect, runStorageEffect, withEditorWriteGate } from "../session/coordinator";
import { loadEditorSessionEffect } from "../session/load";
import { updateProjectState } from "../state/document";
import { applyInternalEditorMutationEffect, withEditorMutationBlockEffect } from "../state/editing";

/** Renames the active project in live editor state. */
export function rename(name: string): void {
	updateProjectState((state) => ({ ...state, name }), "preserve");
}

/** Resets the active persisted project to blank or sample content, then rehydrates editor state. */
export async function create(options: { elements?: "sample" | "blank" } = {}) {
	return runStorageEffect(
		Effect.match(
			withEditorMutationBlockEffect(
				createProjectEffect(options).pipe(
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
				onSuccess: () => ({ ok: true as const, value: undefined })
			}
		)
	);
}

const createProjectEffect = Effect.fn("editor.project.create")(function* (options: { elements?: "sample" | "blank" }) {
	yield* history.settleEffect;
	yield* applyInternalEditorMutationEffect(
		Effect.sync(() => {
			updateProjectState((state) => ({ ...state, initialized: false }), "preserve");
		})
	);
	const project = yield* withEditorWriteGate(resetProjectEffect(options));
	yield* loadEditorSessionEffect(project.id).pipe(Effect.catchTag("SessionSuperseded", () => Effect.void));
});
